import json

nb = {"nbformat":4,"nbformat_minor":0,
      "metadata":{"kernelspec":{"display_name":"Python 3","language":"python","name":"python3"},
                  "kaggle":{"accelerator":"gpu","isInternetEnabled":True,"language":"python","sourceType":"notebook"}},
      "cells":[]}

def code(src): nb["cells"].append({"cell_type":"code","metadata":{},"execution_count":None,"outputs":[],"source":src})
def md(src):   nb["cells"].append({"cell_type":"markdown","metadata":{},"source":src})

md("# MedXplain Cell OCR Debug\nStandalone — no server needed. Run top to bottom.")

code("!pip install -q transformers torch torchvision opencv-python-headless pillow editdistance")

code("""
import os, shutil, json, torch, numpy as np
from pathlib import Path
from PIL import Image

MODEL_DIR = Path('/kaggle/working/MODELS')
MODEL_DIR.mkdir(exist_ok=True)

for f in ['trocr_cell_v2_best.pt','amharic_vocab_expanded.json','tt_best_clinical.pt']:
    for root,dirs,fnames in os.walk('/kaggle/input'):
        if f in fnames:
            dst = MODEL_DIR/f
            shutil.copy(os.path.join(root,f), dst)
            print(f'OK: {f} ({dst.stat().st_size/1024/1024:.1f} MB)')
            break
    else:
        print(f'MISSING: {f}')
""".strip())

code("""
with open(MODEL_DIR/'amharic_vocab_expanded.json', encoding='utf-8') as f:
    vocab = json.load(f)['vocab']
id2tok = {i:t for i,t in enumerate(vocab)}
tok2id = {t:i for i,t in enumerate(vocab)}
VOCAB_SIZE = len(vocab)
PAD,BOS,EOS = 0,1,2
print(f'Vocab size: {VOCAB_SIZE}')
print(f'First 5: {vocab[:5]}')

# Roundtrip test
for test in ['አበበ','ሀሎ','123']:
    ids = [tok2id[c] for c in test if c in tok2id]
    dec = ''.join(id2tok.get(i,'') for i in ids if i not in {PAD,BOS,EOS})
    print(f'  {"OK" if dec==test else "FAIL"} {repr(test)} -> {repr(dec)}')

# Checkpoint check
sd = torch.load(str(MODEL_DIR/'trocr_cell_v2_best.pt'), map_location='cpu')
emb = sd['decoder.model.decoder.embed_tokens.weight']
print(f'Checkpoint vocab: {emb.shape[0]}  Match: {emb.shape[0]==VOCAB_SIZE}')
""".strip())

code("""
import torch.nn as nn
from transformers import VisionEncoderDecoderModel, ViTImageProcessor
from transformers import TableTransformerForObjectDetection, AutoImageProcessor

DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f'Device: {DEVICE}')
BASE = 'microsoft/trocr-base-handwritten'

# Cell TrOCR
cell_model = VisionEncoderDecoderModel.from_pretrained(BASE)
cell_sd = torch.load(str(MODEL_DIR/'trocr_cell_v2_best.pt'), map_location='cpu')
CELL_V = cell_sd['decoder.model.decoder.embed_tokens.weight'].shape[0]
cell_model.decoder.resize_token_embeddings(CELL_V)
cell_model.config.decoder_start_token_id = BOS
cell_model.config.pad_token_id = PAD
cell_model.config.eos_token_id = EOS
cell_model.load_state_dict(cell_sd, strict=True)
cell_model.to(DEVICE).eval()
cell_proc = ViTImageProcessor.from_pretrained(BASE)
if CELL_V > VOCAB_SIZE:
    for i in range(VOCAB_SIZE, CELL_V): id2tok[i] = f'<unk_{i}>'
print(f'TrOCR ready | vocab={CELL_V}')

# TableTransformer
TT_BASE = 'microsoft/table-transformer-structure-recognition'
tt_proc  = AutoImageProcessor.from_pretrained(TT_BASE, use_fast=False)
tt_model = TableTransformerForObjectDetection.from_pretrained(TT_BASE)
tt_sd = torch.load(str(MODEL_DIR/'tt_best_clinical.pt'), map_location='cpu')
if isinstance(tt_sd,dict):
    for k in ('model_state_dict','state_dict','model'):
        if k in tt_sd: tt_sd=tt_sd[k]; break
tt_model.load_state_dict(tt_sd, strict=False)
tt_model.to(DEVICE).eval()
print('TableTransformer ready')
""".strip())

code("""
TABLE_LABELS={0:'table',1:'table column',2:'table row',3:'table column header',
              4:'table projected row header',5:'table spanning cell',6:'no object'}

def decode(ids):
    return ''.join(id2tok.get(i,'') for i in ids
                   if i not in {PAD,BOS,EOS} and not id2tok.get(i,'').startswith('<'))

def detect_cells(pil_img, thr=0.4):
    inp = tt_proc(images=pil_img, return_tensors='pt').to(DEVICE)
    with torch.no_grad(): out = tt_model(**inp)
    res = tt_proc.post_process_object_detection(out, threshold=thr,
              target_sizes=torch.tensor([pil_img.size[::-1]]))[0]
    return [{'label':TABLE_LABELS.get(l.item(),'?'),'score':round(float(s),3),
             'box':[round(float(v)) for v in b]}
            for s,l,b in zip(res['scores'],res['labels'],res['boxes'])
            if TABLE_LABELS.get(l.item(),'?') != 'no object']

def extract_cells(pil_img, dets, pad=8):
    w,h = pil_img.size
    rows = sorted([d for d in dets if d['label']=='table row'],    key=lambda d:d['box'][1])
    cols = sorted([d for d in dets if d['label']=='table column'], key=lambda d:d['box'][0])
    if not rows or not cols:
        return [{'row':0,'col':i,'image':pil_img.crop([max(0,d['box'][0]-pad),max(0,d['box'][1]-pad),
                 min(w,d['box'][2]+pad),min(h,d['box'][3]+pad)]),'box':d['box']} for i,d in enumerate(dets)]
    cells=[]
    for ri,row in enumerate(rows):
        for ci,col in enumerate(cols):
            x1,y1=max(0,col['box'][0]-pad),max(0,row['box'][1]-pad)
            x2,y2=min(w,col['box'][2]+pad),min(h,row['box'][3]+pad)
            if x2-x1>=5 and y2-y1>=5:
                cells.append({'row':ri,'col':ci,'image':pil_img.crop((x1,y1,x2,y2)),'box':[x1,y1,x2,y2]})
    return cells

def read_cell(crop, verbose=False):
    img = crop.convert('RGB')
    w,h = img.size
    if h<16: img=img.resize((max(32,w*32//max(h,1)),32),Image.LANCZOS)
    pv = cell_proc(images=img, return_tensors='pt').pixel_values.to(DEVICE)
    with torch.no_grad():
        out = cell_model.generate(pv, num_beams=4, max_new_tokens=20,
                                   decoder_start_token_id=BOS, pad_token_id=PAD, eos_token_id=EOS)
    raw = out[0].tolist()
    text = decode(raw)
    if verbose:
        print(f'  raw={raw}')
        print(f'  chars={[id2tok.get(i,f"<{i}>") for i in raw]}')
    return text

print('Helpers ready')
""".strip())

code("""
# ── UPLOAD AND TEST ──────────────────────────────────────────────────────────
import ipywidgets as widgets
from IPython.display import display, clear_output
import io

upload_btn = widgets.FileUpload(accept='image/*', multiple=False)
out = widgets.Output()
display(upload_btn, out)

def on_upload(change):
    with out:
        clear_output()
        if not upload_btn.value: return
        fname = list(upload_btn.value.keys())[0]
        data  = upload_btn.value[fname]['content']
        img   = Image.open(io.BytesIO(data)).convert('RGB')
        print(f'Image: {fname}  size={img.size}')

        # Detect
        dets  = detect_cells(img, thr=0.4)
        rows  = [d for d in dets if d['label']=='table row']
        cols  = [d for d in dets if d['label']=='table column']
        print(f'Detected: {len(dets)} regions  ({len(rows)} rows, {len(cols)} cols)')

        cells = extract_cells(img, dets)
        print(f'Extracted: {len(cells)} cell crops')

        # Show + decode first 10
        print('\\n--- First 10 cells ---')
        for i,cell in enumerate(cells[:10]):
            crop = cell['image']
            print(f'\\nCell {i}  row={cell["row"]} col={cell["col"]}  size={crop.size}')
            display(crop)
            text = read_cell(crop, verbose=True)
            print(f'  => {repr(text)}')

        # Full table
        print('\\n--- Full table ---')
        results = [{'row':c['row'],'col':c['col'],'text':read_cell(c['image'])} for c in cells]
        if results:
            mr=max(r['row'] for r in results)+1
            mc=max(r['col'] for r in results)+1
            table=[['']*mc for _ in range(mr)]
            for r in results: table[r['row']][r['col']]=r['text']
            for ri,row in enumerate(table):
                print(f'Row {ri}: {row}')

upload_btn.observe(on_upload, names='value')
print('Upload a clinical form image above ↑')
""".strip())

with open('D:/medxplain/kaggle_debug_notebook.ipynb','w',encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)
print("Generated: kaggle_debug_notebook.ipynb")
