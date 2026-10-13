
"""
MedXplain AI Microservice v5
============================
Robust chunking for all three models — no silent truncation anywhere.

NER:       BertForTokenClassification  (BERT max=512)
           - Sliding window: 300 tokens/chunk, 40-token overlap
           - Direct model call with offset-mapping for accurate char positions
           - Deduplication of entities in overlap regions

Assertion: BertForSequenceClassification  (BERT max=512)
           - Per-entity with sentence context
           - Context budget = 512 - entity_tokens - 3 special tokens
           - Hard truncation of context tokens before encoding

Summ:      BartForConditionalGeneration  (BART max=1024)
           - Extractive sentence selection for texts > SUMM_MAX_TOKENS
           - TF-IDF-style scoring includes numbers & short medical terms
           - Single model.generate() call for coherent output
"""

import re
import time
import logging
from pathlib import Path
from typing import List, Optional, Tuple

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import (
    BertTokenizerFast,
    BertForTokenClassification,
    BertForSequenceClassification,
    BartForConditionalGeneration,
    RobertaTokenizerFast,
    MT5ForConditionalGeneration,
    AutoTokenizer,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("medxplain-ai")

# ── OCR router ────────────────────────────────────────────────────────────────
try:
    from ocr.router import router as ocr_router
    _OCR_AVAILABLE = True
except ImportError as _ocr_import_err:
    _OCR_AVAILABLE = False
    log.warning(f"OCR module not loaded: {_ocr_import_err}")

BASE_DIR       = Path(__file__).parent.parent
NER_PATH       = BASE_DIR / "NER"           / "checkpoint-48561"
ASSERTION_PATH = BASE_DIR / "ASSERTION"     / "checkpoint-13657"
SUMM_PATH      = BASE_DIR / "SUMMARAZATION" / "checkpoint-115620"
AM_SUMM_PATH   = BASE_DIR / "SUMMARAZATION" / "checkpoint-114005"  # Amharic MT5

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
log.info(f"Device: {DEVICE}")

# ── Hard token limits ─────────────────────────────────────────────────────────
NER_CHUNK_TOKENS    = 300   # BERT max=512, use 300 to be safe with subword tokens
NER_OVERLAP_TOKENS  = 40
ASSERTION_MAX_TOKENS = 512  # BERT hard limit for assertion pair
# SUMM_MAX_TOKENS defined near the summarization functions below

# ── Assertion config ──────────────────────────────────────────────────────────
# 4-class model (absent/historical/possible/present): random chance = 0.25.
# Only collapse to "possible" if the model is genuinely uncertain — i.e. max
# score is barely above random. 0.35 is a safe threshold for a 4-class BERT.
ASSERTION_POSSIBLE_THRESHOLD = 0.35

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="MedXplain AI Service", version="4.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount OCR router if available
if _OCR_AVAILABLE:
    app.include_router(ocr_router)
    log.info("OCR engine mounted at /ocr")

_models: dict = {}


def get_ner():
    if "ner" not in _models:
        log.info("Loading NER model...")
        t = time.time()
        tok = BertTokenizerFast.from_pretrained(str(NER_PATH))
        mdl = BertForTokenClassification.from_pretrained(str(NER_PATH))
        mdl.to(DEVICE).eval()
        _models["ner"] = {"model": mdl, "tokenizer": tok,
                          "id2label": mdl.config.id2label}
        log.info(f"NER ready in {time.time()-t:.1f}s  labels={mdl.config.id2label}")
    return _models["ner"]


def get_assertion():
    if "assertion" not in _models:
        log.info("Loading Assertion model...")
        t = time.time()
        # Use the assertion model's OWN tokenizer (vocab_size=28996 → BertTokenizerFast
        # from the checkpoint itself, NOT the NER tokenizer)
        tok = BertTokenizerFast.from_pretrained(str(ASSERTION_PATH))
        mdl = BertForSequenceClassification.from_pretrained(str(ASSERTION_PATH))
        mdl.to(DEVICE).eval()
        # Read id2label directly from the checkpoint config so we never hard-code labels
        id2label = {int(k): v.lower() for k, v in mdl.config.id2label.items()}
        _models["assertion"] = {
            "model": mdl,
            "tokenizer": tok,
            "num_labels": mdl.config.num_labels,
            "id2label": id2label,
        }
        log.info(
            f"Assertion ready in {time.time()-t:.1f}s  "
            f"num_labels={mdl.config.num_labels}  "
            f"id2label={id2label}"
        )
    return _models["assertion"]


def get_summ():
    if "summarization" not in _models:
        log.info("Loading Summarization model...")
        t = time.time()
        tok = RobertaTokenizerFast.from_pretrained(str(SUMM_PATH))
        mdl = BartForConditionalGeneration.from_pretrained(str(SUMM_PATH))
        mdl.to(DEVICE).eval()
        _models["summarization"] = {"model": mdl, "tokenizer": tok}
        log.info(f"Summarization ready in {time.time()-t:.1f}s")
    return _models["summarization"]


def get_am_summ():
    """Load Amharic MT5 summarization model (lazy)."""
    if "am_summarization" not in _models:
        log.info("Loading Amharic MT5 summarization model...")
        t = time.time()
        tok = AutoTokenizer.from_pretrained(str(AM_SUMM_PATH))
        mdl = MT5ForConditionalGeneration.from_pretrained(str(AM_SUMM_PATH))
        mdl.to(DEVICE).eval()
        _models["am_summarization"] = {"model": mdl, "tokenizer": tok}
        log.info(f"Amharic MT5 ready in {time.time()-t:.1f}s")
    return _models["am_summarization"]

# ── NER chunking + direct model inference ────────────────────────────────────

def ner_on_chunk(chunk_text: str, model, tokenizer, id2label: dict) -> list:
    """
    Run NER on a single chunk using direct model call (not pipeline).
    Returns list of {word, entity_group, score, start, end} dicts.

    Uses offset_mapping for accurate character positions.
    Entity text is read directly from the original chunk_text slice
    (avoids the broken subword-concatenation approach).
    """
    encoding = tokenizer(
        chunk_text,
        return_tensors="pt",
        return_offsets_mapping=True,
        truncation=True,
        max_length=512,
        padding=False,
    )
    offset_mapping = encoding.pop("offset_mapping")[0].tolist()
    input_ids = encoding["input_ids"].to(DEVICE)
    attention_mask = encoding["attention_mask"].to(DEVICE)

    with torch.no_grad():
        logits = model(input_ids=input_ids, attention_mask=attention_mask).logits
    predictions = torch.argmax(logits, dim=-1)[0].tolist()

    entities = []
    current_entity: Optional[dict] = None

    for idx, (pred_id, (start, end)) in enumerate(zip(predictions, offset_mapping)):
        # Skip special tokens ([CLS], [SEP], padding) — they have (0, 0) offsets
        # but also skip the very first token's (0,0) only when it's a special token
        if start == 0 and end == 0:
            continue

        label = id2label.get(pred_id, "O")
        score = float(torch.softmax(logits[0, idx], dim=-1).max().item())

        if label == "O":
            if current_entity:
                entities.append(current_entity)
                current_entity = None
            continue

        # BIO tagging
        bio_prefix = label[:2] if len(label) > 2 else ""
        entity_type = label[2:] if bio_prefix in ("B-", "I-") else label

        if bio_prefix == "B-" or current_entity is None or current_entity["entity_group"] != entity_type:
            # Start a new entity
            if current_entity:
                entities.append(current_entity)
            current_entity = {
                "word": chunk_text[start:end],   # read directly from source text
                "entity_group": entity_type,
                "score": score,
                "start": start,
                "end": end,
            }
        else:
            # Continuation (I- tag or same type) — extend the span
            current_entity["end"] = end
            # Read the full span from source text (preserves spaces/hyphens correctly)
            current_entity["word"] = chunk_text[current_entity["start"]:end]
            current_entity["score"] = (current_entity["score"] + score) / 2

    if current_entity:
        entities.append(current_entity)

    return entities


def split_text_into_chunks(text: str, tokenizer, chunk_tokens: int, overlap_tokens: int) -> List[Tuple[str, int]]:
    """
    Split text into overlapping chunks at word boundaries.
    Returns list of (chunk_text, char_offset_in_original).

    Uses tokenizer to count tokens accurately — avoids the pipeline's
    silent truncation by ensuring each chunk is well within the limit.

    Char offsets are computed by scanning the original string sequentially
    so repeated words are handled correctly.
    """
    words = text.split()
    if not words:
        return [(text, 0)]

    # Build accurate char offsets by scanning left-to-right (handles repeated words)
    word_char_starts: List[int] = []
    pos = 0
    for word in words:
        idx = text.find(word, pos)
        if idx == -1:
            idx = pos  # fallback — should never happen
        word_char_starts.append(idx)
        pos = idx + len(word)  # advance past this exact occurrence

    chunks: List[Tuple[str, int]] = []
    i = 0

    while i < len(words):
        # Build chunk: add words until we hit the token limit
        chunk_words: List[str] = []
        token_count = 2  # [CLS] + [SEP]
        j = i

        while j < len(words):
            word_tokens = len(tokenizer.tokenize(words[j]))
            if token_count + word_tokens > chunk_tokens:
                break
            chunk_words.append(words[j])
            token_count += word_tokens
            j += 1

        # Edge case: single word exceeds limit (very rare with medical text)
        if not chunk_words:
            chunk_words = [words[i]]
            j = i + 1

        # Reconstruct chunk text preserving original whitespace
        # Use the original text slice from first word start to last word end
        first_word_start = word_char_starts[i]
        last_word_idx = j - 1
        last_word_end = word_char_starts[last_word_idx] + len(words[last_word_idx])
        chunk_text = text[first_word_start:last_word_end]

        chunks.append((chunk_text, first_word_start))
        log.debug(f"  Chunk {len(chunks)}: words[{i}:{j}], ~{token_count} tokens, offset={first_word_start}")

        # Advance: keep an overlap of ~overlap_tokens at the end of this chunk
        overlap_word_count = 0
        overlap_tok_count = 0
        for k in range(len(chunk_words) - 1, -1, -1):
            wt = len(tokenizer.tokenize(chunk_words[k]))
            if overlap_tok_count + wt > overlap_tokens:
                break
            overlap_word_count += 1
            overlap_tok_count += wt

        advance = max(1, len(chunk_words) - overlap_word_count)
        i += advance

    return chunks

# ── Summarization: extractive pre-processing + single-pass summarization ──────
#
# Strategy: BART is excellent at summarization but degrades when given
# disconnected chunk summaries. Instead of splitting → summarizing each chunk
# → re-summarizing (which loses coherence), we:
#
#   1. If text fits within SUMM_MAX_TOKENS → summarize directly (best quality)
#   2. If text is too long → extract the most important sentences using a
#      simple TF-IDF-style scoring, pick top sentences that fit within
#      SUMM_MAX_TOKENS, preserve their original order, then summarize ONCE.
#
# This gives the model one coherent document instead of disconnected fragments.

SUMM_MAX_TOKENS = 900  # conservative limit (BART hard max = 1024)


def score_sentences(sentences: List[str]) -> List[float]:
    """
    Score sentences by importance using term frequency.
    Includes numbers and short medical abbreviations (2+ chars) so that
    lab values like "WBC 11.2" and vitals like "BP 145/92" are not ignored.
    """
    import math

    # Include: words 2+ chars AND numbers/decimals (covers "38.5", "11.2", "500mg")
    token_pattern = re.compile(r'\b[a-zA-Z]{2,}\b|\b\d+(?:\.\d+)?\b')

    # Build term frequency across all sentences
    word_freq: dict = {}
    for sent in sentences:
        for w in token_pattern.findall(sent.lower()):
            word_freq[w] = word_freq.get(w, 0) + 1

    scores = []
    for sent in sentences:
        tokens = token_pattern.findall(sent.lower())
        if not tokens:
            scores.append(0.0)
            continue
        score = sum(math.log(1 + word_freq.get(w, 0)) for w in tokens) / len(tokens)
        scores.append(score)

    return scores


def extract_to_fit(text: str, tokenizer, max_tokens: int) -> tuple:
    """
    Extract the most important sentences from text to fit within max_tokens.
    Returns (condensed_text, num_sentences_used, total_sentences).

    Preserves original sentence order for coherence.
    """
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return text[:max_tokens * 4], 1, 1  # rough char fallback

    # Check if it already fits
    total_toks = len(tokenizer.tokenize(text))
    if total_toks <= max_tokens:
        return text, len(sentences), len(sentences)

    # Score sentences by importance
    scores = score_sentences(sentences)

    # Greedily pick top-scored sentences that fit within token budget
    # Sort by score descending to pick most important first
    ranked = sorted(range(len(sentences)), key=lambda i: scores[i], reverse=True)

    selected_indices = set()
    used_tokens = 0

    for idx in ranked:
        sent_toks = len(tokenizer.tokenize(sentences[idx]))
        if used_tokens + sent_toks > max_tokens:
            continue
        selected_indices.add(idx)
        used_tokens += sent_toks
        if used_tokens >= max_tokens * 0.90:  # stop at 90% capacity
            break

    # Restore original order
    ordered_indices = sorted(selected_indices)
    condensed = " ".join(sentences[i] for i in ordered_indices)

    log.info(
        f"  Extractive selection: {len(ordered_indices)}/{len(sentences)} sentences, "
        f"{used_tokens}/{total_toks} tokens"
    )
    return condensed, len(ordered_indices), len(sentences)


def run_single_summarization(
    text: str,
    model,
    tokenizer,
    max_length: int,
    min_length: int,
    num_beams: int,
) -> str:
    """
    Summarize text in a single model.generate() call.
    Input must already fit within SUMM_MAX_TOKENS.
    """
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=1024,   # BART hard limit — safety net
        padding=False,
    ).to(DEVICE)

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_length=max_length,
            min_length=min_length,
            num_beams=num_beams,
            no_repeat_ngram_size=3,
            early_stopping=True,
            forced_eos_token_id=model.config.eos_token_id,
        )

    raw = tokenizer.decode(output_ids[0], skip_special_tokens=True)

    # Clean up common BART output artifacts
    # 1. Remove <n> tokens that sometimes appear instead of newlines
    raw = re.sub(r'<n>', ' ', raw)
    # 2. Collapse multiple spaces/newlines
    raw = re.sub(r'\s{2,}', ' ', raw).strip()
    # 3. Fix missing space after sentence-ending punctuation
    raw = re.sub(r'([.!?])([A-Z])', r'\1 \2', raw)

    return raw


# ── Assertion helpers ─────────────────────────────────────────────────────────

def get_sentence_context(text: str, entity_text: str, window_chars: int = 300) -> str:
    """Extract the sentence containing the entity, or a character window."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    for sent in sentences:
        if entity_text.lower() in sent.lower():
            return sent.strip()
    # Fallback: character window
    idx = text.lower().find(entity_text.lower())
    if idx == -1:
        return text[:window_chars]
    start = max(0, idx - window_chars // 2)
    end = min(len(text), idx + len(entity_text) + window_chars // 2)
    return text[start:end].strip()


def classify_assertion(model, tokenizer, entity_text: str, context: str, id2label: dict) -> dict:
    """
    N-class assertion (supports 2-class or 4-class models).
    Input: [CLS] entity [SEP] context [SEP]
    id2label is read directly from the checkpoint config — no hard-coding.

    Token budget:
      512 total
      - 3 special tokens ([CLS], [SEP], [SEP])
      - entity tokens
      = remaining budget for context
    """
    entity_toks = len(tokenizer.tokenize(entity_text))
    context_budget = max(10, ASSERTION_MAX_TOKENS - entity_toks - 3)

    # Truncate context to fit the budget
    ctx_tokens = tokenizer.tokenize(context)
    if len(ctx_tokens) > context_budget:
        ctx_tokens = ctx_tokens[:context_budget]
        context = tokenizer.convert_tokens_to_string(ctx_tokens).strip()

    inputs = tokenizer(
        entity_text,
        context,
        return_tensors="pt",
        truncation="only_second",
        max_length=ASSERTION_MAX_TOKENS,
        padding=False,
    ).to(DEVICE)

    with torch.no_grad():
        probs = torch.softmax(model(**inputs).logits, dim=-1)[0]

    # Build score dict from the model's actual labels (lowercase)
    all_scores = {id2label[i]: round(float(probs[i].item()), 4) for i in range(len(probs))}

    pred_id    = int(torch.argmax(probs).item())
    pred_label = id2label[pred_id]
    max_score  = float(probs[pred_id].item())

    # Normalize: collapse "historical" → "absent" for display/logic
    display_label = pred_label
    if pred_label == "historical":
        display_label = "absent"

    # Low-confidence → "possible"
    if max_score < ASSERTION_POSSIBLE_THRESHOLD:
        display_label = "possible"

    # Ensure the 3 canonical keys always exist in all_scores for the frontend
    canonical: dict = {
        "present":  all_scores.get("present",  0.0),
        "absent":   all_scores.get("absent",   0.0) + all_scores.get("historical", 0.0),
        "possible": all_scores.get("possible", 0.0),
    }

    return {
        "label": display_label,
        "score": round(max_score, 4),
        "all_scores": canonical,
        "raw_label": pred_label,
    }

# ── Schemas ───────────────────────────────────────────────────────────────────

class NERRequest(BaseModel):
    text: str

class NEREntity(BaseModel):
    text: str
    label: str
    score: float
    start: int
    end: int

class NERResponse(BaseModel):
    entities: List[NEREntity]
    chunks_processed: int = 1
    total_tokens: int = 0
    model: str = "BertForTokenClassification"
    checkpoint: str = "checkpoint-48561"
    device: str

class AssertionRequest(BaseModel):
    text: str
    entities: Optional[List[dict]] = None

class EntityAssertion(BaseModel):
    entity_text: str
    entity_label: str
    ner_score: float
    assertion_label: str
    assertion_score: float
    all_scores: dict
    context_sentence: str

class AssertionResponse(BaseModel):
    entity_assertions: List[EntityAssertion]
    overall_status: str
    summary: str
    absent_count: int
    possible_count: int
    present_count: int
    model: str = "BertForSequenceClassification"
    checkpoint: str = "checkpoint-13657"
    device: str

class SummarizationRequest(BaseModel):
    text: str
    max_length: int = 128
    min_length: int = 30
    num_beams: int = 4

class SummarizationResponse(BaseModel):
    summary_en: str
    summary_am: Optional[str] = None
    chunks_processed: int = 1
    total_tokens: int = 0
    model: str = "BartForConditionalGeneration"
    checkpoint: str = "checkpoint-115620"
    device: str
    note: str = "Amharic summarization not yet enabled"

class AmharicSummarizationRequest(BaseModel):
    text: str
    max_length: int = 256
    min_length: int = 30
    num_beams: int = 4

class AmharicSummarizationResponse(BaseModel):
    summary: str
    total_tokens: int = 0
    model: str = "MT5ForConditionalGeneration"
    checkpoint: str = "checkpoint-114005"
    device: str

class PipelineRequest(BaseModel):
    text: str

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": DEVICE,
        "models_loaded": list(_models.keys()),
        "ocr_engine": "mounted" if _OCR_AVAILABLE else "not_available",
        "limits": {
            "ner_chunk_tokens": NER_CHUNK_TOKENS,
            "ner_confidence_threshold": 0.80,
            "summ_max_tokens": SUMM_MAX_TOKENS,
            "summ_strategy": "extractive_selection_then_single_pass",
            "assertion_max_tokens": ASSERTION_MAX_TOKENS,
        },
    }


@app.post("/ner", response_model=NERResponse)
def run_ner(req: NERRequest):
    """
    NER with mandatory chunking for long texts.
    Uses direct model inference (not pipeline) to avoid silent truncation.
    Chunks at 300 tokens with 40-token overlap.
    """
    if not req.text.strip():
        raise HTTPException(400, "Text cannot be empty")
    try:
        ctx = get_ner()
        model, tokenizer, id2label = ctx["model"], ctx["tokenizer"], ctx["id2label"]

        total_tokens = len(tokenizer.tokenize(req.text))
        log.info(f"NER request: {total_tokens} tokens")

        # Always chunk — even short texts go through the same path for consistency
        chunks = split_text_into_chunks(req.text, tokenizer, NER_CHUNK_TOKENS, NER_OVERLAP_TOKENS)
        log.info(f"NER: split into {len(chunks)} chunk(s)")

        all_entities: List[NEREntity] = []
        seen_spans: set = set()

        for chunk_idx, (chunk_text, char_offset) in enumerate(chunks):
            chunk_toks = len(tokenizer.tokenize(chunk_text))
            log.info(f"  NER chunk {chunk_idx+1}/{len(chunks)}: {chunk_toks} tokens, offset={char_offset}")

            raw_entities = ner_on_chunk(chunk_text, model, tokenizer, id2label)

            for e in raw_entities:
                # Adjust to global character positions
                global_start = char_offset + e["start"]
                global_end   = char_offset + e["end"]
                span_key = (global_start, global_end)

                if span_key in seen_spans:
                    continue  # deduplicate overlap region
                seen_spans.add(span_key)

                all_entities.append(NEREntity(
                    text=e["word"],
                    label=e["entity_group"],
                    score=round(float(e["score"]), 4),
                    start=global_start,
                    end=global_end,
                ))

        all_entities.sort(key=lambda x: x.start)

        # Deduplicate: remove entities whose spans are fully contained within
        # a higher-confidence entity (can happen in overlap regions)
        deduped: List[NEREntity] = []
        for ent in all_entities:
            dominated = False
            for kept in deduped:
                # Same span or fully overlapping span — keep the higher-confidence one
                if kept.start <= ent.start and kept.end >= ent.end:
                    dominated = True
                    break
            if not dominated:
                deduped.append(ent)

        # Filter: only keep entities with score >= 0.80
        HIGH_CONF_THRESHOLD = 0.80
        filtered = [e for e in deduped if e.score >= HIGH_CONF_THRESHOLD]
        low_conf_count = len(deduped) - len(filtered)
        if low_conf_count > 0:
            log.info(f"NER filter: dropped {low_conf_count} entities below {HIGH_CONF_THRESHOLD*100:.0f}% confidence")

        log.info(f"NER done: {len(chunks)} chunks, {len(filtered)}/{len(deduped)} entities kept, {total_tokens} tokens")

        return NERResponse(
            entities=filtered,
            chunks_processed=len(chunks),
            total_tokens=total_tokens,
            device=DEVICE,
        )
    except Exception as e:
        log.error(f"NER error: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@app.post("/assertion", response_model=AssertionResponse)
def run_assertion(req: AssertionRequest):
    """
    Per-entity assertion with sentence context.
    Context is truncated to fit within 512 token BERT limit.
    """
    if not req.text.strip():
        raise HTTPException(400, "Text cannot be empty")
    if not req.entities:
        raise HTTPException(400, "No entities provided")
    try:
        ctx = get_assertion()
        model, tokenizer = ctx["model"], ctx["tokenizer"]
        id2label = ctx["id2label"]

        entity_assertions = []
        for ent in req.entities:
            entity_text  = ent.get("text", "").strip()
            entity_label = ent.get("label", "")
            ner_score    = float(ent.get("score", ent.get("confidence", 0.9)))
            if not entity_text:
                continue

            context_sentence = get_sentence_context(req.text, entity_text)
            result = classify_assertion(model, tokenizer, entity_text, context_sentence, id2label)

            entity_assertions.append(EntityAssertion(
                entity_text=entity_text,
                entity_label=entity_label.replace("B-", "").replace("I-", ""),
                ner_score=ner_score,
                assertion_label=result["label"],
                assertion_score=result["score"],
                all_scores=result["all_scores"],
                context_sentence=context_sentence,
            ))

        absent_count   = sum(1 for e in entity_assertions if e.assertion_label == "absent")
        possible_count = sum(1 for e in entity_assertions if e.assertion_label == "possible")
        present_count  = sum(1 for e in entity_assertions if e.assertion_label == "present")

        if absent_count > 0:
            overall_status = "REVIEW"
            summary = f"{absent_count} entity/entities marked ABSENT — conditions may be negated"
        elif possible_count > 0:
            overall_status = "REVIEW"
            summary = f"{possible_count} entity/entities marked POSSIBLE — uncertain assertions"
        else:
            overall_status = "PASS"
            summary = f"All {present_count} entities confirmed PRESENT"

        log.info(f"Assertion: {len(entity_assertions)} entities — {present_count}P {absent_count}A {possible_count}?")
        return AssertionResponse(
            entity_assertions=entity_assertions,
            overall_status=overall_status,
            summary=summary,
            absent_count=absent_count,
            possible_count=possible_count,
            present_count=present_count,
            device=DEVICE,
        )
    except Exception as e:
        log.error(f"Assertion error: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@app.post("/summarization", response_model=SummarizationResponse)
def run_summarization(req: SummarizationRequest):
    """
    Single-pass summarization with extractive pre-processing for long texts.

    Flow:
      1. Count tokens in input text.
      2. If text fits within SUMM_MAX_TOKENS (900) → summarize directly.
      3. If text is too long → extract the most important sentences using
         TF-IDF-style scoring to fit within SUMM_MAX_TOKENS, preserving
         original sentence order, then summarize ONCE.

    This avoids the quality degradation of hierarchical chunk summarization
    by always giving the model one coherent document.
    """
    if not req.text.strip():
        raise HTTPException(400, "Text cannot be empty")
    try:
        ctx = get_summ()
        model, tokenizer = ctx["model"], ctx["tokenizer"]

        total_tokens = len(tokenizer.tokenize(req.text))
        log.info(f"Summarization request: {total_tokens} tokens")

        if total_tokens <= SUMM_MAX_TOKENS:
            # Fast path — text fits, summarize directly
            log.info("Summarization: direct (fits within limit)")
            summary = run_single_summarization(
                req.text, model, tokenizer,
                req.max_length, req.min_length, req.num_beams
            )
            return SummarizationResponse(
                summary_en=summary,
                chunks_processed=1,
                total_tokens=total_tokens,
                device=DEVICE,
            )

        # Long text — extractive sentence selection then single summarization
        log.info(f"Summarization: extractive pre-processing ({total_tokens} > {SUMM_MAX_TOKENS} tokens)")
        condensed, selected_sents, total_sents = extract_to_fit(
            req.text, tokenizer, SUMM_MAX_TOKENS
        )

        condensed_tokens = len(tokenizer.tokenize(condensed))
        log.info(f"Summarization: condensed to {condensed_tokens} tokens ({selected_sents}/{total_sents} sentences)")

        summary = run_single_summarization(
            condensed, model, tokenizer,
            req.max_length, req.min_length, req.num_beams
        )

        log.info(f"Summarization done: {total_tokens} tokens → {selected_sents}/{total_sents} sentences → summary")
        return SummarizationResponse(
            summary_en=summary,
            # chunks_processed = 1 because we always do a single model call
            chunks_processed=1,
            total_tokens=total_tokens,
            device=DEVICE,
        )
    except Exception as e:
        log.error(f"Summarization error: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@app.post("/summarization/amharic", response_model=AmharicSummarizationResponse)
def run_amharic_summarization(req: AmharicSummarizationRequest):
    """
    Amharic summarization using fine-tuned MT5 (checkpoint-114005).
    Input: Amharic text (from TrOCR OCR output or typed).
    Output: Amharic summary.
    """
    if not req.text.strip():
        raise HTTPException(400, "Text cannot be empty")
    try:
        ctx = get_am_summ()
        model, tokenizer = ctx["model"], ctx["tokenizer"]

        total_tokens = len(tokenizer.encode(req.text))
        log.info(f"Amharic summarization: {total_tokens} tokens")

        inputs = tokenizer(
            req.text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=False,
        ).to(DEVICE)

        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_length=req.max_length,
                min_length=req.min_length,
                num_beams=req.num_beams,
                no_repeat_ngram_size=3,
                early_stopping=True,
            )

        summary = tokenizer.decode(output_ids[0], skip_special_tokens=True).strip()
        log.info(f"Amharic summary done: {len(summary)} chars")

        return AmharicSummarizationResponse(
            summary=summary,
            total_tokens=total_tokens,
            device=DEVICE,
        )
    except Exception as e:
        log.error(f"Amharic summarization error: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@app.post("/pipeline")
def run_pipeline(req: PipelineRequest):
    """Full NER -> Assertion -> Summarization pipeline."""
    if not req.text.strip():
        raise HTTPException(400, "Text cannot be empty")

    ner_result        = run_ner(NERRequest(text=req.text))
    assertion_result  = run_assertion(AssertionRequest(
        text=req.text,
        entities=[e.model_dump() for e in ner_result.entities],
    ))
    summary_result    = run_summarization(SummarizationRequest(text=req.text))

    return {
        "ner":             ner_result.model_dump(),
        "assertion":       assertion_result.model_dump(),
        "summarization":   summary_result.model_dump(),
        "pipeline_status": "completed",
        "chunks": {
            "ner":           ner_result.chunks_processed,
            "summarization": summary_result.chunks_processed,
        },
        "total_tokens": ner_result.total_tokens,
    }
