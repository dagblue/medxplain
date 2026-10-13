# Amharic OCR Engine

Production OCR pipeline built around your trained TrOCR model.

## Setup

1. **Point to your model:**
   Edit `recognition.py` line:
   ```python
   OCR_MODEL_PATH = Path(__file__).parent.parent.parent / "OCR_MODEL"
   ```
   Change `"OCR_MODEL"` to the folder name of your TrOCR checkpoint.

2. **Install dependencies:**
   ```bash
   pip install opencv-python-headless Pillow numpy
   ```

## API

### `POST /ocr/document`
Full pipeline — upload an image, get back text.

```bash
curl -X POST http://localhost:8000/ocr/document \
  -F "file=@document.jpg" \
  -F "binarize_method=adaptive" \
  -F "do_deskew=true" \
  -F "do_denoise=true" \
  -F "return_lines=true"
```

Response:
```json
{
  "text": "ሙሉ ጽሑፍ...",
  "table_text": "",
  "line_results": [...],
  "confidence": { "mean": 0.91, "low_confidence_lines": 2, "total_lines": 15 },
  "line_count": 15,
  "low_confidence_lines": [3, 7],
  "metadata": { "skew_angle": -1.2, "total_tables": 0 },
  "processing_time_ms": 1240
}
```

### `POST /ocr/lines`
Debug endpoint — see per-line segmentation and recognition results.

### `GET /ocr/health`
Check if model is loaded and ready.

## Pipeline

```
Image Upload
    ↓
preprocessing.py
  - Deskew (Hough transform)
  - Denoise (fastNlMeans)
  - Binarize (adaptive threshold)
    ↓
segmentation.py
  - Table detection (morphological)
  - Line segmentation (projection profile)
  - Line normalization for TrOCR
    ↓
recognition.py
  - TrOCR batch inference
  - Confidence scoring
    ↓
postprocessing.py
  - Unicode normalization (NFC)
  - Garbage character removal
  - Text reconstruction
    ↓
JSON Response
```

## Confidence Routing (Phase 2)

Lines with confidence < 0.70 are flagged in `low_confidence_lines`.
Future: automatically retry with alternative preprocessing variants.

## File Structure

```
ocr/
├── __init__.py
├── preprocessing.py   # deskew, denoise, binarize
├── segmentation.py    # line detection, table detection
├── recognition.py     # TrOCR wrapper
├── postprocessing.py  # text cleanup, reconstruction
├── router.py          # FastAPI endpoints
└── README.md
```
