"""Second stage: adapt the Pulse model to customer reviews.

Starts from the model trained on the public Roman Urdu data (out/params.pkl) and continues
training on the hand-written ReviewMind review set (review_set.TRAIN, 4x) mixed with 3,000
sentences from the original training data so it keeps what it learned. Reports results on
both the public test set and the separate review test set (review_set.TEST)."""
import json, pickle, random, sys, time
from functools import partial
from pathlib import Path

import jax, jax.numpy as jnp, numpy as np, optax, pandas as pd
from safetensors.numpy import load_file
from sklearn.metrics import accuracy_score, classification_report, f1_score
from tokenizers import Tokenizer

sys.path.insert(0, str(Path(__file__).parent))
import train_jax as T
from review_set import TEST, TRAIN

BS, LR, SEED = 16, 1.5e-5, 7
out = Path("out2"); out.mkdir(exist_ok=True)
tok = Tokenizer.from_file("base/tokenizer.json")
keep = np.load("out/kept_ids.npy")
remap = np.full(250002, 3, np.int32); remap[keep] = np.arange(len(keep))
enc = lambda texts: [remap[np.array(s)].tolist() for s in T.encode(tok, [T.clean(t) for t in texts])]  # noqa: E731
LBL = {l: i for i, l in enumerate(T.LABELS)}

tr, te = T.load_data(tok)
rng = np.random.default_rng(SEED)
mix = tr.iloc[rng.choice(len(tr), 3000, replace=False)]
train_texts = mix.text.tolist() + [t for t, _ in TRAIN] * 4
train_y = mix.y.tolist() + [LBL[l] for _, l in TRAIN] * 4
tr_ids = enc(train_texts)
te_ids, rv_ids = enc(te.text.tolist()), enc([t for t, _ in TEST])
rv_y = [LBL[l] for _, l in TEST]
print(f"domain train {len(tr_ids)} (reviews {len(TRAIN)}x4 + 3000 public) · public test {len(te_ids)} · review test {len(rv_ids)}", flush=True)

params = jax.tree_util.tree_map(jnp.asarray, pickle.load(open("out/params.pkl", "rb")))
emb = jnp.asarray(load_file("base/model.safetensors")["roberta.embeddings.word_embeddings.weight"][keep])
total = -(-len(tr_ids) // BS)
opt = optax.chain(optax.clip_by_global_norm(1.0), optax.adamw(optax.warmup_cosine_decay_schedule(0.0, LR, 20, total, LR * 0.1), weight_decay=0.01))
state = opt.init(params)

def loss_fn(p, e, ids, m, y, w, key):
    ce = optax.softmax_cross_entropy_with_integer_labels(T.forward(p, e, ids, m, key, True), y)
    return (ce * w).sum() / w.sum()

@partial(jax.jit, donate_argnums=(0, 1))
def step(p, s, e, ids, m, y, w, key):
    l, g = jax.value_and_grad(loss_fn)(p, e, ids, m, y, w, key)
    u, s = opt.update(g, s, p)
    return optax.apply_updates(p, u), s, l

@jax.jit
def predict(p, e, ids, m):
    return T.forward(p, e, ids, m, jax.random.PRNGKey(0), False)

def evaluate(p, ids, ys):
    pr = np.zeros(len(ids), int)
    for b, m, _, _, c in T.make_batches(ids, ys, False, None):
        pr[c] = np.asarray(predict(p, emb, b, m)).argmax(-1)[: len(c)]
    return pr

def report(tag, p):
    a = evaluate(p, te_ids, te.y.tolist()); b = evaluate(p, rv_ids, rv_y)
    r = {"public_acc": round(accuracy_score(te.y, a), 4), "public_f1": round(f1_score(te.y, a, average="macro"), 4),
         "review_acc": round(accuracy_score(rv_y, b), 4), "review_f1": round(f1_score(rv_y, b, average="macro"), 4)}
    print(tag, r, flush=True)
    return r, b

before, _ = report("BEFORE", params)
key, rnd, t0 = jax.random.PRNGKey(SEED), random.Random(SEED), time.time()
for i, (ids, m, y, w, _) in enumerate(T.make_batches(tr_ids, train_y, True, rnd), 1):
    key, sub = jax.random.split(key)
    params, state, l = step(params, state, emb, ids, m, y, w, sub)
    if i % 40 == 0:
        print(f"step {i}/{total} loss {float(l):.3f} · {(time.time()-t0)/60:.1f} min", flush=True)
after, rv_pred = report("AFTER", params)
print(classification_report(rv_y, rv_pred, labels=[0, 1, 2], target_names=T.LABELS, zero_division=0))
for (t, l), p_ in zip(TEST, rv_pred):
    if T.LABELS[p_] != l:
        print(f"  miss: {t}  (true {l}, said {T.LABELS[p_]})")
pickle.dump(jax.tree_util.tree_map(np.asarray, params), open(out / "params.pkl", "wb"))
json.dump({"before": before, "after": after, "review_train": len(TRAIN), "review_test": len(TEST)}, open(out / "domain_report.json", "w"), indent=1)
print("DONE", flush=True)
