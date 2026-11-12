// @ts-check
// Pulse's own fine-tuned transformer, running inside the API (no outside service).
//
// Model: XLM-RoBERTa-base fine-tuned on Roman Urdu + English reviews (see /model),
// exported to ONNX and quantized to int8. It runs with onnxruntime-web (WebAssembly),
// so it needs no native binaries. Files live in model/runtime/:
//   vocab.json               tokenizer pieces + scores + the kept-vocabulary id map
//   pulse.int8.onnx.partN    the model, split into parts under GitHub's 100 MB file limit
//   model_card.json          test-set metrics
//
// If the files are missing or loading fails, predict() returns null and the other
// engines answer, so the site never breaks.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { log } from './http.js';

const DIR = path.join(process.cwd(), 'model', 'runtime');
const LABELS = /** @type {const} */ (['negative', 'neutral', 'positive']);
const MAX_LEN = 64;

// Same clean-up the model was trained with (model/train.py → clean()).
const NORMALIZE = {
  bht: 'bohat', bhot: 'bohat', bhut: 'bohat', buhat: 'bohat', bahut: 'bohat', bohot: 'bohat', boht: 'bohat',
  achaa: 'acha', accha: 'acha', achha: 'acha', achhi: 'achi', acchi: 'achi',
  nai: 'nahi', nhi: 'nahi', ni: 'nahi', nahin: 'nahi', nae: 'nahi',
  yr: 'yaar', yar: 'yaar', b: 'bhi', bi: 'bhi', h: 'hai', hy: 'hai', hn: 'hain',
  k: 'ke', mn: 'main', zbrdst: 'zabardast', zabrdast: 'zabardast', thk: 'theek', thik: 'theek',
  bkwas: 'bakwas', pr: 'par', sb: 'sab', kr: 'kar', krna: 'karna', plz: 'please', pls: 'please',
};

/** @param {string} t */
export function cleanForModel(t) {
  return String(t)
    .replace(/[A-Za-z]+/g, (w) => NORMALIZE[/** @type {keyof typeof NORMALIZE} */ (w.toLowerCase())] || w)
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/([!?.])\1{2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ */
/* SentencePiece Unigram tokenizer (matches the Hugging Face XLM-R one) */
/* ------------------------------------------------------------------ */

export class UnigramTokenizer {
  /** @param {{ unk: number, pieces: string[], scores: number[] }} vocab */
  constructor(vocab) {
    /** @type {Map<string, [number, number]>} */
    this.map = new Map();
    let min = Infinity;
    let maxLen = 1;
    vocab.pieces.forEach((p, id) => {
      if (id < 4 || p === '<mask>') return;
      const s = vocab.scores[id];
      this.map.set(p, [id, s]);
      if (s < min) min = s;
      const len = [...p].length;
      if (len > maxLen) maxLen = len;
    });
    this.unk = vocab.unk;
    this.unkScore = min - 10;
    this.maxLen = maxLen;
  }

  /** @param {string} word already prefixed with ▁ */
  word(word) {
    const ch = Array.from(word);
    const n = ch.length;
    const best = new Float64Array(n + 1).fill(-Infinity);
    const from = new Int32Array(n + 1);
    const tok = new Int32Array(n + 1);
    best[0] = 0;
    for (let i = 0; i < n; i++) {
      if (best[i] === -Infinity) continue;
      let single = false;
      let s = '';
      for (let j = i; j < Math.min(n, i + this.maxLen); j++) {
        s += ch[j];
        const hit = this.map.get(s);
        if (!hit) continue;
        if (j === i) single = true;
        const sc = best[i] + hit[1];
        if (sc > best[j + 1]) {
          best[j + 1] = sc;
          from[j + 1] = i;
          tok[j + 1] = hit[0];
        }
      }
      if (!single) {
        const sc = best[i] + this.unkScore;
        if (sc > best[i + 1]) {
          best[i + 1] = sc;
          from[i + 1] = i;
          tok[i + 1] = this.unk;
        }
      }
    }
    const out = [];
    for (let k = n; k > 0; k = from[k]) out.push(tok[k]);
    out.reverse();
    return out.filter((id, i) => !(id === this.unk && out[i - 1] === this.unk));
  }

  /** @param {string} text */
  encode(text, maxLen = MAX_LEN) {
    const norm = text
      .normalize('NFKC')
      .replace(/[‍�]/g, ' ')
      .replace(/[\u0000-\u0008\u000e-\u001f\u007f​‌‎‏‪-‮⁠-⁯﻿]/g, '');
    const ids = [];
    for (const w of norm.split(/\s+/).filter(Boolean)) ids.push(...this.word('▁' + w));
    return [0, ...ids.slice(0, maxLen - 2), 2];
  }
}

/* ------------------------------------------------------------------ */
/* Model loading (once per server instance)                              */
/* ------------------------------------------------------------------ */

/** @type {Promise<{ ort: any, session: any, tok: UnigramTokenizer, remap: Int32Array } | null> | null} */
let loading = null;

export function hasLocalModel() {
  return process.env.PULSE_MODEL !== 'off' && existsSync(path.join(DIR, 'vocab.json')) && partFiles().length > 0;
}

function partFiles() {
  try {
    return readdirSync(DIR)
      .filter((f) => /^pulse\.int8\.onnx\.part\d+$/.test(f))
      .sort((a, b) => Number(a.split('part')[1]) - Number(b.split('part')[1]));
  } catch {
    return [];
  }
}

/** Model card with test metrics (or null). */
export function modelCard() {
  try {
    return JSON.parse(readFileSync(path.join(DIR, 'model_card.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function load() {
  const t0 = Date.now();
  try {
    const ort = await import('onnxruntime-web');
    ort.env.wasm.numThreads = 1;
    ort.env.logLevel = 'error';
    const vocab = JSON.parse(readFileSync(path.join(DIR, 'vocab.json'), 'utf8'));
    const tok = new UnigramTokenizer(vocab);
    const remap = new Int32Array(vocab.pieces.length).fill(3);
    vocab.keep.forEach((/** @type {number} */ oldId, /** @type {number} */ newId) => (remap[oldId] = newId));
    const bytes = Buffer.concat(partFiles().map((f) => readFileSync(path.join(DIR, f))));
    const session = await ort.InferenceSession.create(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length), {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    log('info', { event: 'pulse_model_loaded', ms: Date.now() - t0, mb: Math.round(bytes.length / 1e6) });
    return { ort, session, tok, remap };
  } catch (e) {
    log('error', { event: 'pulse_model_failed', reason: String(/** @type {any} */ (e)?.message || e).slice(0, 300) });
    loading = null; // allow a retry on the next request
    return null;
  }
}

/**
 * Sentiment for each text, or null if the model is unavailable.
 * @param {string[]} texts
 * @returns {Promise<{ label: 'negative'|'neutral'|'positive', confidence: number, scores: Record<string, number> }[] | null>}
 */
export async function localSentiment(texts) {
  if (!hasLocalModel() || !texts.length) return null;
  loading ||= load();
  const m = await loading;
  if (!m) return null;
  try {
    // One review per run: int8 dynamic quantization scales activations per batch, so running
    // reviews alone gives the same answer every time, whatever else is in the request.
    const results = [];
    for (const t of texts) {
      const seq = Array.from(m.tok.encode(cleanForModel(t)), (id) => BigInt(m.remap[id]));
      const shape = [1, seq.length];
      const out = await m.session.run({
        input_ids: new m.ort.Tensor('int64', BigInt64Array.from(seq), shape),
        attention_mask: new m.ort.Tensor('int64', new BigInt64Array(seq.length).fill(1n), shape),
      });
      const p = /** @type {Float32Array} */ (out.probs.data);
      const row = [p[0], p[1], p[2]];
      const k = row.indexOf(Math.max(...row));
      results.push({
        label: LABELS[k],
        confidence: Math.round(row[k] * 100) / 100,
        scores: { negative: Math.round(row[0] * 1000) / 1000, neutral: Math.round(row[1] * 1000) / 1000, positive: Math.round(row[2] * 1000) / 1000 },
      });
    }
    return results;
  } catch (e) {
    log('error', { event: 'pulse_model_run_failed', reason: String(/** @type {any} */ (e)?.message || e).slice(0, 300) });
    return null;
  }
}
