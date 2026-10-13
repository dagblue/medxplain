"""
Convert best_model (1).pt to HuggingFace safetensors format.
Run once — after this the model loads in ~10 seconds instead of 6 minutes.

Usage:
  python convert_model.py
"""

import sys
import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("convert")

import torch
from pathlib import Path
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
import torch.nn as nn

BASE_MODEL   = "microsoft/trocr-base-handwritten"
PT_FILE      = Path("OCR_MODEL/best_model (1).pt")
OUTPUT_DIR   = Path("OCR_MODEL/hf_model")
VOCAB_SIZE   = 324

log.info("Step 1: Load base architecture...")
model = VisionEncoderDecoderModel.from_pretrained(BASE_MODEL)

# Resize vocab
decoder = model.decoder
if hasattr(decoder, 'output_projection'):
    h = decoder.output_projection.weight.shape[1]
    decoder.output_projection = nn.Linear(h, VOCAB_SIZE, bias=False)
    log.info(f"  Resized output_projection → [{VOCAB_SIZE}, {h}]")

if hasattr(decoder, 'lm_head'):
    h = decoder.lm_head.weight.shape[1]
    has_bias = hasattr(decoder.lm_head, 'bias') and decoder.lm_head.bias is not None
    decoder.lm_head = nn.Linear(h, VOCAB_SIZE, bias=has_bias)
    log.info(f"  Resized lm_head → [{VOCAB_SIZE}, {h}]")

if hasattr(decoder.model, 'decoder') and hasattr(decoder.model.decoder, 'embed_tokens'):
    emb = decoder.model.decoder.embed_tokens
    if emb.weight.shape[0] != VOCAB_SIZE:
        decoder.model.decoder.embed_tokens = nn.Embedding(VOCAB_SIZE, emb.embedding_dim)
        log.info(f"  Resized embed_tokens → {VOCAB_SIZE}")

log.info("Step 2: Load fine-tuned weights...")
state_dict = torch.load(str(PT_FILE), map_location="cpu")
if isinstance(state_dict, dict):
    for key in ("model_state_dict", "state_dict", "model"):
        if key in state_dict:
            state_dict = state_dict[key]
            break

missing, unexpected = model.load_state_dict(state_dict, strict=False)
log.info(f"  missing={len(missing)} unexpected={len(unexpected)}")
if missing:
    log.warning(f"  Missing: {missing[:3]}")

log.info(f"Step 3: Save to {OUTPUT_DIR} as safetensors...")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Update config to reflect custom vocab BEFORE saving
model.config.decoder.vocab_size = VOCAB_SIZE
model.config.decoder_start_token_id = 1   # <bos>
model.config.pad_token_id = 0             # <pad>
model.config.eos_token_id = 2             # <eos>
model.generation_config.decoder_start_token_id = 1
model.generation_config.pad_token_id = 0
model.generation_config.eos_token_id = 2

model.save_pretrained(str(OUTPUT_DIR), safe_serialization=True)

# Save processor (image processor only — we use custom tokenizer)
processor = TrOCRProcessor.from_pretrained(BASE_MODEL)
processor.image_processor.save_pretrained(str(OUTPUT_DIR))

# Save vocab
import shutil
shutil.copy("OCR_MODEL/amharic_vocab.json", OUTPUT_DIR / "amharic_vocab.json")

log.info("Done! Model saved to OCR_MODEL/hf_model/")
log.info("Files:")
for f in sorted(OUTPUT_DIR.iterdir()):
    log.info(f"  {f.name}  ({f.stat().st_size / 1024 / 1024:.1f} MB)")
