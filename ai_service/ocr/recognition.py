"""
recognition.py
==============
TrOCR-based Amharic text recognition.

Loads a fine-tuned TrOCR model saved as a raw state_dict (.pt file).
Base architecture: microsoft/trocr-base-handwritten
Custom Amharic vocabulary: 324 tokens
"""

import logging
import time
from pathlib import Path
from typing import List, Tuple, Optional

import numpy as np
import torch
from PIL import Image

log = logging.getLogger("medxplain-ai.ocr")

# ── Config ────────────────────────────────────────────────────────────────────

# Fast-loading HuggingFace safetensors model (converted from .pt)
# Run convert_model.py once to generate this
_THIS_DIR = Path(__file__).resolve().parent          # ai_service/ocr
_AI_SERVICE_DIR = _THIS_DIR.parent                   # ai_service
_PROJECT_ROOT = _AI_SERVICE_DIR.parent               # medxplain

HF_MODEL_DIR    = _PROJECT_ROOT / "OCR_MODEL" / "hf_model"   # fast path (safetensors)
OCR_MODEL_PT    = _PROJECT_ROOT / "OCR_MODEL" / "best_model (1).pt"  # fallback
_VOCAB_PATH_OVERRIDE = _PROJECT_ROOT / "OCR_MODEL" / "amharic_vocab.json"

# Base TrOCR architecture your model was fine-tuned from
BASE_MODEL_NAME = "microsoft/trocr-base-handwritten"

# Your custom Amharic vocabulary size (from output_projection shape [324, ...])
VOCAB_SIZE = 324

# Confidence threshold below which a line is flagged for reprocessing
CONFIDENCE_THRESHOLD = 0.70

# Batch size for inference (reduce if OOM on GPU)
BATCH_SIZE = 8

_ocr_model: Optional[dict] = None


# ── Model loading ─────────────────────────────────────────────────────────────

def get_ocr_model() -> dict:
    """
    Lazy-load the TrOCR model from a raw state_dict .pt file.

    Strategy:
      1. Load base TrOCR architecture from HuggingFace
      2. Resize the output projection to match custom vocab (324 tokens)
      3. Load your fine-tuned weights into the architecture
      4. Return model + processor ready for inference
    """
    global _ocr_model
    if _ocr_model is not None:
        return _ocr_model

    log.info("Loading TrOCR Amharic model...")
    t = time.time()

    try:
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel

        device = "cuda" if torch.cuda.is_available() else "cpu"

        if HF_MODEL_DIR.exists():
            # Fast path — load from safetensors with memory mapping
            log.info(f"Loading from safetensors (mmap): {HF_MODEL_DIR}")
            model = VisionEncoderDecoderModel.from_pretrained(
                str(HF_MODEL_DIR),
                low_cpu_mem_usage=True,
                ignore_mismatched_sizes=True,
            )
            # Load only the image processor — we use our own Amharic tokenizer
            from transformers import ViTImageProcessor
            processor = ViTImageProcessor.from_pretrained(str(HF_MODEL_DIR))
            missing, unexpected = [], []
        elif OCR_MODEL_PT.exists():
            # Slow path — load from raw .pt state dict (~5 min on CPU)
            log.info(f"safetensors not found, loading from .pt (slow)...")
            model = VisionEncoderDecoderModel.from_pretrained(BASE_MODEL_NAME)
            _resize_model_vocab(model, VOCAB_SIZE)
            state_dict = torch.load(str(OCR_MODEL_PT), map_location="cpu")
            if isinstance(state_dict, dict):
                for key in ("model_state_dict", "state_dict", "model"):
                    if key in state_dict:
                        state_dict = state_dict[key]
                        break
            missing, unexpected = model.load_state_dict(state_dict, strict=False)
            from transformers import ViTImageProcessor
            processor = ViTImageProcessor.from_pretrained(BASE_MODEL_NAME)
        else:
            raise FileNotFoundError(
                f"No model found. Expected either:\n"
                f"  {HF_MODEL_DIR}  (fast, run convert_model.py)\n"
                f"  {OCR_MODEL_PT}  (slow fallback)"
            )

        # Load our custom Amharic tokenizer
        try:
            from ocr.tokenizer import AmharicTokenizer
        except ImportError:
            from tokenizer import AmharicTokenizer
        tokenizer = AmharicTokenizer(_VOCAB_PATH_OVERRIDE)

        # Update model generation config to use our token IDs
        model.config.decoder_start_token_id = tokenizer.bos_token_id
        model.config.pad_token_id = tokenizer.pad_token_id
        model.config.eos_token_id = tokenizer.eos_token_id
        model.generation_config.decoder_start_token_id = tokenizer.bos_token_id
        model.generation_config.pad_token_id = tokenizer.pad_token_id
        model.generation_config.eos_token_id = tokenizer.eos_token_id

        _ocr_model = {
            "model": model,
            "processor": processor,   # image processor only
            "tokenizer": tokenizer,   # custom Amharic tokenizer for decoding
            "device": device,
            "vocab_size": VOCAB_SIZE,
        }

        log.info(
            f"TrOCR Amharic model ready in {time.time()-t:.1f}s on {device} "
            f"| vocab={VOCAB_SIZE} | missing={len(missing)} unexpected={len(unexpected)}"
        )

    except ImportError:
        raise ImportError("transformers not installed. Run: pip install transformers")

    return _ocr_model


def _resize_model_vocab(model, new_vocab_size: int):
    """
    Resize the decoder's output projection layer to match custom vocab size.
    This must be done BEFORE loading the state dict.
    """
    import torch.nn as nn

    decoder = model.decoder

    # Find the output projection layer
    if hasattr(decoder, 'output_projection'):
        old_proj = decoder.output_projection
        hidden_size = old_proj.weight.shape[1]
        new_proj = nn.Linear(hidden_size, new_vocab_size, bias=False)
        decoder.output_projection = new_proj
        log.info(f"Resized output_projection: {old_proj.weight.shape} → [{new_vocab_size}, {hidden_size}]")

    elif hasattr(decoder, 'lm_head'):
        old_head = decoder.lm_head
        hidden_size = old_head.weight.shape[1]
        new_head = nn.Linear(hidden_size, new_vocab_size, bias=hasattr(old_head, 'bias') and old_head.bias is not None)
        decoder.lm_head = new_head
        log.info(f"Resized lm_head: {old_head.weight.shape} → [{new_vocab_size}, {hidden_size}]")

    # Also update embed_tokens if needed
    if hasattr(decoder.model, 'decoder') and hasattr(decoder.model.decoder, 'embed_tokens'):
        old_embed = decoder.model.decoder.embed_tokens
        if old_embed.weight.shape[0] != new_vocab_size:
            new_embed = nn.Embedding(new_vocab_size, old_embed.embedding_dim)
            decoder.model.decoder.embed_tokens = new_embed
            log.info(f"Resized embed_tokens: {old_embed.weight.shape[0]} → {new_vocab_size}")


# ── Single line inference ─────────────────────────────────────────────────────

def recognize_line(
    line_rgb: np.ndarray,
    model_ctx: Optional[dict] = None,
) -> Tuple[str, float]:
    """
    Run TrOCR on a single line image.
    Returns (text, confidence).
    """
    if model_ctx is None:
        model_ctx = get_ocr_model()

    model = model_ctx["model"]
    processor = model_ctx["processor"]
    tokenizer = model_ctx["tokenizer"]
    device = model_ctx["device"]

    pil_img = Image.fromarray(line_rgb).convert("RGB")
    pixel_values = processor(images=pil_img, return_tensors="pt").pixel_values.to(device)

    with torch.no_grad():
        outputs = model.generate(
            pixel_values,
            output_scores=True,
            return_dict_in_generate=True,
            max_new_tokens=128,
        )

    generated_ids = outputs.sequences.tolist()
    text = tokenizer.decode(generated_ids[0], skip_special_tokens=True)
    confidence = _calculate_confidence(outputs)

    return text, confidence


def _calculate_confidence(outputs) -> float:
    """Mean token probability from generation scores."""
    try:
        if not hasattr(outputs, "scores") or not outputs.scores:
            return 1.0
        token_probs = []
        for score_tensor in outputs.scores:
            probs = torch.softmax(score_tensor, dim=-1)
            max_prob = float(probs[0].max().item())
            token_probs.append(max_prob)
        return float(np.mean(token_probs)) if token_probs else 1.0
    except Exception:
        return 1.0


# ── Batch inference ───────────────────────────────────────────────────────────

def recognize_lines_batch(
    line_images: List[np.ndarray],
    model_ctx: Optional[dict] = None,
    batch_size: int = BATCH_SIZE,
) -> List[Tuple[str, float]]:
    """Batch TrOCR inference — much faster than one-by-one."""
    if not line_images:
        return []

    if model_ctx is None:
        model_ctx = get_ocr_model()

    model = model_ctx["model"]
    processor = model_ctx["processor"]
    tokenizer = model_ctx["tokenizer"]
    device = model_ctx["device"]

    results = []

    for batch_start in range(0, len(line_images), batch_size):
        batch = line_images[batch_start: batch_start + batch_size]
        pixel_values_list = []
        for img in batch:
            pil_img = Image.fromarray(img).convert("RGB")
            pv = processor(images=pil_img, return_tensors="pt").pixel_values
            pixel_values_list.append(pv)
        # Stack into batch — all images same size after normalize_line_for_trocr
        pixel_values = torch.cat(pixel_values_list, dim=0).to(device)

        with torch.no_grad():
            outputs = model.generate(
                pixel_values,
                output_scores=True,
                return_dict_in_generate=True,
                max_new_tokens=128,
            )

        texts = tokenizer.batch_decode(outputs.sequences.tolist(), skip_special_tokens=True)
        batch_confidence = _calculate_confidence(outputs)

        for text in texts:
            results.append((text.strip(), batch_confidence))

    return results


# ── Document-level recognition ────────────────────────────────────────────────

def recognize_document_lines(
    line_images: List[np.ndarray],
    model_ctx: Optional[dict] = None,
) -> List[dict]:
    """Recognize all lines in a document. Returns list of result dicts."""
    if not line_images:
        return []

    if model_ctx is None:
        model_ctx = get_ocr_model()

    log.info(f"Recognizing {len(line_images)} lines...")
    t = time.time()

    raw_results = recognize_lines_batch(line_images, model_ctx)

    results = []
    for idx, (text, confidence) in enumerate(raw_results):
        results.append({
            "line_index": idx,
            "text": text,
            "confidence": round(confidence, 4),
            "low_confidence": confidence < CONFIDENCE_THRESHOLD,
        })

    low_conf_count = sum(1 for r in results if r["low_confidence"])
    log.info(
        f"Recognition done in {time.time()-t:.1f}s — "
        f"{len(results)} lines, {low_conf_count} low confidence"
    )

    return results
