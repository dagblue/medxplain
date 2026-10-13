"""
tokenizer.py
============
Custom character-level tokenizer for the Amharic TrOCR model.

Built from amharic_vocab.json — 324 tokens:
  0: <pad>
  1: <bos>
  2: <eos>
  3-38: punctuation, digits, ASCII symbols
  39-321: Ethiopic characters
  322-323: Ethiopic punctuation / numerals
  323: <unk_323>
"""

import json
from pathlib import Path
from typing import List, Optional, Union


_THIS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent.parent
VOCAB_PATH = _PROJECT_ROOT / "OCR_MODEL" / "amharic_vocab.json"

PAD_TOKEN  = "<pad>"
BOS_TOKEN  = "<bos>"
EOS_TOKEN  = "<eos>"
UNK_TOKEN  = "<unk_323>"


class AmharicTokenizer:
    """
    Simple character-level tokenizer for Amharic OCR output.

    Encodes: string → list of token IDs
    Decodes: list of token IDs → string
    """

    def __init__(self, vocab_path: Optional[Path] = None):
        path = vocab_path or VOCAB_PATH
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.vocab: List[str] = data["vocab"]
        self.token2id = {tok: i for i, tok in enumerate(self.vocab)}
        self.id2token = {i: tok for i, tok in enumerate(self.vocab)}

        self.pad_token_id = self.token2id[PAD_TOKEN]
        self.bos_token_id = self.token2id[BOS_TOKEN]
        self.eos_token_id = self.token2id[EOS_TOKEN]
        self.unk_token_id = self.token2id.get(UNK_TOKEN, len(self.vocab) - 1)

        self.vocab_size = len(self.vocab)

    def encode(self, text: str, add_special_tokens: bool = True) -> List[int]:
        """Convert string to token IDs."""
        ids = []
        if add_special_tokens:
            ids.append(self.bos_token_id)
        for char in text:
            ids.append(self.token2id.get(char, self.unk_token_id))
        if add_special_tokens:
            ids.append(self.eos_token_id)
        return ids

    def decode(self, ids: List[int], skip_special_tokens: bool = True) -> str:
        """Convert token IDs back to string."""
        special = {self.pad_token_id, self.bos_token_id, self.eos_token_id, self.unk_token_id}
        chars = []
        for i in ids:
            if skip_special_tokens and i in special:
                continue
            token = self.id2token.get(i, "")
            if token and not (skip_special_tokens and token.startswith("<")):
                chars.append(token)
        return "".join(chars)

    def batch_decode(self, batch_ids: List[List[int]], skip_special_tokens: bool = True) -> List[str]:
        """Decode a batch of token ID sequences."""
        return [self.decode(ids, skip_special_tokens) for ids in batch_ids]

    def __len__(self):
        return self.vocab_size

    def __repr__(self):
        return f"AmharicTokenizer(vocab_size={self.vocab_size})"


# Singleton
_tokenizer: Optional[AmharicTokenizer] = None

def get_tokenizer() -> AmharicTokenizer:
    global _tokenizer
    if _tokenizer is None:
        _tokenizer = AmharicTokenizer()
    return _tokenizer
