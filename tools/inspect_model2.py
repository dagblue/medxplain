import pickle
import struct
import zipfile
import os

path = "OCR_MODEL/best_model (1).pt"
print("File size:", os.path.getsize(path), "bytes")

# .pt files are zip archives
try:
    with zipfile.ZipFile(path, 'r') as z:
        print("ZIP contents:")
        for name in z.namelist():
            print(" ", name)
except Exception as e:
    print("Not a zip:", e)
