import torch

path = "OCR_MODEL/best_model (1).pt"
ckpt = torch.load(path, map_location="cpu")

print("Type:", type(ckpt))

if isinstance(ckpt, dict):
    print("Keys:", list(ckpt.keys()))
    for k, v in ckpt.items():
        if hasattr(v, 'keys'):
            print(f"  {k}: dict with keys {list(v.keys())[:5]}")
        elif hasattr(v, 'shape'):
            print(f"  {k}: tensor {v.shape}")
        else:
            print(f"  {k}: {type(v)} = {str(v)[:100]}")
else:
    print("Not a dict — type:", type(ckpt))
    if hasattr(ckpt, 'config'):
        print("Has config:", ckpt.config)
