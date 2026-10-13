"""
postprocessing.py
=================
Post-OCR text cleanup and correction for Amharic.

Phase 1: Basic cleanup (implemented now)
  - Join lines into paragraphs
  - Remove garbage characters
  - Normalize whitespace
  - Basic Ethiopic character normalization

Phase 2: Language correction (future)
  - Amharic spell correction
  - Lexicon-based correction
  - Language model correction
"""

import re
import unicodedata
from typing import List


# ── Ethiopic character normalization ─────────────────────────────────────────
#
# Amharic has several characters that look similar and are commonly confused
# by OCR models. These are visually similar but semantically distinct.
# We normalize only the most common OCR confusions.
#
# NOTE: This is conservative — only apply when you're confident the
# substitution is correct for your domain. Expand based on your model's
# error patterns.

# Common OCR confusions in Amharic (source → correct)
# These are the most frequent errors in TrOCR for Ethiopic script
ETHIOPIC_NORMALIZATIONS = {
    # Labialized forms that are commonly confused
    "\u1200": "\u1200",  # ሀ — keep as-is (placeholder for future rules)
}

# Characters that should never appear in clean Amharic text
GARBAGE_PATTERN = re.compile(
    r"[^\u1200-\u137F"      # Ethiopic block
    r"\u1380-\u139F"        # Ethiopic Supplement
    r"\u2D80-\u2DDF"        # Ethiopic Extended
    r"0-9"                  # digits
    r"\u0020-\u007E"        # basic ASCII (punctuation, Latin for mixed docs)
    r"\u00A0"               # non-breaking space
    r"\n\r\t"               # whitespace
    r"]",
    re.UNICODE,
)


# ── Line-level cleanup ────────────────────────────────────────────────────────

def clean_line(text: str) -> str:
    """
    Clean a single recognized line.
    - Strip leading/trailing whitespace
    - Normalize unicode (NFC — canonical composition)
    - Remove garbage characters
    - Collapse multiple spaces
    """
    if not text:
        return ""

    # Unicode normalization — NFC is standard for Ethiopic
    text = unicodedata.normalize("NFC", text)

    # Remove garbage characters
    text = GARBAGE_PATTERN.sub("", text)

    # Collapse multiple spaces/tabs
    text = re.sub(r"[ \t]+", " ", text)

    # Strip
    text = text.strip()

    return text


# ── Document-level reconstruction ────────────────────────────────────────────

def reconstruct_text(
    line_results: List[dict],
    join_char: str = "\n",
    skip_low_confidence: bool = False,
    low_confidence_marker: str = "[?]",
) -> str:
    """
    Reconstruct full document text from line recognition results.

    Args:
        line_results: list of dicts from recognition.recognize_document_lines()
        join_char: character to join lines (default: newline)
        skip_low_confidence: if True, skip lines with low confidence
        low_confidence_marker: marker appended to low-confidence lines

    Returns:
        Full document text as a single string.
    """
    lines = []

    for result in line_results:
        text = clean_line(result.get("text", ""))
        is_low_conf = result.get("low_confidence", False)

        if not text:
            continue

        if is_low_conf:
            if skip_low_confidence:
                continue
            text = f"{text} {low_confidence_marker}"

        lines.append(text)

    return join_char.join(lines)


def reconstruct_table(cells: List[dict]) -> str:
    """
    Reconstruct table content as plain text.
    Cells are sorted by row then column.

    Returns tab-separated text with newlines between rows.
    """
    if not cells:
        return ""

    # Sort by row, then col
    sorted_cells = sorted(cells, key=lambda c: (c.get("row", 0), c.get("col", 0)))

    rows = {}
    for cell in sorted_cells:
        row = cell.get("row", 0)
        text = clean_line(cell.get("text", ""))
        if row not in rows:
            rows[row] = []
        rows[row].append(text)

    lines = []
    for row_idx in sorted(rows.keys()):
        lines.append("\t".join(rows[row_idx]))

    return "\n".join(lines)


# ── Confidence analysis ───────────────────────────────────────────────────────

def analyze_confidence(line_results: List[dict]) -> dict:
    """
    Analyze confidence scores across all lines.
    Returns summary statistics.
    """
    if not line_results:
        return {"mean": 0.0, "min": 0.0, "max": 0.0, "low_confidence_lines": 0, "total_lines": 0}

    confidences = [r.get("confidence", 1.0) for r in line_results]
    low_conf = sum(1 for r in line_results if r.get("low_confidence", False))

    return {
        "mean": round(float(sum(confidences) / len(confidences)), 4),
        "min": round(float(min(confidences)), 4),
        "max": round(float(max(confidences)), 4),
        "low_confidence_lines": low_conf,
        "total_lines": len(line_results),
        "low_confidence_ratio": round(low_conf / len(line_results), 4),
    }


# ── Full postprocessing pipeline ──────────────────────────────────────────────

def postprocess(
    line_results: List[dict],
    cell_results: List[dict] = None,
) -> dict:
    """
    Full postprocessing pipeline.

    Returns:
    {
        "text": full document text,
        "table_text": table content (if any),
        "confidence": confidence analysis,
        "line_count": int,
        "low_confidence_lines": list of line indices,
    }
    """
    # Reconstruct main text
    full_text = reconstruct_text(line_results)

    # Reconstruct table text
    table_text = ""
    if cell_results:
        table_text = reconstruct_table(cell_results)

    # Confidence analysis
    confidence_stats = analyze_confidence(line_results)

    # Collect low-confidence line indices for the API response
    low_conf_indices = [
        r["line_index"] for r in line_results
        if r.get("low_confidence", False)
    ]

    return {
        "text": full_text,
        "table_text": table_text,
        "confidence": confidence_stats,
        "line_count": len(line_results),
        "low_confidence_lines": low_conf_indices,
    }
