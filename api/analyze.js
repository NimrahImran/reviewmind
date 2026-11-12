// @ts-check
// POST /api/analyze — runs a batch of reviews through the seven ReviewMind agents.
//
// Body: { "reviews": ["Khana zabardast tha lekin delivery late thi", ...] | [{ "text": "...", "stars": 3 }], "business": "Restaurant" }
// Answer: { ok, mode, engines, results[], report, trace[], notice?, requestId }

import { allowRequest, cached, clientIp, isSameOrigin, json, log, newRequestId } from './_lib/http.js';
import { analyze, validateInput } from './_lib/pipeline.js';

/** @param {Request} request */
export async function POST(request) {
  const requestId = newRequestId();
  if (!isSameOrigin(request)) {
    return json({ ok: false, error: 'This API only answers the ReviewMind website.' }, 403, requestId);
  }
  const limit = allowRequest(`analyze:${clientIp(request)}`, 12, 60_000);
  if (!limit.ok) {
    return json({ ok: false, error: `Too many requests. Please wait ${limit.retryAfter} seconds.`, retryAfter: limit.retryAfter }, 429, requestId);
  }

  /** @type {any} */
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 20_000) return json({ ok: false, error: 'That is too much text at once.' }, 413, requestId);
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'Send the reviews as JSON.' }, 400, requestId);
  }

  const input = validateInput(body);
  if (!input.ok) return json({ ok: false, error: input.error }, 400, requestId);

  const t0 = Date.now();
  try {
    // Same reviews within 10 minutes → same answer, without spending quota again.
    const key = `a:${input.business}:${JSON.stringify(input.reviews)}`;
    const out = await cached(key, 10 * 60_000, () => analyze(input.reviews, input.business));
    log('info', { requestId, event: 'analyze', reviews: input.reviews.length, mode: out.mode, ms: Date.now() - t0 });
    return json({ ok: true, ...out, requestId }, 200, requestId);
  } catch (e) {
    log('error', { requestId, event: 'analyze_failed', reason: String(/** @type {any} */ (e)?.message || e) });
    return json({ ok: false, error: 'Something went wrong while analyzing. Please try again.' }, 500, requestId);
  }
}

export function GET() {
  return json({ ok: false, error: 'Use POST with a JSON body. See /openapi.json.' }, 405);
}
