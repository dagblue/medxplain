"""Run this once to generate both colab_gpu_server.ipynb and kaggle_gpu_server.ipynb"""
import json, copy

cells = []

# ── Markdown header ──────────────────────────────────────────────────────────
cells.append({
    "cell_type": "markdown",
    "metadata": {},
    "source": (
        "# MedXplain Unified GPU Server\n"
        "**One notebook — all models — one T4 GPU**\n\n"
        "Serves two route groups on port 8000:\n"
        "- `/ocr/*` — Amharic TrOCR (doctor AI tab)\n"
        "- `/digitize/*` — TableTransformer + TrOCR cell reader (receptionist)\n\n"
        "**Steps:**\n"
        "1. Runtime → Change runtime type → T4 GPU\n"
        "2. Run Cell 1 (install)\n"
        "3. Run Cell 2 (load models from Drive)\n"
        "4. Paste your ngrok token in Cell 3 and run\n"
        "5. Copy the URL → set both `AI_SERVICE_URL` and `DIGITIZATION_SERVICE_URL` in `.env`"
    )
})

# ── Cell 1: Install ───────────────────────────────────────────────────────────
cells.append({
    "cell_type": "code",
    "metadata": {},
    "execution_count": None,
    "outputs": [],
    "source": (
        "# Pin transformers==4.39.3 to avoid _prepare_special_tokens CUDA crash on T4\n"
        "!pip install -q transformers==4.39.3\n"
        "!pip install -q fastapi uvicorn pyngrok nest-asyncio \\\n"
        "    torch torchvision \\\n"
        "    opencv-python-headless pillow numpy pandas \\\n"
        "    python-multipart safetensors accelerate"
    )
})

# ── Cell 2: Load from Drive ───────────────────────────────────────────────────
cells.append({
    "cell_type": "code",
    "metadata": {},
    "execution_count": None,
    "outputs": [],
    "source": (
        "from google.colab import drive\n"
        "import shutil, os\n"
        "drive.mount('/drive')\n"
        "\n"
        "DRIVE = '/drive/MyDrive'  # change if your files are in a subfolder\n"
        "os.makedirs('/content/MODELS', exist_ok=True)\n"
        "\n"
        "files = [\n"
        "    'best_model (1).pt',          # Amharic TrOCR weights\n"
        "    'amharic_vocab.json',          # Amharic vocab (324 tokens)\n"
        "    'tt_best_clinical.pt',         # TableTransformer weights\n"
        "    'trocr_cell_v2_best.pt',       # TrOCR cell reader weights\n"
        "    'amharic_vocab_expanded.json', # Expanded vocab (324+ tokens)\n"
        "]\n"
        "\n"
        "for f in files:\n"
        "    src = f'{DRIVE}/{f}'\n"
        "    dst = f'/content/MODELS/{f}'\n"
        "    if os.path.exists(src):\n"
        "        shutil.copy(src, dst)\n"
        "        print(f'OK: {f} ({os.path.getsize(dst)/1024/1024:.1f} MB)')\n"
        "    else:\n"
        "        print(f'MISSING in Drive: {f}')\n"
        "\n"
        "print('\\nAll files:')\n"
        "!ls -lh /content/MODELS/"
    )
})

# ── Cell 3: Unified server ────────────────────────────────────────────────────
server_code = r'''
import json, re, time, os, numpy as np, cv2, torch, torch.nn as nn
import uvicorn, nest_asyncio
from pathlib import Path
from PIL import Image
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pyngrok import ngrok
from transformers import (
    VisionEncoderDecoderModel, ViTImageProcessor,
    TableTransformerForObjectDetection, DetrImageProcessor,
)

nest_asyncio.apply()
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
MODEL_DIR = Path('/content/MODELS')
print(f'Device: {DEVICE}')

# ═══════════════════════════════════════════════════════════════
# SHARED: Tokenizer helpers
# ═══════════════════════════════════════════════════════════════

def load_vocab(path):
    with open(path) as f:
        data = json.load(f)
    vocab = data['vocab'] if isinstance(data, dict) else data
    return vocab, {i: t for i, t in enumerate(vocab)}, len(vocab)

# Amharic vocab (for TrOCR handwritten)
am_vocab, am_id2tok, AM_VOCAB_SIZE = load_vocab(MODEL_DIR / 'amharic_vocab.json')
# Expanded vocab (for TrOCR cell reader)
ex_vocab, ex_id2tok, EX_VOCAB_SIZE = load_vocab(MODEL_DIR / 'amharic_vocab_expanded.json')
PAD, BOS, EOS = 0, 1, 2

def decode(ids, id2tok):
    special = {PAD, BOS, EOS}
    return ''.join(id2tok.get(i,'') for i in ids
                   if i not in special and not id2tok.get(i,'').startswith('<'))

# ═══════════════════════════════════════════════════════════════
# MODEL 1: Amharic TrOCR (doctor OCR)
# ═══════════════════════════════════════════════════════════════

def resize_vocab(model, vocab_size):
    dec = model.decoder
    if hasattr(dec, 'output_projection'):
        h = dec.output_projection.weight.shape[1]
        dec.output_projection = nn.Linear(h, vocab_size, bias=False)
    if hasattr(dec.model, 'decoder') and hasattr(dec.model.decoder, 'embed_tokens'):
        emb = dec.model.decoder.embed_tokens
        if emb.weight.shape[0] != vocab_size:
            dec.model.decoder.embed_tokens = nn.Embedding(vocab_size, emb.embedding_dim)

print('Loading Amharic TrOCR...')
t0 = time.time()
BASE = 'microsoft/trocr-base-handwritten'
am_model = VisionEncoderDecoderModel.from_pretrained(BASE)
resize_vocab(am_model, AM_VOCAB_SIZE)
sd = torch.load(str(MODEL_DIR / 'best_model (1).pt'), map_location='cpu')
am_model.load_state_dict(sd, strict=False)
for attr in ('decoder_start_token_id','pad_token_id','eos_token_id'):
    val = BOS if 'start' in attr else (PAD if 'pad' in attr else EOS)
    setattr(am_model.config, attr, val)
    setattr(am_model.generation_config, attr, val)
# Disable forced_eos to avoid torch.isin CUDA compatibility issue
am_model.generation_config.forced_eos_token_id = None
am_model.generation_config.suppress_tokens = None
am_model.to(DEVICE).eval()
am_proc = ViTImageProcessor.from_pretrained(BASE)
print(f'Amharic TrOCR ready in {time.time()-t0:.1f}s | vocab={AM_VOCAB_SIZE}')

# ═══════════════════════════════════════════════════════════════
# MODEL 2: TableTransformer
# ═══════════════════════════════════════════════════════════════

print('Loading TableTransformer...')
t0 = time.time()
TT_BASE = 'microsoft/table-transformer-structure-recognition'
tt_proc = DetrImageProcessor.from_pretrained(TT_BASE)
tt_model = TableTransformerForObjectDetection.from_pretrained(TT_BASE)
sd = torch.load(str(MODEL_DIR / 'tt_best_clinical.pt'), map_location='cpu')
if isinstance(sd, dict):
    for k in ('model_state_dict','state_dict','model'):
        if k in sd: sd = sd[k]; break
tt_model.load_state_dict(sd, strict=False)
tt_model.to(DEVICE).eval()
print(f'TableTransformer ready in {time.time()-t0:.1f}s')

# ═══════════════════════════════════════════════════════════════
# MODEL 3: TrOCR cell reader
# ═══════════════════════════════════════════════════════════════

print('Loading TrOCR cell reader...')
t0 = time.time()
cell_model = VisionEncoderDecoderModel.from_pretrained(BASE)

# Read actual vocab size from the checkpoint itself
cell_sd = torch.load(str(MODEL_DIR / 'trocr_cell_v2_best.pt'), map_location='cpu')
if isinstance(cell_sd, dict):
    for k in ('model_state_dict','state_dict','model'):
        if k in cell_sd: cell_sd = cell_sd[k]; break
# Get true vocab size from the output projection weight shape
CELL_VOCAB_SIZE = cell_sd['decoder.output_projection.weight'].shape[0]
print(f'Cell model vocab size from checkpoint: {CELL_VOCAB_SIZE}')

resize_vocab(cell_model, CELL_VOCAB_SIZE)
cell_model.load_state_dict(cell_sd, strict=False)
for attr in ('decoder_start_token_id','pad_token_id','eos_token_id'):
    val = BOS if 'start' in attr else (PAD if 'pad' in attr else EOS)
    setattr(cell_model.config, attr, val)
    setattr(cell_model.generation_config, attr, val)
cell_model.to(DEVICE).eval()
# Disable forced_eos to avoid torch.isin CUDA compatibility issue
cell_model.generation_config.forced_eos_token_id = None
cell_model.generation_config.suppress_tokens = None
cell_proc = ViTImageProcessor.from_pretrained(BASE)

# Build id2tok for cell model — pad to actual checkpoint vocab size if needed
if CELL_VOCAB_SIZE > EX_VOCAB_SIZE:
    for i in range(EX_VOCAB_SIZE, CELL_VOCAB_SIZE):
        ex_id2tok[i] = f'<unk_{i}>'
elif CELL_VOCAB_SIZE < EX_VOCAB_SIZE:
    ex_id2tok = {i: t for i, t in ex_id2tok.items() if i < CELL_VOCAB_SIZE}

print(f'TrOCR cell reader ready in {time.time()-t0:.1f}s | vocab={CELL_VOCAB_SIZE}')

# ═══════════════════════════════════════════════════════════════
# SHARED: Preprocessing
# ═══════════════════════════════════════════════════════════════

def preprocess_image(img_bytes):
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.fastNlMeansDenoising(gray, h=10)
    binary = cv2.adaptiveThreshold(gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10)
    return binary, img

def segment_lines(binary):
    proj = np.sum(binary == 0, axis=1)
    lines, in_line, start, gap = [], False, 0, 0
    for y, cnt in enumerate(proj):
        if cnt >= 1:
            if not in_line: in_line, start = True, y
            gap = 0
        else:
            if in_line:
                gap += 1
                if gap >= 3:
                    if y - gap - start >= 8: lines.append((start, y - gap))
                    in_line = False
    if in_line and len(proj) - start >= 8:
        lines.append((start, len(proj) - 1))
    return lines

def crop_line(binary, y1, y2, pad=2):
    h, w = binary.shape
    strip = binary[max(0,y1-pad):min(h,y2+pad), :]
    cols = np.where(np.sum(strip==0, axis=0) > 0)[0]
    if len(cols) == 0: return None
    x1, x2 = max(0, cols[0]-pad), min(w, cols[-1]+pad)
    line = binary[max(0,y1-pad):min(h,y2+pad), x1:x2]
    # Skip lines that are too narrow (likely noise or single punctuation)
    if line.shape[1] < 10: return None
    th = 32
    scale = th / line.shape[0]
    nw = max(64, min(1024, int(line.shape[1] * scale)))  # min 64px wide
    resized = cv2.resize(line, (nw, th), interpolation=cv2.INTER_LINEAR)
    return cv2.cvtColor(resized, cv2.COLOR_GRAY2RGB)

def is_likely_hallucination(text, conf):
    """Filter out likely hallucinated outputs."""
    if not text.strip(): return True
    # Very short output with low confidence = hallucination
    if len(text.strip()) <= 2 and conf < 0.85: return True
    # Repeated character pattern (e.g. "ሀሀሀሀሀ") = hallucination
    if len(set(text.replace(' ',''))) <= 2 and len(text) > 4: return True
    return False

def confidence_from_scores(scores):
    if not scores: return 1.0
    return float(np.mean([float(torch.softmax(s,-1)[0].max()) for s in scores]))

# ═══════════════════════════════════════════════════════════════
# LANGUAGE DETECTION
# ═══════════════════════════════════════════════════════════════

ETHIOPIC = re.compile(r'[\u1200-\u137F\u1380-\u139F]')

def detect_language(text):
    if not text.strip():
        return {'language':'unknown','is_amharic':False,'is_english':False,'ethiopic_ratio':0.0}
    eth = len(ETHIOPIC.findall(text))
    alpha = sum(1 for c in text if c.isalpha())
    ratio = eth / alpha if alpha > 0 else 0
    if ratio >= 0.1:
        return {'language':'am','is_amharic':True,'is_english':False,'ethiopic_ratio':round(ratio,3)}
    return {'language':'en','is_amharic':False,'is_english':True,'ethiopic_ratio':round(ratio,3)}

# ═══════════════════════════════════════════════════════════════
# TABLE DETECTION HELPERS
# ═══════════════════════════════════════════════════════════════

TABLE_LABELS = {0:'table',1:'table column',2:'table row',3:'table column header',
                4:'table projected row header',5:'table spanning cell',6:'no object'}

def detect_cells(pil_img, threshold=0.5):
    inputs = tt_proc(images=pil_img, return_tensors='pt').to(DEVICE)
    with torch.no_grad():
        outputs = tt_model(**inputs)
    target_sizes = torch.tensor([pil_img.size[::-1]])
    results = tt_proc.post_process_object_detection(outputs, threshold=threshold, target_sizes=target_sizes)[0]
    dets = []
    for score, label, box in zip(results['scores'], results['labels'], results['boxes']):
        lname = TABLE_LABELS.get(label.item(), 'unknown')
        if lname != 'no object':
            dets.append({'label':lname,'score':round(float(score),4),'box':[round(float(v)) for v in box]})
    return dets

def extract_cell_regions(pil_img, dets, pad=4):
    w, h = pil_img.size
    rows = sorted([d for d in dets if d['label']=='table row'], key=lambda d: d['box'][1])
    cols = sorted([d for d in dets if d['label']=='table column'], key=lambda d: d['box'][0])

    # If only 1 row detected, the form likely has a different structure.
    # Fall back to position-based cell assignment using bounding boxes directly.
    if len(rows) <= 1 or len(cols) == 0:
        # Use all non-row, non-col detections as individual cells
        # OR use the column detections as cells sorted by position
        cell_dets = [d for d in dets if d['label'] in ('table column','table column header','table spanning cell')]
        if not cell_dets:
            cell_dets = dets

        # Sort by Y (top to bottom) then X (left to right)
        cell_dets_sorted = sorted(cell_dets, key=lambda d: (d['box'][1]//30, d['box'][0]))

        # Group into rows by Y proximity (30px tolerance)
        row_groups = []
        current_row = []
        last_y = -999
        for d in cell_dets_sorted:
            cy = (d['box'][1] + d['box'][3]) // 2
            if abs(cy - last_y) > 30 and current_row:
                row_groups.append(sorted(current_row, key=lambda d: d['box'][0]))
                current_row = []
            current_row.append(d)
            last_y = cy
        if current_row:
            row_groups.append(sorted(current_row, key=lambda d: d['box'][0]))

        cells = []
        for ri, row_group in enumerate(row_groups):
            for ci, d in enumerate(row_group):
                x1 = max(0, d['box'][0] - pad)
                y1 = max(0, d['box'][1] - pad)
                x2 = min(w, d['box'][2] + pad)
                y2 = min(h, d['box'][3] + pad)
                if x2-x1 >= 5 and y2-y1 >= 5:
                    cells.append({'row':ri,'col':ci,'image':pil_img.crop((x1,y1,x2,y2)),'box':[x1,y1,x2,y2]})
        return cells

    # Normal case: intersect rows × columns
    cells = []
    for ri, row in enumerate(rows):
        for ci, col in enumerate(cols):
            x1,y1 = max(0,col['box'][0]-pad), max(0,row['box'][1]-pad)
            x2,y2 = min(w,col['box'][2]+pad), min(h,row['box'][3]+pad)
            if x2-x1 >= 5 and y2-y1 >= 5:
                cells.append({'row':ri,'col':ci,'image':pil_img.crop((x1,y1,x2,y2)),'box':[x1,y1,x2,y2]})
    return cells

def read_cell(pil_crop):
    img = pil_crop.convert('RGB')
    w, h = img.size
    if h < 16: img = img.resize((max(32, w*32//max(h,1)), 32), Image.LANCZOS)
    pv = cell_proc(images=img, return_tensors='pt').pixel_values.to(DEVICE)
    with torch.no_grad():
        out = cell_model.generate(
            pv,
            output_scores=True,
            return_dict_in_generate=True,
            max_new_tokens=64,
            forced_eos_token_id=None,
            suppress_tokens=None,
        )
    return decode(out.sequences[0].tolist(), ex_id2tok).strip(), confidence_from_scores(out.scores)

def reconstruct_table(cells):
    if not cells: return []
    mr = max(c['row'] for c in cells)+1
    mc = max(c['col'] for c in cells)+1
    t = [['']*mc for _ in range(mr)]
    for c in cells: t[c['row']][c['col']] = c.get('text','')
    return t

# ═══════════════════════════════════════════════════════════════
# FASTAPI APP
# ═══════════════════════════════════════════════════════════════

app = FastAPI(title='MedXplain Unified GPU Server')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

@app.get('/health')
def health():
    return {'status':'ok','device':DEVICE,'models':['amharic_trocr','table_transformer','trocr_cell']}

# ── OCR routes (doctor AI tab) ─────────────────────────────────────────────

@app.get('/ocr/health')
def ocr_health():
    return {'status':'ready','device':DEVICE,'vocab_size':AM_VOCAB_SIZE}

@app.post('/ocr/detect-language')
async def detect_lang_endpoint(req: dict):
    return detect_language(req.get('text',''))

@app.post('/ocr/document')
async def ocr_document(file: UploadFile = File(...), return_lines: bool = Form(False)):
    t0 = time.time()
    img_bytes = await file.read()
    if not img_bytes: raise HTTPException(400,'Empty file')

    binary, _ = preprocess_image(img_bytes)
    line_bounds = segment_lines(binary)
    if not line_bounds:
        return {'text':'','line_count':0,'processing_time_ms':int((time.time()-t0)*1000)}

    results, texts = [], []
    for i,(y1,y2) in enumerate(line_bounds):
        line_img = crop_line(binary, y1, y2)
        if line_img is None: continue
        pil = Image.fromarray(line_img).convert('RGB')
        pv = am_proc(images=pil, return_tensors='pt').pixel_values.to(DEVICE)
        with torch.no_grad():
            out = am_model.generate(
                pv,
                num_beams=4,
                max_new_tokens=64,
                early_stopping=True,
                decoder_start_token_id=BOS,
                pad_token_id=PAD,
                eos_token_id=EOS,
                forced_eos_token_id=None,
                suppress_tokens=None,
            )
        text = decode(out.sequences[0].tolist(), am_id2tok).strip()
        conf = confidence_from_scores(out.scores if hasattr(out,'scores') else [])
        # Skip likely hallucinations
        if is_likely_hallucination(text, conf): continue
        texts.append(text)
        results.append({'line_index':i,'text':text,'confidence':round(conf,4),'low_confidence':conf<0.70})

    full_text = '\n'.join(t for t in texts if t.strip())
    ms = int((time.time()-t0)*1000)
    print(f'OCR: {len(results)} lines in {ms}ms')
    return {
        'text': full_text,
        'table_text': '',
        'line_results': results if return_lines else [],
        'line_count': len(results),
        'low_confidence_lines': [r['line_index'] for r in results if r['low_confidence']],
        'confidence': {'mean': round(float(np.mean([r['confidence'] for r in results])),4) if results else 0,
                       'total_lines': len(results)},
        'metadata': {'total_lines': len(results)},
        'processing_time_ms': ms,
    }

# ── Digitization routes (receptionist) ────────────────────────────────────

@app.get('/digitize/health')
def digitize_health():
    return {'status':'ready','device':DEVICE,'vocab_size':EX_VOCAB_SIZE,
            'models':['TableTransformer','TrOCR-cell-v2']}

@app.post('/digitize/form')
async def digitize_form(file: UploadFile = File(...), confidence_threshold: float = Form(0.5)):
    t0 = time.time()
    img_bytes = await file.read()
    if not img_bytes: raise HTTPException(400,'Empty file')

    arr = np.frombuffer(img_bytes, np.uint8)
    cv_img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if cv_img is None: raise HTTPException(400,'Could not decode image')
    pil_img = Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB))

    dets = detect_cells(pil_img, confidence_threshold)
    print(f'Detected {len(dets)} regions')
    if not dets:
        return {'table':[],'cells':[],'detections':[],'message':'No table structure detected.',
                'processing_time_ms':int((time.time()-t0)*1000)}

    cell_regions = extract_cell_regions(pil_img, dets)
    print(f'Extracted {len(cell_regions)} cells')

    cell_results = []
    for cell in cell_regions:
        text, conf = read_cell(cell['image'])
        cell_results.append({'row':cell['row'],'col':cell['col'],'text':text,
                              'confidence':round(conf,4),'low_confidence':conf<0.65,'box':cell['box']})

    table = reconstruct_table(cell_results)
    ms = int((time.time()-t0)*1000)
    print(f'Digitization: {len(cell_results)} cells in {ms}ms')
    return {'table':table,'cells':cell_results,'detections':dets,
            'row_count':len(table),'col_count':len(table[0]) if table else 0,
            'cell_count':len(cell_results),'processing_time_ms':ms}

# ═══════════════════════════════════════════════════════════════
# START SERVER
# ═══════════════════════════════════════════════════════════════

NGROK_TOKEN = 'PASTE_YOUR_NGROK_TOKEN_HERE'

ngrok.set_auth_token(NGROK_TOKEN)
tunnel = ngrok.connect(8000)
url = tunnel.public_url

print('='*60)
print(f'UNIFIED GPU SERVER LIVE: {url}')
print('='*60)
print(f'\nSet BOTH in your .env:')
print(f'  AI_SERVICE_URL="{url}"')
print(f'  DIGITIZATION_SERVICE_URL="{url}"')
print(f'\nEndpoints:')
print(f'  GET  {url}/health')
print(f'  GET  {url}/ocr/health')
print(f'  POST {url}/ocr/document')
print(f'  GET  {url}/digitize/health')
print(f'  POST {url}/digitize/form')
print('='*60)

config = uvicorn.Config(app, host='0.0.0.0', port=8000, log_level='info')
server = uvicorn.Server(config)
await server.serve()
'''

cells.append({
    "cell_type": "code",
    "metadata": {},
    "execution_count": None,
    "outputs": [],
    "source": server_code.strip()
})

nb = {
    "nbformat": 4,
    "nbformat_minor": 0,
    "metadata": {
        "colab": {"provenance": [], "gpuType": "T4"},
        "kernelspec": {"name": "python3", "display_name": "Python 3"},
        "accelerator": "GPU"
    },
    "cells": cells
}

with open("colab_gpu_server.ipynb", "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Generated: colab_gpu_server.ipynb")

# ── Generate Kaggle version ───────────────────────────────────────────────────

kaggle_cells = []

# Kaggle markdown header
kaggle_cells.append({
    "cell_type": "markdown",
    "metadata": {},
    "source": (
        "# MedXplain Unified GPU Server — Kaggle\n"
        "**Same as Colab version but uses Kaggle Datasets instead of Google Drive**\n\n"
        "Kaggle gives 30 GPU hours/week (T4) — more generous than Colab free tier.\n\n"
        "**Steps:**\n"
        "1. Upload your 5 model files as a Kaggle Dataset (one time)\n"
        "2. Add that dataset to this notebook\n"
        "3. Run Cell 1 (install)\n"
        "4. Run Cell 2 (verify files)\n"
        "5. Paste ngrok token in Cell 3 and run\n\n"
        "**How to upload model files as Kaggle Dataset:**\n"
        "- Go to kaggle.com → Datasets → New Dataset\n"
        "- Upload: best_model (1).pt, amharic_vocab.json, tt_best_clinical.pt, trocr_cell_v2_best.pt, amharic_vocab_expanded.json\n"
        "- Name it: medxplain-models\n"
        "- Then in this notebook: Add Data → Your Datasets → medxplain-models"
    )
})

# Cell 1: Install (same as Colab)
kaggle_cells.append({
    "cell_type": "code",
    "metadata": {},
    "execution_count": None,
    "outputs": [],
    "source": (
        "!pip install -q fastapi uvicorn pyngrok nest-asyncio \\\n"
        "    torch torchvision transformers \\\n"
        "    opencv-python-headless pillow numpy pandas \\\n"
        "    python-multipart safetensors accelerate"
    )
})

# Cell 2: Verify Kaggle dataset files (different from Colab Drive)
kaggle_cells.append({
    "cell_type": "code",
    "metadata": {},
    "execution_count": None,
    "outputs": [],
    "source": (
        "import os, shutil\n"
        "\n"
        "# Kaggle datasets are mounted at /kaggle/input/<dataset-name>/\n"
        "# Update DATASET_NAME to match what you named your dataset\n"
        "DATASET_NAME = 'medxplain-models'  # change if different\n"
        "DATASET_PATH = f'/kaggle/input/{DATASET_NAME}'\n"
        "MODEL_DIR = '/kaggle/working/MODELS'\n"
        "os.makedirs(MODEL_DIR, exist_ok=True)\n"
        "\n"
        "files = [\n"
        "    'best_model (1).pt',\n"
        "    'amharic_vocab.json',\n"
        "    'tt_best_clinical.pt',\n"
        "    'trocr_cell_v2_best.pt',\n"
        "    'amharic_vocab_expanded.json',\n"
        "]\n"
        "\n"
        "for f in files:\n"
        "    src = f'{DATASET_PATH}/{f}'\n"
        "    dst = f'{MODEL_DIR}/{f}'\n"
        "    if os.path.exists(src):\n"
        "        shutil.copy(src, dst)\n"
        "        print(f'OK: {f} ({os.path.getsize(dst)/1024/1024:.1f} MB)')\n"
        "    else:\n"
        "        # Try searching recursively\n"
        "        found = False\n"
        "        for root, dirs, fnames in os.walk('/kaggle/input'):\n"
        "            if f in fnames:\n"
        "                shutil.copy(os.path.join(root, f), dst)\n"
        "                print(f'OK (found): {f} ({os.path.getsize(dst)/1024/1024:.1f} MB)')\n"
        "                found = True\n"
        "                break\n"
        "        if not found:\n"
        "            print(f'MISSING: {f} — add your dataset to this notebook')\n"
        "\n"
        "print('\\nFiles ready:')\n"
        "!ls -lh /kaggle/working/MODELS/"
    )
})

# Cell 3: Server (same code but MODEL_DIR points to /kaggle/working/MODELS)
kaggle_server_code = server_code.replace(
    "MODEL_DIR = Path('/content/MODELS')",
    "MODEL_DIR = Path('/kaggle/working/MODELS')"
)

kaggle_cells.append({
    "cell_type": "code",
    "metadata": {},
    "execution_count": None,
    "outputs": [],
    "source": kaggle_server_code.strip()
})

kaggle_nb = {
    "nbformat": 4,
    "nbformat_minor": 0,
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.10.0"},
        "kaggle": {
            "accelerator": "gpu",
            "dataSources": [],
            "isInternetEnabled": True,
            "language": "python",
            "sourceType": "notebook"
        }
    },
    "cells": kaggle_cells
}

with open("kaggle_gpu_server.ipynb", "w", encoding="utf-8") as f:
    json.dump(kaggle_nb, f, indent=1, ensure_ascii=False)

print("Generated: kaggle_gpu_server.ipynb")
print("\nDone! Both notebooks generated:")
print("  colab_gpu_server.ipynb  — Google Colab")
print("  kaggle_gpu_server.ipynb — Kaggle (30h/week GPU)")
