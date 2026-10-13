"""
router.py
=========
FastAPI router for the Amharic OCR engine.
Mounted into the main ai_service/main.py app.

Endpoints:
  POST /ocr/document        — Amharic OCR: preprocess → segment → recognize → postprocess
  POST /ocr/english         — English OCR via Tesseract
  POST /ocr/detect-language — Detect if text/image is Amharic or English
  POST /ocr/lines           — return individual line results (debug/inspection)
  GET  /ocr/health          — check if OCR model is loaded
"""

import logging
import time
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

log = logging.getLogger("medxplain-ai.ocr")

router = APIRouter(prefix="/ocr", tags=["OCR"])


# ── Response schemas ──────────────────────────────────────────────────────────

class LineResult(BaseModel):
    line_index: int
    text: str
    confidence: float
    low_confidence: bool


class OCRDocumentResponse(BaseModel):
    text: str
    table_text: str
    line_results: list
    confidence: dict
    line_count: int
    low_confidence_lines: list
    metadata: dict
    processing_time_ms: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
def ocr_health():
    """Check OCR engine status."""
    try:
        from .recognition import HF_MODEL_DIR, OCR_MODEL_PT
        model_exists = HF_MODEL_DIR.exists() or OCR_MODEL_PT.exists()
        return {
            "status": "ready" if model_exists else "model_not_found",
            "hf_model_path": str(HF_MODEL_DIR),
            "hf_model_exists": HF_MODEL_DIR.exists(),
            "pt_fallback_exists": OCR_MODEL_PT.exists(),
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.post("/document", response_model=OCRDocumentResponse)
async def ocr_document(
    file: UploadFile = File(...),
    binarize_method: str = Form("adaptive"),
    do_deskew: bool = Form(True),
    do_denoise: bool = Form(True),
    return_lines: bool = Form(False),
):
    """
    Full OCR pipeline for a document image.

    Upload an image (JPG, PNG, TIFF, BMP) and get back:
    - Full extracted text
    - Table content (if tables detected)
    - Per-line results with confidence scores
    - Processing metadata

    Parameters:
      binarize_method: "adaptive" (default) | "otsu" | "sauvola"
      do_deskew: correct document rotation (default: true)
      do_denoise: apply noise reduction (default: true)
      return_lines: include per-line results in response (default: false)
    """
    t_start = time.time()

    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/tiff", "image/bmp", "image/webp"}
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            400,
            f"Unsupported file type: {file.content_type}. "
            f"Supported: {', '.join(allowed_types)}"
        )

    # Read file bytes
    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(400, "Empty file uploaded")

    if len(image_bytes) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(400, "File too large. Maximum size is 20MB.")

    try:
        # ── Step 1: Preprocessing ──────────────────────────────────────────
        from .preprocessing import preprocess
        binary, preprocess_meta = preprocess(
            image_bytes,
            binarize_method=binarize_method,
            do_deskew=do_deskew,
            do_denoise=do_denoise,
        )
        log.info(f"Preprocessed: {preprocess_meta}")

        # ── Step 2: Segmentation ───────────────────────────────────────────
        from .segmentation import segment_document, normalize_line_for_trocr
        text_lines, table_cells, seg_meta = segment_document(binary)
        log.info(f"Segmented: {seg_meta}")

        if not text_lines and not table_cells:
            return OCRDocumentResponse(
                text="",
                table_text="",
                line_results=[],
                confidence={"mean": 0.0, "min": 0.0, "max": 0.0, "low_confidence_lines": 0, "total_lines": 0, "low_confidence_ratio": 0.0},
                line_count=0,
                low_confidence_lines=[],
                metadata={**preprocess_meta, **seg_meta, "note": "No text regions detected"},
                processing_time_ms=int((time.time() - t_start) * 1000),
            )

        # ── Step 3: Recognition ────────────────────────────────────────────
        from .recognition import get_ocr_model, recognize_document_lines
        model_ctx = get_ocr_model()

        # Normalize line images for TrOCR
        line_images = [normalize_line_for_trocr(line.image) for line in text_lines]

        # Recognize text lines
        line_results = recognize_document_lines(line_images, model_ctx)

        # Recognize table cells (if any)
        cell_results = []
        if table_cells:
            cell_images = [normalize_line_for_trocr(cell.image) for cell in table_cells]
            cell_line_results = recognize_document_lines(cell_images, model_ctx)
            for i, cell in enumerate(table_cells):
                if i < len(cell_line_results):
                    cell_results.append({
                        "row": cell.row,
                        "col": cell.col,
                        "text": cell_line_results[i]["text"],
                        "confidence": cell_line_results[i]["confidence"],
                    })

        # ── Step 4: Postprocessing ─────────────────────────────────────────
        from .postprocessing import postprocess
        post_result = postprocess(line_results, cell_results)

        processing_ms = int((time.time() - t_start) * 1000)
        log.info(f"OCR complete in {processing_ms}ms — {len(text_lines)} lines")

        return OCRDocumentResponse(
            text=post_result["text"],
            table_text=post_result["table_text"],
            line_results=line_results if return_lines else [],
            confidence=post_result["confidence"],
            line_count=post_result["line_count"],
            low_confidence_lines=post_result["low_confidence_lines"],
            metadata={
                **preprocess_meta,
                **seg_meta,
                "filename": file.filename,
                "file_size_kb": round(len(image_bytes) / 1024, 1),
            },
            processing_time_ms=processing_ms,
        )

    except FileNotFoundError as e:
        raise HTTPException(503, f"OCR model not loaded: {e}")
    except Exception as e:
        log.error(f"OCR error: {e}", exc_info=True)
        raise HTTPException(500, f"OCR processing failed: {str(e)}")


@router.post("/lines")
async def ocr_lines(
    file: UploadFile = File(...),
    binarize_method: str = Form("adaptive"),
):
    """
    Debug endpoint — returns individual line images info and recognition results.
    Useful for tuning segmentation parameters.
    """
    image_bytes = await file.read()

    try:
        from .preprocessing import preprocess
        from .segmentation import segment_document, normalize_line_for_trocr
        from .recognition import get_ocr_model, recognize_document_lines

        binary, pre_meta = preprocess(image_bytes, binarize_method=binarize_method)
        text_lines, _, seg_meta = segment_document(binary)

        line_images = [normalize_line_for_trocr(line.image) for line in text_lines]
        model_ctx = get_ocr_model()
        line_results = recognize_document_lines(line_images, model_ctx)

        return {
            "preprocessing": pre_meta,
            "segmentation": seg_meta,
            "lines": [
                {
                    "index": line.line_index,
                    "y_top": line.y_top,
                    "y_bottom": line.y_bottom,
                    "height": line.height,
                    "width": line.width,
                    "text": line_results[i]["text"] if i < len(line_results) else "",
                    "confidence": line_results[i]["confidence"] if i < len(line_results) else 0.0,
                    "low_confidence": line_results[i]["low_confidence"] if i < len(line_results) else False,
                }
                for i, line in enumerate(text_lines)
            ],
        }

    except Exception as e:
        log.error(f"OCR lines error: {e}", exc_info=True)
        raise HTTPException(500, str(e))


# ── Language detection ────────────────────────────────────────────────────────

class DetectLanguageRequest(BaseModel):
    text: str

@router.post("/detect-language")
async def detect_language_endpoint(req: DetectLanguageRequest):
    """
    Detect whether text is Amharic or English.
    Returns language code, is_amharic flag, and confidence.
    """
    try:
        from .english_ocr import detect_language
        result = detect_language(req.text)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


# ── English OCR via Tesseract ─────────────────────────────────────────────────

@router.post("/english")
async def ocr_english_endpoint(
    file: UploadFile = File(...),
):
    """
    English OCR using Tesseract.
    Fast, accurate for printed English clinical documents.
    Returns extracted text + confidence + language detection.
    """
    t_start = time.time()
    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(400, "Empty file")

    try:
        from .english_ocr import ocr_english, detect_language, tesseract_available

        if not tesseract_available():
            raise HTTPException(503,
                "Tesseract not installed. Run: pip install pytesseract "
                "and install the Tesseract binary from https://github.com/UB-Mannheim/tesseract/wiki"
            )

        text, confidence = ocr_english(image_bytes)
        lang = detect_language(text)
        ms = int((time.time() - t_start) * 1000)

        return {
            "text": text,
            "confidence": round(confidence, 4),
            "language": lang,
            "engine": "tesseract",
            "processing_time_ms": ms,
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"English OCR error: {e}", exc_info=True)
        raise HTTPException(500, str(e))


# ── Smart OCR: auto-detect language and route ─────────────────────────────────

@router.post("/smart")
async def ocr_smart(
    file: UploadFile = File(...),
    return_lines: bool = Form(False),
):
    """
    Smart OCR — detects language from image and routes automatically:
    - Amharic/mixed → TrOCR Amharic model
    - English → Tesseract

    Returns OCR text + detected language + which engine was used.
    """
    t_start = time.time()
    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(400, "Empty file")

    # Quick language pre-detection using a fast Tesseract pass
    # (cheaper than loading TrOCR just to find out it's English)
    try:
        from .english_ocr import ocr_english, detect_language, tesseract_available
        from .preprocessing import preprocess
        from .segmentation import segment_document, normalize_line_for_trocr

        # Step 1: Try fast Tesseract pass to detect language
        detected_lang = {"is_amharic": False, "language": "en"}

        if tesseract_available():
            try:
                quick_text, _ = ocr_english(image_bytes)
                detected_lang = detect_language(quick_text)
            except Exception:
                pass  # If Tesseract fails, default to Amharic model

        log.info(f"Smart OCR: detected language={detected_lang['language']} "
                 f"is_amharic={detected_lang['is_amharic']}")

        # Step 2: Route to appropriate engine
        if detected_lang["is_amharic"]:
            # Use TrOCR Amharic model
            from .recognition import get_ocr_model, recognize_document_lines
            from .postprocessing import postprocess

            binary, pre_meta = preprocess(image_bytes)
            text_lines, table_cells, seg_meta = segment_document(binary)

            if not text_lines:
                return {
                    "text": "",
                    "language": detected_lang,
                    "engine": "trocr_amharic",
                    "processing_time_ms": int((time.time() - t_start) * 1000),
                }

            model_ctx = get_ocr_model()
            line_images = [normalize_line_for_trocr(line.image) for line in text_lines]
            line_results = recognize_document_lines(line_images, model_ctx)
            post = postprocess(line_results)

            return {
                "text": post["text"],
                "line_results": line_results if return_lines else [],
                "line_count": post["line_count"],
                "confidence": post["confidence"],
                "language": detected_lang,
                "engine": "trocr_amharic",
                "processing_time_ms": int((time.time() - t_start) * 1000),
            }

        else:
            # Use Tesseract for English
            text, confidence = ocr_english(image_bytes)
            return {
                "text": text,
                "line_results": [],
                "line_count": len(text.split("\n")) if text else 0,
                "confidence": {"mean": round(confidence, 4)},
                "language": detected_lang,
                "engine": "tesseract_english",
                "processing_time_ms": int((time.time() - t_start) * 1000),
            }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Smart OCR error: {e}", exc_info=True)
        raise HTTPException(500, str(e))
