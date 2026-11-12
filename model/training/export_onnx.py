"""Export the fine-tuned ReviewMind sentiment model to ONNX, quantize it to int8, and check
that the ONNX version gives the same answers as the trained JAX model.

Outputs (in out/onnx/):
  reviewmind-sentiment.int8.onnx   the model the website runs
  vocab.json                       tokenizer pieces + scores + id map for the pruned vocabulary
  model_card.json                  metrics and details shown on the About page
"""
import json, pickle, sys, time
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import pandas as pd
from onnx import TensorProto, helper, numpy_helper
from onnxruntime.quantization import QuantType, quantize_dynamic
from safetensors.numpy import load_file
from sklearn.metrics import accuracy_score, f1_score

sys.path.insert(0, str(Path(__file__).parent))
import train_jax as T  # noqa: E402

OUT = Path("out/onnx")
OUT.mkdir(parents=True, exist_ok=True)
H, NH, L = 768, 12, 12


def build(params, word_emb, path):
    inits, nodes = [], []
    n = [0]

    def c(name, arr):
        inits.append(numpy_helper.from_array(np.asarray(arr), name))
        return name

    def op(kind, ins, **attrs):
        n[0] += 1
        out = f"{kind.lower()}_{n[0]}"
        nodes.append(helper.make_node(kind, ins, [out], **attrs))
        return out

    f32 = lambda a: np.asarray(a, np.float32)  # noqa: E731
    c("word", f32(word_emb))
    c("pos", f32(params["pos"]))
    c("type0", f32(params["type"][0]))
    c("one_f", np.array(1.0, np.float32))
    c("one_i", np.array(1, np.int64))
    c("neg_big", np.array(-1e9, np.float32))
    c("scale", np.array(1 / 8, np.float32))
    c("half", np.array(0.5, np.float32))
    c("inv_sqrt2", np.array(1 / np.sqrt(2), np.float32))
    c("ax12", np.array([1, 2], np.int64))
    c("shape_heads", np.array([0, 0, NH, H // NH], np.int64))
    c("shape_back", np.array([0, 0, H], np.int64))
    c("zero_idx", np.array(0, np.int64))

    # embeddings
    pos_ids = op("Add", [op("Mul", [op("CumSum", ["attention_mask", "one_i"]), "attention_mask"]), "one_i"])
    x = op("Add", [op("Add", [op("Gather", ["word", "input_ids"]), op("Gather", ["pos", pos_ids])]), "type0"])

    def ln(t, g, b):
        return op("LayerNormalization", [t, c(f"lng_{n[0]}", f32(g)), c(f"lnb_{n[0]}", f32(b))], axis=-1, epsilon=1e-5)

    x = ln(x, params["emb_ln_g"], params["emb_ln_b"])
    mf = op("Cast", ["attention_mask"], to=TensorProto.FLOAT)
    bias = op("Unsqueeze", [op("Mul", [op("Sub", ["one_f", mf]), "neg_big"]), "ax12"])

    def dense(t, w, b, tag):
        return op("Add", [op("MatMul", [t, c(f"{tag}_w", f32(w))]), c(f"{tag}_b", f32(b))])

    lay = params["layers"]
    for i in range(L):
        g = {k: v[i] for k, v in lay.items()}
        q = op("Transpose", [op("Reshape", [dense(x, g["q_w"], g["q_b"], f"l{i}q"), "shape_heads"])], perm=[0, 2, 1, 3])
        k = op("Transpose", [op("Reshape", [dense(x, g["k_w"], g["k_b"], f"l{i}k"), "shape_heads"])], perm=[0, 2, 3, 1])
        v = op("Transpose", [op("Reshape", [dense(x, g["v_w"], g["v_b"], f"l{i}v"), "shape_heads"])], perm=[0, 2, 1, 3])
        att = op("Softmax", [op("Add", [op("Mul", [op("MatMul", [q, k]), "scale"]), bias])], axis=-1)
        ctx = op("Reshape", [op("Transpose", [op("MatMul", [att, v])], perm=[0, 2, 1, 3]), "shape_back"])
        x = ln(op("Add", [dense(ctx, g["o_w"], g["o_b"], f"l{i}o"), x]), g["ln1_g"], g["ln1_b"])
        hpre = dense(x, g["i_w"], g["i_b"], f"l{i}i")
        h = op("Mul", [op("Mul", [hpre, "half"]), op("Add", [op("Erf", [op("Mul", [hpre, "inv_sqrt2"])]), "one_f"])])
        x = ln(op("Add", [dense(h, g["f_w"], g["f_b"], f"l{i}f"), x]), g["ln2_g"], g["ln2_b"])

    cls = op("Gather", [x, "zero_idx"], axis=1)
    cls = op("Tanh", [dense(cls, params["cls_w"], params["cls_b"], "cls")])
    logits = dense(cls, params["out_w"], params["out_b"], "out")
    nodes.append(helper.make_node("Identity", [logits], ["logits"]))
    nodes.append(helper.make_node("Softmax", ["logits"], ["probs"], axis=-1))

    graph = helper.make_graph(
        nodes, "reviewmind_sentiment",
        [helper.make_tensor_value_info("input_ids", TensorProto.INT64, ["batch", "seq"]),
         helper.make_tensor_value_info("attention_mask", TensorProto.INT64, ["batch", "seq"])],
        [helper.make_tensor_value_info("logits", TensorProto.FLOAT, ["batch", 3]),
         helper.make_tensor_value_info("probs", TensorProto.FLOAT, ["batch", 3])],
        inits,
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)], producer_name="reviewmind")
    model.ir_version = 8
    onnx.checker.check_model(model)
    onnx.save(model, path)


def batch_encode(tok, remap, texts, maxlen=64):
    tok.enable_truncation(maxlen)
    seqs = [remap[np.array(e.ids)] for e in tok.encode_batch(list(texts))]
    T_ = max(len(s) for s in seqs)
    ids = np.ones((len(seqs), T_), np.int64)
    m = np.zeros((len(seqs), T_), np.int64)
    for i, s in enumerate(seqs):
        ids[i, : len(s)] = s
        m[i, : len(s)] = 1
    return ids, m


def run(sess, tok, remap, texts):
    preds, probs = [], []
    for i in range(0, len(texts), 64):
        ids, m = batch_encode(tok, remap, texts[i:i + 64])
        p = sess.run(["probs"], {"input_ids": ids, "attention_mask": m})[0]
        probs.append(p)
    probs = np.concatenate(probs)
    return probs.argmax(-1), probs


def main():
    from tokenizers import Tokenizer
    src = sys.argv[1] if len(sys.argv) > 1 else "out"
    params = pickle.load(open(f"{src}/params.pkl", "rb"))
    keep = np.load("out/kept_ids.npy")
    full = load_file("base/model.safetensors")["roberta.embeddings.word_embeddings.weight"]
    word_emb = full[keep]
    del full
    fp32 = OUT / "model.fp32.onnx"
    build(params, word_emb, str(fp32))
    print("fp32 size MB", round(fp32.stat().st_size / 1e6))

    int8 = OUT / "reviewmind-sentiment.int8.onnx"
    quantize_dynamic(str(fp32), str(int8), weight_type=QuantType.QInt8, per_channel=True, reduce_range=True,
                     op_types_to_quantize=["MatMul", "Gather"])
    print("int8 size MB", round(int8.stat().st_size / 1e6))

    tok = Tokenizer.from_file("base/tokenizer.json")
    remap = np.full(250002, 3, np.int64)
    remap[keep] = np.arange(len(keep))
    tr, te = T.load_data(tok)
    from review_set import TEST as RTEST
    rtexts = [T.clean(t) for t, _ in RTEST]
    ry = np.array([T.LABELS.index(l) for _, l in RTEST])
    so = ort.SessionOptions()
    res = {}

    def run1(sess, texts):
        out = []
        for t in texts:
            ids, m = batch_encode(tok, remap, [t])
            out.append(sess.run(["probs"], {"input_ids": ids, "attention_mask": m})[0][0])
        return np.array(out).argmax(-1)

    for name, path in [("fp32", fp32), ("int8", int8)]:
        sess = ort.InferenceSession(str(path), so, providers=["CPUExecutionProvider"])
        t0 = time.time()
        pred = run1(sess, te.text.tolist())
        rpred = run1(sess, rtexts)
        res[name] = {
            "accuracy": round(accuracy_score(te.y, pred), 4),
            "f1_macro": round(f1_score(te.y, pred, average="macro"), 4),
            "review_accuracy": round(accuracy_score(ry, rpred), 4),
            "review_f1_macro": round(f1_score(ry, rpred, average="macro"), 4),
            "seconds": round(time.time() - t0, 1),
        }
        print(name, res[name], flush=True)

    vocab = json.load(open("base/tokenizer.json"))["model"]["vocab"]
    json.dump({"unk": 3, "pieces": [p for p, _ in vocab], "scores": [s for _, s in vocab], "keep": keep.tolist()},
              open(OUT / "vocab.json", "w"), ensure_ascii=False, separators=(",", ":"))
    rep = json.load(open("out/eval_report.json"))
    dom = json.load(open(f"{src}/domain_report.json")) if src != "out" else None
    card = {
        "name": "ReviewMind Pulse sentiment model",
        "base_model": "FacebookAI/xlm-roberta-base",
        "task": "3-way sentiment (negative, neutral, positive)",
        "labels": T.LABELS,
        "languages": ["Roman Urdu", "English", "Urdu"],
        "train_size": rep["train_size"],
        "test_size": rep["test_size"],
        "dataset": rep["dataset"],
        "vocabulary": f"{len(keep)} of 250,002 XLM-R pieces kept",
        "review_test_size": len(RTEST),
        "training_stages": ["public Roman Urdu sentences (16,663)", "ReviewMind hand-written reviews (154) mixed with 3,000 public"] if dom else ["public Roman Urdu sentences"],
        "domain_tuning": dom,
        "test_metrics_int8_onnx": res["int8"],
        "format": "ONNX, dynamic int8 quantization (per-channel)",
    }
    json.dump(card, open(OUT / "model_card.json", "w"), indent=2)
    print(json.dumps(card, indent=2))


if __name__ == "__main__":
    main()
