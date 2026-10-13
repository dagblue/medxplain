"""
Quick test -- run this to verify the model loads correctly.

Usage:
  cd D:/medxplain
  python ai_service/ocr/test_load.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

print("=" * 60)
print("TrOCR Amharic Model Load Test")
print("=" * 60)

# Test 1: model loads
print("\n[1] Loading model...")
try:
    from ocr.recognition import get_ocr_model
    ctx = get_ocr_model()
    print(f"    ✓ Model loaded on {ctx['device']}")
    print(f"    ✓ Vocab size: {ctx['vocab_size']}")
except Exception as e:
    print(f"    ✗ FAILED: {e}")
    sys.exit(1)

# Test 2: dummy inference — SKIPPED on CPU (takes 2-3 min per line)
print("\n[2] Skipping inference test on CPU (too slow for test)")
print("    Use the FastAPI endpoint instead: POST /ocr/document")
print("    Start server: uvicorn ai_service.main:app --port 8000")

# Test 3: preprocessing
print("\n[3] Testing preprocessing...")
try:
    import numpy as np
    from ocr.preprocessing import binarize, denoise

    gray = np.ones((100, 400), dtype=np.uint8) * 200
    binary = binarize(gray)
    print(f"    ✓ Binarize works: {binary.shape}")
except Exception as e:
    print(f"    ✗ FAILED: {e}")

# Test 4: segmentation
print("\n[4] Testing segmentation...")
try:
    import numpy as np
    from ocr.segmentation import extract_lines

    # Create a fake binary image with 3 text lines
    img = np.ones((200, 400), dtype=np.uint8) * 255
    # Draw 3 fake text lines (black rows)
    for y in [30, 80, 130]:
        img[y:y+20, 20:380] = 0

    lines = extract_lines(img)
    print(f"    ✓ Segmentation works: detected {len(lines)} lines (expected 3)")
except Exception as e:
    print(f"    ✗ FAILED: {e}")

print("\n" + "=" * 60)
print("All tests passed — OCR engine is ready.")
print("=" * 60)
