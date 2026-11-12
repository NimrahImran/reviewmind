// @ts-check
// Asks Google Gemini for a JSON answer that follows a schema. The API key is
// read from the server environment (GEMINI_API_KEY) and never reaches the browser.
// If one model is retired, busy or out of free quota, the next one is tried.

import { log } from './http.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const TOTAL_BUDGET_MS = 45_000;
const PER_MODEL_TIMEOUT_MS = () => Number(process.env.GEMINI_TIMEOUT_MS) || 25_000;

export const DEFAULT_MODELS = 'gemini-3.8-flash,gemini-3.5-flash-lite,gemini-flash-latest,gemini-flash-lite-latest';

export function models() {
  return (process.env.GEMINI_MODEL || DEFAULT_MODELS)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

export function hasKey() {
  return Boolean(process.env.GEMINI_API_KEY) || process.env.MOCK_GEMINI === '1';
}

export function activeModel() {
  return process.env.MOCK_GEMINI === '1' ? 'mock' : models()[0];
}

/** An expected failure with a stable code the UI understands. */
export class AiError extends Error {
  /**
   * @param {'NO_KEY'|'BAD_KEY'|'RATE_LIMIT'|'MODEL'|'UPSTREAM'|'NETWORK'|'BLOCKED'|'BAD_OUTPUT'} code
   * @param {string} message
   * @param {{ retryAfter?: number }} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.retryAfter = extra.retryAfter;
  }
}

/**
 * @param {{ system: string, prompt: string, schema: object, temperature?: number, maxTokens?: number, mock?: () => unknown }} opts
 * @returns {Promise<{ data: any, model: string }>}
 */
export async function generateJson({ system, prompt, schema, temperature = 0.2, maxTokens = 8000, mock }) {
  if (process.env.MOCK_GEMINI === '1') {
    if (!mock) throw new AiError('MODEL', 'No mock answer for this request.');
    return { data: mock(), model: 'mock' };
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError('NO_KEY', 'GEMINI_API_KEY is not set.');

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  /** @type {AiError | undefined} */
  let lastErr;
  const keep = (/** @type {AiError} */ e) => {
    const rank = { RATE_LIMIT: 4, BAD_OUTPUT: 3, UPSTREAM: 2, NETWORK: 1, MODEL: 0 };
    if (!lastErr || (rank[e.code] ?? 0) >= (rank[lastErr.code] ?? 0)) lastErr = e;
  };

  const queue = models();
  const plainThinking = new Set();
  for (let i = 0; i < queue.length && i < 7; i++) {
    const model = queue[i];
    if (Date.now() > deadline - 4000) break;
    /** @type {Record<string, unknown>} */
    const generationConfig = {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
      responseSchema: schema,
    };
    if (!plainThinking.has(model)) {
      if (model.startsWith('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };
      else if (/^gemini-(3|flash|pro)/.test(model)) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
    }

    /** @type {Response} */
    let res;
    try {
      res = await fetch(`${API}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig,
        }),
        signal: AbortSignal.timeout(Math.min(PER_MODEL_TIMEOUT_MS(), Math.max(3000, deadline - Date.now()))),
      });
    } catch (e) {
      log('warn', { event: 'gemini_failed', model, reason: String(/** @type {any} */ (e)?.message || e) });
      keep(new AiError('NETWORK', 'Gemini did not respond in time.', { retryAfter: 5 }));
      continue;
    }

    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const cand = body?.candidates?.[0];
      const text = (cand?.content?.parts || [])
        .filter((/** @type {any} */ p) => !p.thought && p.text)
        .map((/** @type {any} */ p) => p.text)
        .join('');
      if (!text && cand?.finishReason === 'SAFETY') throw new AiError('BLOCKED', 'This review could not be analyzed.');
      try {
        return { data: JSON.parse(stripFences(text)), model };
      } catch {
        log('warn', { event: 'gemini_bad_json', model, finish: cand?.finishReason, length: text.length });
        keep(new AiError('BAD_OUTPUT', 'The AI answer was incomplete.'));
        continue;
      }
    }

    const msg = body?.error?.message || `Gemini responded ${res.status}`;
    log('warn', { event: 'gemini_error', model, status: res.status, message: String(msg).slice(0, 300) });
    if (res.status === 429) {
      const retry = body?.error?.details?.find((/** @type {any} */ d) => d['@type']?.includes('RetryInfo'))?.retryDelay;
      keep(new AiError('RATE_LIMIT', 'The free AI quota is busy right now.', { retryAfter: Math.min(Math.max(parseInt(retry, 10) || 20, 5), 60) }));
      continue;
    }
    if (res.status === 400 && /thinking/i.test(msg) && !plainThinking.has(model)) {
      plainThinking.add(model);
      queue.splice(i + 1, 0, model);
      continue;
    }
    if (res.status === 400 && /api key/i.test(msg)) throw new AiError('BAD_KEY', 'The Gemini API key was rejected.');
    if (res.status === 403 && !/region|location|country/i.test(msg)) throw new AiError('BAD_KEY', 'The Gemini API key does not have access.');
    if (res.status === 404 || /not found|not supported|no longer available/i.test(msg)) {
      const successor = /use models\/([\w.-]+)/i.exec(msg)?.[1];
      if (successor && !queue.includes(successor)) queue.splice(i + 1, 0, successor);
      keep(new AiError('MODEL', 'No Gemini model is available right now.'));
      continue;
    }
    if (res.status >= 500) {
      keep(new AiError('UPSTREAM', 'Gemini is busy right now.', { retryAfter: 8 }));
      continue;
    }
    keep(new AiError('UPSTREAM', 'Gemini could not answer this request.'));
  }
  throw lastErr || new AiError('UPSTREAM', 'Gemini is busy right now.', { retryAfter: 8 });
}

/** @param {string} s */
function stripFences(s) {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
}
