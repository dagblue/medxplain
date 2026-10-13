"""
english_ocr.py
==============
English OCR using Tesseract + language detection.

Tesseract handles printed English clinical documents well (95%+ accuracy).
langdetect identifies whether extracted/typed text is Amharic or English.
"""

import logging
import re
import unicodedata
from typing import Tuple

log = logging.getLogger("medxplain-ai.ocr")

# ── Tesseract OCR ─────────────────────────────────────────────────────────────

def tesseract_available() -> bool:
    """Check if Tesseract is installed on the system."""
    try:
        import pytesseract
        # Windows default install path
        import os, platform
        if platform.system() == "Windows":
            tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
            if os.path.exists(tesseract_path):
                pytesseract.pytesseract.tesseract_cmd = tesseract_path
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def ocr_english(image_bytes: bytes) -> Tuple[str, float]:
    """
    Run Tesseract OCR on an image for English text.
    Returns (text, confidence).
    confidence is mean word confidence from Tesseract (0-100 → 0.0-1.0).
    """
    try:
        import pytesseract
        import cv2
        import numpy as np
        from PIL import Image
        import io, os, platform

        # Set Tesseract path on Windows
        if platform.system() == "Windows":
            tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
            if os.path.exists(tesseract_path):
                pytesseract.pytesseract.tesseract_cmd = tesseract_path

        # Decode image
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image")

        # Preprocess for Tesseract
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Denoise
        gray = cv2.fastNlMeansDenoising(gray, h=10)
        # Adaptive threshold
        binary = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 31, 10
        )

        pil_img = Image.fromarray(binary)

        # Get text with confidence data
        data = pytesseract.image_to_data(
            pil_img,
            lang="eng",
            config="--psm 6",  # Assume uniform block of text
            output_type=pytesseract.Output.DICT,
        )

        # Extract text and mean confidence
        words = []
        confidences = []
        for i, word in enumerate(data["text"]):
            conf = int(data["conf"][i])
            if conf > 0 and word.strip():
                words.append(word)
                confidences.append(conf / 100.0)

        text = " ".join(words)
        # Clean up extra whitespace
        text = re.sub(r" +", " ", text).strip()
        # Restore line breaks (Tesseract loses them in word mode)
        text = pytesseract.image_to_string(pil_img, lang="eng", config="--psm 6").strip()

        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

        return text, avg_conf

    except ImportError:
        raise RuntimeError(
            "pytesseract not installed. Run: pip install pytesseract\n"
            "Also install Tesseract binary: https://github.com/UB-Mannheim/tesseract/wiki"
        )


# ── Language detection ────────────────────────────────────────────────────────

# Ethiopic Unicode block: U+1200–U+137F
ETHIOPIC_PATTERN = re.compile(r"[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]")

def detect_language(text: str) -> dict:
    """
    Detect whether text is Amharic, English, or mixed.

    Strategy:
    1. Count Ethiopic characters — if >10% of alpha chars → Amharic
    2. Use langdetect as fallback for pure Latin text
    3. Return language code + confidence + is_amharic flag

    Returns:
    {
        "language": "am" | "en" | "mixed" | "unknown",
        "is_amharic": bool,
        "is_english": bool,
        "ethiopic_ratio": float,   # ratio of Ethiopic chars
        "confidence": float,
        "method": "unicode_ratio" | "langdetect" | "fallback"
    }
    """
    if not text or not text.strip():
        return {
            "language": "unknown",
            "is_amharic": False,
            "is_english": False,
            "ethiopic_ratio": 0.0,
            "confidence": 0.0,
            "method": "empty",
        }

    # Count Ethiopic vs total alpha characters
    ethiopic_chars = len(ETHIOPIC_PATTERN.findall(text))
    alpha_chars = sum(1 for c in text if c.isalpha())

    if alpha_chars == 0:
        return {
            "language": "unknown",
            "is_amharic": False,
            "is_english": False,
            "ethiopic_ratio": 0.0,
            "confidence": 0.5,
            "method": "no_alpha",
        }

    ethiopic_ratio = ethiopic_chars / alpha_chars

    # Strong Amharic signal
    if ethiopic_ratio >= 0.5:
        return {
            "language": "am",
            "is_amharic": True,
            "is_english": False,
            "ethiopic_ratio": round(ethiopic_ratio, 3),
            "confidence": min(0.99, 0.7 + ethiopic_ratio * 0.3),
            "method": "unicode_ratio",
        }

    # Mixed (some Ethiopic, some Latin)
    if ethiopic_ratio >= 0.1:
        return {
            "language": "mixed",
            "is_amharic": True,   # treat mixed as Amharic for OCR routing
            "is_english": False,
            "ethiopic_ratio": round(ethiopic_ratio, 3),
            "confidence": 0.7,
            "method": "unicode_ratio",
        }

    # Mostly Latin — use langdetect if available, otherwise assume English
    try:
        from langdetect import detect_langs
        langs = detect_langs(text)
        top = langs[0]
        lang_code = top.lang
        conf = float(top.prob)

        return {
            "language": lang_code,
            "is_amharic": lang_code == "am",
            "is_english": lang_code == "en",
            "ethiopic_ratio": round(ethiopic_ratio, 3),
            "confidence": round(conf, 3),
            "method": "langdetect",
        }
    except Exception:
        # Fallback: if no Ethiopic chars, assume English
        return {
            "language": "en",
            "is_amharic": False,
            "is_english": True,
            "ethiopic_ratio": round(ethiopic_ratio, 3),
            "confidence": 0.8,
            "method": "fallback_latin",
        }
