# Pulse model: fine-tuned XLM-RoBERTa

This folder holds the sentiment model used by the **Pulse** agent, and the code that trained it.

| | |
|---|---|
| Base model | `FacebookAI/xlm-roberta-base` (100 languages, including Urdu) |
| Task | 3-way sentiment: negative · neutral · positive |
| Input | Roman Urdu, English, or a mix (Urdu script also works) |
| Shipped format | ONNX, dynamic int8 quantization (per-channel), 123 MB |
| Runs on | `onnxruntime-web` (WebAssembly) inside the Vercel function |

## Results

All scores are on data the model never saw during training. Run one review at a time, exactly as the website runs it.

| Test set | Before review training | Final model (int8) |
|---|---|---|
| 60 real-style reviews (`training/review_set.py` → `TEST`) | 58.3% accuracy | **81.7% accuracy**, 81.2% macro F1 |
| 2,931 public Roman Urdu sentences | 63.3% accuracy | 62.6% accuracy, 61.9% macro F1 |

The int8 model gives the same review-test accuracy as the full-precision model (489 MB). Details are in [`runtime/model_card.json`](runtime/model_card.json).

## How it was trained

1. **Stage 1, language** (`training/train_jax.py`): 2 epochs on 16,663 sentences from the Roman Urdu Data Set (UCI Machine Learning Repository, via `community-datasets/roman_urdu`) plus 30 samples from `data/sample_reviews.csv`. 85/15 stratified split, AdamW, learning rate 2e-5 with warm-up and cosine decay, batch 16, sequences up to 64 tokens. Training is in JAX on CPU: the 12 layers run with `lax.scan` and gradient checkpointing, and the word embeddings are frozen and pruned to the 47,204 pieces the data uses.
2. **Stage 2, reviews** (`training/domain_tune.py`): one pass over 154 hand-written customer reviews (restaurants, delivery, online stores, hotels, salons, clinics; sarcasm labelled by its real meaning) repeated 4 times and mixed with 3,000 public sentences so the model keeps what it learned. Learning rate 1.5e-5.
3. **Export** (`training/export_onnx.py`): builds the ONNX graph by hand (opset 17), quantizes MatMul and Gather weights to int8 per channel, and re-measures both test sets.

The JavaScript tokenizer in `api/_lib/pulse-model.js` matches the Hugging Face tokenizer exactly (`training/parity.mjs`).

## Reproduce

```bash
pip install -r requirements.txt
# put xlm-roberta-base (config.json, tokenizer.json, model.safetensors) in ./base
# and the Roman Urdu dataset as ./roman_urdu.parquet, then:
python training/train_jax.py 2          # stage 1  -> out/
python training/domain_tune.py          # stage 2  -> out2/
python training/export_onnx.py out2     # ONNX     -> out/onnx/
split -b 62000000 -d -a 1 out/onnx/reviewmind-sentiment.int8.onnx runtime/pulse.int8.onnx.part
# rename part0 -> part1 and part1 -> part2, copy vocab.json and model_card.json into runtime/
```

## Data notes

The public dataset is short social-media text with noisy labels, which caps its score. Check the dataset's license before any commercial use. To adapt the model for a client, add their labelled reviews to `review_set.py` (or a CSV) and run stage 2 again: it takes about 10 minutes on a CPU.
