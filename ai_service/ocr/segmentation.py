"""
segmentation.py
===============
Document layout analysis and line segmentation for Amharic documents.

Strategy:
  1. Horizontal Projection Profile — detect text line positions
  2. Connected Component Analysis  — refine line boundaries
  3. Table Detection               — detect ruled tables via morphology
  4. Region routing                — classify regions (text / table / figure)

All functions accept binary numpy arrays (black text on white background).
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass, field


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class TextLine:
    """A single detected text line."""
    image: np.ndarray          # cropped line image
    y_top: int                 # top y coordinate in original image
    y_bottom: int              # bottom y coordinate
    x_left: int                # left x coordinate
    x_right: int               # right x coordinate
    line_index: int            # order in document (0-based)

    @property
    def height(self) -> int:
        return self.y_bottom - self.y_top

    @property
    def width(self) -> int:
        return self.x_right - self.x_left


@dataclass
class TableCell:
    """A single cell extracted from a table."""
    image: np.ndarray
    row: int
    col: int
    x: int
    y: int
    w: int
    h: int


@dataclass
class DocumentRegion:
    """A detected region in the document."""
    region_type: str           # "text_block" | "table" | "figure"
    y_top: int
    y_bottom: int
    x_left: int
    x_right: int
    lines: List[TextLine] = field(default_factory=list)
    cells: List[TableCell] = field(default_factory=list)


# ── Line segmentation via horizontal projection profile ───────────────────────

def horizontal_projection(binary: np.ndarray) -> np.ndarray:
    """
    Compute horizontal projection profile.
    Returns array of length = image height, each value = number of black pixels in that row.
    Binary image: 0 = black (text), 255 = white (background).
    """
    # Count black pixels per row
    return np.sum(binary == 0, axis=1).astype(np.int32)


def find_line_boundaries(
    projection: np.ndarray,
    min_gap: int = 3,
    min_line_height: int = 8,
    threshold: int = 1,
) -> List[Tuple[int, int]]:
    """
    Find text line boundaries from horizontal projection profile.

    Returns list of (y_top, y_bottom) tuples for each detected line.

    min_gap: minimum number of blank rows between lines
    min_line_height: minimum height of a valid text line (filters noise)
    threshold: minimum black pixels in a row to be considered "text"
    """
    in_line = False
    line_start = 0
    boundaries = []
    gap_count = 0

    for y, count in enumerate(projection):
        if count >= threshold:
            if not in_line:
                in_line = True
                line_start = y
            gap_count = 0
        else:
            if in_line:
                gap_count += 1
                if gap_count >= min_gap:
                    # End of line
                    y_end = y - gap_count
                    if y_end - line_start >= min_line_height:
                        boundaries.append((line_start, y_end))
                    in_line = False
                    gap_count = 0

    # Handle line that reaches the bottom
    if in_line:
        y_end = len(projection) - 1
        if y_end - line_start >= min_line_height:
            boundaries.append((line_start, y_end))

    return boundaries


def extract_lines(
    binary: np.ndarray,
    padding: int = 2,
    min_gap: int = 3,
    min_line_height: int = 8,
) -> List[TextLine]:
    """
    Extract text lines from a binary document image.

    Returns list of TextLine objects sorted top-to-bottom.
    Each TextLine contains the cropped line image.
    """
    h, w = binary.shape
    projection = horizontal_projection(binary)
    boundaries = find_line_boundaries(projection, min_gap=min_gap, min_line_height=min_line_height)

    lines = []
    for idx, (y_top, y_bottom) in enumerate(boundaries):
        # Add vertical padding (clamp to image bounds)
        y1 = max(0, y_top - padding)
        y2 = min(h, y_bottom + padding)

        line_strip = binary[y1:y2, :]

        # Find horizontal extent of text in this line (trim whitespace)
        col_proj = np.sum(line_strip == 0, axis=0)
        nonzero_cols = np.where(col_proj > 0)[0]

        if len(nonzero_cols) == 0:
            continue  # empty line — skip

        x_left = max(0, int(nonzero_cols[0]) - padding)
        x_right = min(w, int(nonzero_cols[-1]) + padding)

        line_img = binary[y1:y2, x_left:x_right]

        lines.append(TextLine(
            image=line_img,
            y_top=y1,
            y_bottom=y2,
            x_left=x_left,
            x_right=x_right,
            line_index=idx,
        ))

    return lines


# ── Table detection via morphological operations ──────────────────────────────

def detect_tables(binary: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """
    Detect table regions using morphological line detection.
    Returns list of (x, y, w, h) bounding boxes for detected tables.

    Works well for:
    - Printed forms with ruled lines
    - Invoices and reports
    - Simple bordered tables

    May miss:
    - Borderless tables
    - Handwritten tables
    """
    # Invert: text=white, background=black (morphology works on white objects)
    inverted = cv2.bitwise_not(binary)

    # Detect horizontal lines
    h_kernel_len = max(40, binary.shape[1] // 10)
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_kernel_len, 1))
    h_lines = cv2.morphologyEx(inverted, cv2.MORPH_OPEN, h_kernel, iterations=2)

    # Detect vertical lines
    v_kernel_len = max(40, binary.shape[0] // 10)
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_kernel_len))
    v_lines = cv2.morphologyEx(inverted, cv2.MORPH_OPEN, v_kernel, iterations=2)

    # Combine
    table_mask = cv2.add(h_lines, v_lines)

    # Dilate to connect nearby lines into table regions
    dilate_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    table_mask = cv2.dilate(table_mask, dilate_kernel, iterations=3)

    # Find contours of table regions
    contours, _ = cv2.findContours(table_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    tables = []
    min_table_area = (binary.shape[0] * binary.shape[1]) * 0.01  # at least 1% of image

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        area = w * h
        if area >= min_table_area:
            tables.append((x, y, w, h))

    return tables


def extract_table_cells(
    binary: np.ndarray,
    table_bbox: Tuple[int, int, int, int],
) -> List[TableCell]:
    """
    Extract individual cells from a detected table region.
    Returns list of TableCell objects.
    """
    x, y, w, h = table_bbox
    table_img = binary[y:y+h, x:x+w]
    inverted = cv2.bitwise_not(table_img)

    # Detect horizontal lines
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 3, 1))
    h_lines = cv2.morphologyEx(inverted, cv2.MORPH_OPEN, h_kernel, iterations=2)

    # Detect vertical lines
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, h // 3))
    v_lines = cv2.morphologyEx(inverted, cv2.MORPH_OPEN, v_kernel, iterations=2)

    # Grid = intersection of h and v lines
    grid = cv2.add(h_lines, v_lines)
    dilated = cv2.dilate(grid, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=2)

    # Find cell contours (inside the grid)
    cell_mask = cv2.bitwise_not(dilated)
    contours, _ = cv2.findContours(cell_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    cells = []
    min_cell_area = 400  # minimum cell size in pixels

    bboxes = []
    for cnt in contours:
        cx, cy, cw, ch = cv2.boundingRect(cnt)
        if cw * ch >= min_cell_area:
            bboxes.append((cx, cy, cw, ch))

    # Sort cells: top-to-bottom, left-to-right
    bboxes.sort(key=lambda b: (b[1] // 20, b[0]))  # group by row (20px tolerance)

    # Assign row/col indices
    if not bboxes:
        return cells

    row_y_positions = []
    for bbox in bboxes:
        cy = bbox[1]
        assigned = False
        for i, ry in enumerate(row_y_positions):
            if abs(cy - ry) < 20:
                assigned = True
                break
        if not assigned:
            row_y_positions.append(cy)

    row_y_positions.sort()

    for bbox in bboxes:
        cx, cy, cw, ch = bbox
        row_idx = min(range(len(row_y_positions)), key=lambda i: abs(row_y_positions[i] - cy))
        col_idx = sum(1 for b in bboxes if b[1] // 20 == cy // 20 and b[0] < cx)

        cell_img = table_img[cy:cy+ch, cx:cx+cw]
        cells.append(TableCell(
            image=cell_img,
            row=row_idx,
            col=col_idx,
            x=x + cx,
            y=y + cy,
            w=cw,
            h=ch,
        ))

    return cells


# ── Full document segmentation ────────────────────────────────────────────────

def segment_document(binary: np.ndarray) -> Tuple[List[TextLine], List[TableCell], dict]:
    """
    Full document segmentation pipeline.

    1. Detect tables
    2. Mask out table regions
    3. Extract text lines from remaining regions
    4. Extract cells from table regions

    Returns:
      (text_lines, table_cells, metadata)
    """
    h, w = binary.shape

    # Step 1: detect tables
    tables = detect_tables(binary)

    # Step 2: create a mask that excludes table regions
    text_mask = binary.copy()
    all_cells = []

    for table_bbox in tables:
        tx, ty, tw, th = table_bbox
        # White out the table region in the text mask
        text_mask[ty:ty+th, tx:tx+tw] = 255
        # Extract cells from this table
        cells = extract_table_cells(binary, table_bbox)
        all_cells.extend(cells)

    # Step 3: extract text lines from non-table regions
    lines = extract_lines(text_mask)

    metadata = {
        "total_lines": len(lines),
        "total_tables": len(tables),
        "total_cells": len(all_cells),
        "image_shape": {"height": h, "width": w},
    }

    return lines, all_cells, metadata


def normalize_line_for_trocr(
    line_img: np.ndarray,
    target_height: int = 32,
    min_width: int = 32,
    max_width: int = 1024,
) -> np.ndarray:
    """
    Normalize a line image for TrOCR input.

    TrOCR expects:
    - RGB image (3 channels)
    - Reasonable aspect ratio
    - White background, black text

    Steps:
    1. Resize to target height, preserve aspect ratio
    2. Clamp width to [min_width, max_width]
    3. Pad to min_width if too narrow
    4. Convert to RGB
    """
    if line_img is None or line_img.size == 0:
        # Return blank image
        blank = np.ones((target_height, min_width), dtype=np.uint8) * 255
        return cv2.cvtColor(blank, cv2.COLOR_GRAY2RGB)

    orig_h, orig_w = line_img.shape[:2]
    if orig_h == 0 or orig_w == 0:
        blank = np.ones((target_height, min_width), dtype=np.uint8) * 255
        return cv2.cvtColor(blank, cv2.COLOR_GRAY2RGB)

    # Resize to target height
    scale = target_height / orig_h
    new_w = int(orig_w * scale)
    new_w = max(min_width, min(new_w, max_width))

    resized = cv2.resize(line_img, (new_w, target_height), interpolation=cv2.INTER_LINEAR)

    # Pad if too narrow
    if resized.shape[1] < min_width:
        pad = min_width - resized.shape[1]
        resized = cv2.copyMakeBorder(resized, 0, 0, 0, pad, cv2.BORDER_CONSTANT, value=255)

    # Convert grayscale → RGB (TrOCR expects 3 channels)
    if len(resized.shape) == 2:
        rgb = cv2.cvtColor(resized, cv2.COLOR_GRAY2RGB)
    else:
        rgb = resized

    return rgb
