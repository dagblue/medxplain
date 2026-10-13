"""
preprocessing.py
================
Image preprocessing pipeline for Amharic document OCR.

Steps:
  1. Load image (from bytes or file path)
  2. Convert to grayscale
  3. Deskew  — correct rotation using Hough line transform
  4. Denoise — remove noise while preserving Ethiopic character strokes
  5. Binarize — adaptive threshold (handles uneven lighting)

All functions accept and return numpy arrays (OpenCV format).
"""

import cv2
import numpy as np
from typing import Tuple


# ── Load ──────────────────────────────────────────────────────────────────────

def load_image_from_bytes(data: bytes) -> np.ndarray:
    """Decode image bytes → BGR numpy array."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image. Unsupported format or corrupted file.")
    return img


def to_grayscale(img: np.ndarray) -> np.ndarray:
    """Convert BGR → grayscale. No-op if already grayscale."""
    if len(img.shape) == 2:
        return img
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


# ── Deskew ────────────────────────────────────────────────────────────────────

def detect_skew_angle(gray: np.ndarray) -> float:
    """
    Detect document skew angle using Hough line transform.
    Returns angle in degrees (positive = clockwise tilt).
    Clamps to [-15, 15] degrees — larger angles are likely not skew.
    """
    # Edge detection
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)

    # Hough lines
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=100,
        minLineLength=100,
        maxLineGap=10,
    )

    if lines is None or len(lines) == 0:
        return 0.0

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if x2 - x1 == 0:
            continue  # vertical line — skip
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        # Only consider near-horizontal lines (text lines)
        if abs(angle) < 15:
            angles.append(angle)

    if not angles:
        return 0.0

    # Use median to be robust against outliers
    return float(np.median(angles))


def deskew(gray: np.ndarray) -> Tuple[np.ndarray, float]:
    """
    Rotate image to correct skew.
    Returns (deskewed_image, angle_applied).
    """
    angle = detect_skew_angle(gray)

    if abs(angle) < 0.3:
        # Not worth rotating — avoid interpolation artifacts
        return gray, 0.0

    h, w = gray.shape
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)

    # Use white background (255) for border fill
    rotated = cv2.warpAffine(
        gray, M, (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=255,
    )
    return rotated, angle


# ── Denoise ───────────────────────────────────────────────────────────────────

def denoise(gray: np.ndarray) -> np.ndarray:
    """
    Remove noise while preserving Ethiopic character strokes.
    Uses fastNlMeansDenoising — good balance of speed vs quality.
    h=10 is conservative to avoid blurring fine Ethiopic details.
    """
    return cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)


# ── Binarize ──────────────────────────────────────────────────────────────────

def binarize(gray: np.ndarray, method: str = "adaptive") -> np.ndarray:
    """
    Convert grayscale → binary (black text on white background).

    method:
      "adaptive" — handles uneven lighting (recommended for scans/photos)
      "otsu"     — global threshold (good for clean scans)
      "sauvola"  — local threshold (good for degraded documents)
    """
    if method == "otsu":
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    elif method == "adaptive":
        binary = cv2.adaptiveThreshold(
            gray,
            maxValue=255,
            adaptiveMethod=cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            thresholdType=cv2.THRESH_BINARY,
            blockSize=31,   # larger block = more tolerant of lighting variation
            C=10,
        )

    elif method == "sauvola":
        # Approximate Sauvola using local mean + std
        # OpenCV doesn't have native Sauvola — use adaptive as fallback
        binary = cv2.adaptiveThreshold(
            gray,
            maxValue=255,
            adaptiveMethod=cv2.ADAPTIVE_THRESH_MEAN_C,
            thresholdType=cv2.THRESH_BINARY,
            blockSize=25,
            C=8,
        )
    else:
        raise ValueError(f"Unknown binarization method: {method}")

    return binary


# ── Full preprocessing pipeline ───────────────────────────────────────────────

def preprocess(
    image_bytes: bytes,
    binarize_method: str = "adaptive",
    do_deskew: bool = True,
    do_denoise: bool = True,
) -> Tuple[np.ndarray, dict]:
    """
    Full preprocessing pipeline.

    Returns:
      (binary_image, metadata)
      metadata = { skew_angle, binarize_method, shape }
    """
    img = load_image_from_bytes(image_bytes)
    gray = to_grayscale(img)

    skew_angle = 0.0
    if do_deskew:
        gray, skew_angle = deskew(gray)

    if do_denoise:
        gray = denoise(gray)

    binary = binarize(gray, method=binarize_method)

    metadata = {
        "skew_angle": round(skew_angle, 2),
        "binarize_method": binarize_method,
        "shape": {"height": binary.shape[0], "width": binary.shape[1]},
    }

    return binary, metadata


def preprocess_variants(image_bytes: bytes) -> list:
    """
    Generate multiple preprocessed variants for confidence-based routing.
    Returns list of (binary_image, variant_name) tuples.
    Used in Phase 2 when primary OCR confidence is low.
    """
    variants = []

    # Variant 1: adaptive threshold (default)
    img1, _ = preprocess(image_bytes, binarize_method="adaptive")
    variants.append((img1, "adaptive"))

    # Variant 2: Otsu threshold
    img2, _ = preprocess(image_bytes, binarize_method="otsu")
    variants.append((img2, "otsu"))

    # Variant 3: sharpened + adaptive
    img = load_image_from_bytes(image_bytes)
    gray = to_grayscale(img)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(gray, -1, kernel)
    binary3 = binarize(sharpened, method="adaptive")
    variants.append((binary3, "sharpened_adaptive"))

    # Variant 4: contrast enhanced + adaptive
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(to_grayscale(load_image_from_bytes(image_bytes)))
    binary4 = binarize(enhanced, method="adaptive")
    variants.append((binary4, "clahe_adaptive"))

    return variants
