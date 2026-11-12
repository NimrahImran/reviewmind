"""Fine-tune XLM-RoBERTa-base for 3-way sentiment with JAX on CPU.

The encoder is written out directly (embeddings → 12 transformer layers → classification
head, exactly as in RobertaForSequenceClassification), loaded from the official
FacebookAI/xlm-roberta-base weights, and trained with AdamW. Word embeddings stay
frozen (they are 70% of the weights and barely change during fine-tuning).

Usage: python3 train_jax.py EPOCHS
"""
import json, math, pickle, random, re, sys, time
from functools import partial
from pathlib import Path

import jax
import jax.numpy as jnp
import numpy as np
import optax
import pandas as pd
from safetensors.numpy import load_file
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from tokenizers import Tokenizer

LABELS = ["negative", "neutral", "positive"]
H, NH, L, EPS = 768, 12, 12, 1e-5
MAXLEN, BS, LR, SEED = 64, 16, 2e-5, 42
TOPK = 40000
BUCKETS = [16, 24, 32, 48, 64]
NORMALIZE = {
    "bht": "bohat", "bhot": "bohat", "bhut": "bohat", "buhat": "bohat", "bahut": "bohat", "bohot": "bohat", "boht": "bohat",
    "achaa": "acha", "accha": "acha", "achha": "acha", "achhi": "achi", "acchi": "achi",
    "nai": "nahi", "nhi": "nahi", "ni": "nahi", "nahin": "nahi", "nae": "nahi",
    "yr": "yaar", "yar": "yaar", "b": "bhi", "bi": "bhi", "h": "hai", "hy": "hai", "hn": "hain",
    "k": "ke", "mn": "main", "zbrdst": "zabardast", "zabrdast": "zabardast", "thk": "theek", "thik": "theek",
    "bkwas": "bakwas", "pr": "par", "sb": "sab", "kr": "kar", "krna": "karna", "plz": "please", "pls": "please",
}


def clean(t):
    t = re.sub(r"[A-Za-z]+", lambda m: NORMALIZE.get(m.group(0).lower(), m.group(0)), str(t))
    t = re.sub(r"https?://\S+", " ", t)
    t = re.sub(r"([!?.])\1{2,}", r"\1", t)
    return re.sub(r"\s+", " ", t).strip()


# ---------------------------------------------------------------- model
def layer_norm(x, g, b):
    m = x.mean(-1, keepdims=True)
    v = ((x - m) ** 2).mean(-1, keepdims=True)
    return (x - m) / jnp.sqrt(v + EPS) * g + b


def dropout(x, rate, key, train):
    if not train or rate == 0:
        return x
    keep = jax.random.bernoulli(key, 1 - rate, x.shape)
    return jnp.where(keep, x / (1 - rate), 0)


def forward(p, word_emb, ids, mask, key, train):
    k_emb, k_layers, k_head = jax.random.split(key, 3)
    pos = jnp.cumsum(mask, axis=1) * mask + 1  # RoBERTa positions start at padding_idx + 1
    x = word_emb[ids] + p["pos"][pos] + p["type"][0]
    x = layer_norm(x, p["emb_ln_g"], p["emb_ln_b"])
    x = dropout(x, 0.1, k_emb, train)
    B, T = ids.shape
    att_bias = (1.0 - mask[:, None, None, :].astype(jnp.float32)) * -1e9

    def heads(t):
        return t.reshape(B, T, NH, H // NH).transpose(0, 2, 1, 3)

    def layer(x, inp):
        q, k = inp
        k1, k2, k3 = jax.random.split(k, 3)
        Q, K, V = heads(x @ q["q_w"] + q["q_b"]), heads(x @ q["k_w"] + q["k_b"]), heads(x @ q["v_w"] + q["v_b"])
        a = jax.nn.softmax(Q @ K.transpose(0, 1, 3, 2) / math.sqrt(H // NH) + att_bias, axis=-1)
        a = dropout(a, 0.1, k1, train)
        ctx = (a @ V).transpose(0, 2, 1, 3).reshape(B, T, H)
        x = layer_norm(dropout(ctx @ q["o_w"] + q["o_b"], 0.1, k2, train) + x, q["ln1_g"], q["ln1_b"])
        h = jax.nn.gelu(x @ q["i_w"] + q["i_b"], approximate=False)
        x = layer_norm(dropout(h @ q["f_w"] + q["f_b"], 0.1, k3, train) + x, q["ln2_g"], q["ln2_b"])
        return x, None

    # One compiled layer, repeated 12 times (keeps compile memory small on CPU).
    layer_fn = jax.checkpoint(layer) if train else layer
    x, _ = jax.lax.scan(layer_fn, x, (p["layers"], jax.random.split(k_layers, L)))
    c = dropout(x[:, 0], 0.1, k_head, train)
    c = jnp.tanh(c @ p["cls_w"] + p["cls_b"])
    c = dropout(c, 0.1, jax.random.fold_in(k_head, 1), train)
    return c @ p["out_w"] + p["out_b"]


def load_base(path):
    w = load_file(path)
    pre = "roberta." if any(k.startswith("roberta.") for k in w) else ""
    g = lambda k: w[pre + k]  # noqa: E731
    T = lambda a: np.ascontiguousarray(a.T)  # noqa: E731  (torch Linear stores [out, in])
    p = {
        "pos": g("embeddings.position_embeddings.weight"),
        "type": g("embeddings.token_type_embeddings.weight"),
        "emb_ln_g": g("embeddings.LayerNorm.weight"),
        "emb_ln_b": g("embeddings.LayerNorm.bias"),
    }
    for i in range(L):
        b = f"encoder.layer.{i}."
        p[f"l{i}"] = {
            "q_w": T(g(b + "attention.self.query.weight")), "q_b": g(b + "attention.self.query.bias"),
            "k_w": T(g(b + "attention.self.key.weight")), "k_b": g(b + "attention.self.key.bias"),
            "v_w": T(g(b + "attention.self.value.weight")), "v_b": g(b + "attention.self.value.bias"),
            "o_w": T(g(b + "attention.output.dense.weight")), "o_b": g(b + "attention.output.dense.bias"),
            "ln1_g": g(b + "attention.output.LayerNorm.weight"), "ln1_b": g(b + "attention.output.LayerNorm.bias"),
            "i_w": T(g(b + "intermediate.dense.weight")), "i_b": g(b + "intermediate.dense.bias"),
            "f_w": T(g(b + "output.dense.weight")), "f_b": g(b + "output.dense.bias"),
            "ln2_g": g(b + "output.LayerNorm.weight"), "ln2_b": g(b + "output.LayerNorm.bias"),
        }
    per_layer = [p.pop(f"l{i}") for i in range(L)]
    p["layers"] = {k: np.stack([lay[k] for lay in per_layer]) for k in per_layer[0]}
    rng = np.random.default_rng(SEED)
    p["cls_w"] = (rng.standard_normal((H, H)) * 0.02).astype(np.float32)
    p["cls_b"] = np.zeros(H, np.float32)
    p["out_w"] = (rng.standard_normal((H, 3)) * 0.02).astype(np.float32)
    p["out_b"] = np.zeros(3, np.float32)
    emb = g("embeddings.word_embeddings.weight")
    del w
    return jax.tree_util.tree_map(jnp.asarray, p), emb


# ---------------------------------------------------------------- data
def load_data(tok):
    raw = pd.read_parquet("roman_urdu.parquet")
    tcol = "sentence" if "sentence" in raw.columns else raw.columns[0]
    lcol = [c for c in raw.columns if c != tcol][0]
    names = {0: "positive", 1: "negative", 2: "neutral"}
    df = pd.DataFrame({"text": raw[tcol].map(clean), "label": raw[lcol].map(names)}).dropna()
    df = df[df.text.str.len() >= 3].drop_duplicates("text")
    df["y"] = df.label.map({l: i for i, l in enumerate(LABELS)})
    extra = pd.read_csv(Path(__file__).resolve().parent.parent / "data" / "sample_reviews.csv")
    extra["text"] = extra.text.map(clean)
    extra["y"] = extra.label.map({l: i for i, l in enumerate(LABELS)})
    tr, te = train_test_split(df, test_size=0.15, random_state=SEED, stratify=df.y)
    tr = pd.concat([tr, extra, extra], ignore_index=True)
    return tr.reset_index(drop=True), te.reset_index(drop=True)


def encode(tok, texts):
    tok.enable_truncation(MAXLEN)
    return [e.ids for e in tok.encode_batch(list(texts))]


def make_batches(ids, ys, shuffle, rnd):
    order = sorted(range(len(ids)), key=lambda i: len(ids[i]))
    chunks = [order[i:i + BS] for i in range(0, len(order), BS)]
    if shuffle:
        rnd.shuffle(chunks)
    for c in chunks:
        T = next(b for b in BUCKETS if b >= max(len(ids[i]) for i in c))
        arr = np.ones((BS, T), np.int32)  # pad id = 1
        m = np.zeros((BS, T), np.int32)
        y = np.zeros(BS, np.int32)
        w = np.zeros(BS, np.float32)
        for r, i in enumerate(c):
            arr[r, : len(ids[i])] = ids[i]
            m[r, : len(ids[i])] = 1
            y[r] = ys[i]
            w[r] = 1
        yield arr, m, y, w, c


def main():
    epochs = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
    out = Path("out"); out.mkdir(exist_ok=True)
    tok = Tokenizer.from_file("base/tokenizer.json")
    tr, te = load_data(tok)
    tr_ids, te_ids = encode(tok, tr.text), encode(tok, te.text)
    print(f"train {len(tr)} · test {len(te)} · median tokens {int(np.median([len(i) for i in tr_ids]))}", flush=True)
    params, full_emb = load_base("base/model.safetensors")
    # Keep only the vocabulary this model needs: the 40,000 most common pieces plus every
    # piece seen in the data. Smaller memory now, and a much smaller model for the website.
    keep = sorted(set(range(TOPK)) | {i for seq in tr_ids + te_ids for i in seq})
    remap = np.full(full_emb.shape[0], 3, np.int32)
    remap[keep] = np.arange(len(keep), dtype=np.int32)
    word_emb = jnp.asarray(full_emb[keep])
    del full_emb
    tr_ids = [remap[s].tolist() for s in tr_ids]
    te_ids = [remap[s].tolist() for s in te_ids]
    np.save(out / "kept_ids.npy", np.asarray(keep, np.int32))
    print(f"vocabulary kept: {len(keep)} of 250002 pieces", flush=True)

    steps_per_epoch = math.ceil(len(tr) / BS)
    total = int(steps_per_epoch * epochs)
    sched = optax.warmup_cosine_decay_schedule(0.0, LR, int(total * 0.06), total, LR * 0.05)
    opt = optax.chain(optax.clip_by_global_norm(1.0), optax.adamw(sched, weight_decay=0.01))
    state = opt.init(params)

    def loss_fn(p, emb, ids, m, y, w, key):
        logits = forward(p, emb, ids, m, key, True)
        ce = optax.softmax_cross_entropy_with_integer_labels(logits, y)
        return (ce * w).sum() / w.sum()

    @partial(jax.jit, donate_argnums=(0, 1))
    def train_step(p, s, emb, ids, m, y, w, key):
        loss, grads = jax.value_and_grad(loss_fn)(p, emb, ids, m, y, w, key)
        upd, s = opt.update(grads, s, p)
        return optax.apply_updates(p, upd), s, loss

    @jax.jit
    def predict(p, emb, ids, m):
        return forward(p, emb, ids, m, jax.random.PRNGKey(0), False)

    def evaluate(p):
        preds = np.zeros(len(te), int)
        for ids, m, _, _, c in make_batches(te_ids, te.y.tolist(), False, None):
            preds[c] = np.asarray(predict(p, word_emb, ids, m)).argmax(-1)[: len(c)]
        return preds

    rnd = random.Random(SEED)
    key = jax.random.PRNGKey(SEED)
    step, t0, best = 0, time.time(), -1.0
    while step < total:
        for ids, m, y, w, _ in make_batches(tr_ids, tr.y.tolist(), True, rnd):
            key, sub = jax.random.split(key)
            params, state, loss = train_step(params, state, word_emb, ids, m, y, w, sub)
            step += 1
            if step % 20 == 0:
                el = time.time() - t0
                print(f"step {step}/{total} loss {float(loss):.3f} · {el/60:.1f} min · eta {(total-step)*el/step/60:.0f} min", flush=True)
            if step % steps_per_epoch == 0 or step == total:
                p = evaluate(params)
                f1 = f1_score(te.y, p, average="macro")
                acc = accuracy_score(te.y, p)
                print(f"EVAL step {step}: accuracy {acc:.3f} · macro F1 {f1:.3f}", flush=True)
                print(classification_report(te.y, p, labels=[0, 1, 2], target_names=LABELS, zero_division=0), flush=True)
                if f1 > best:
                    best = f1
                    with open(out / "params.pkl", "wb") as fh:
                        pickle.dump(jax.tree_util.tree_map(np.asarray, params), fh)
                    rep = classification_report(te.y, p, labels=[0, 1, 2], target_names=LABELS, output_dict=True, zero_division=0)
                    (out / "eval_report.json").write_text(json.dumps({
                        "accuracy": acc, "f1_macro": f1, "report": rep,
                        "confusion_matrix": confusion_matrix(te.y, p, labels=[0, 1, 2]).tolist(),
                        "labels": LABELS, "test_size": len(te), "train_size": len(tr), "steps": step, "epochs_planned": epochs,
                        "base_model": "FacebookAI/xlm-roberta-base",
                        "dataset": "community-datasets/roman_urdu (UCI Roman Urdu Data Set) + 30 ReviewMind samples",
                    }, indent=2))
                    te.assign(pred=[LABELS[i] for i in p]).to_csv(out / "test_predictions.csv", index=False)
            if step >= total:
                break
    print(f"DONE best macro F1 {best:.3f} in {(time.time()-t0)/60:.0f} min", flush=True)


if __name__ == "__main__":
    main()
