import { beforeEach, describe, expect, it } from 'vitest';
import { POST as analyzePOST } from '../api/analyze.js';
import { POST as contactPOST, validateContact } from '../api/contact.js';
import { GET as health } from '../api/health.js';
import { clearCache, resetLimiter } from '../api/_lib/http.js';

const req = (path, body, headers = {}) =>
  new Request(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json', host: 'localhost', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeEach(() => {
  resetLimiter();
  clearCache();
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
});

describe('/api/analyze', () => {
  it('analyzes reviews', async () => {
    const res = await analyzePOST(req('/api/analyze', { reviews: ['Khana zabardast tha lekin delivery late thi'], business: 'Restaurant' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.results[0].lens.length).toBeGreaterThan(0);
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });
  it('rejects broken JSON and empty input', async () => {
    expect((await analyzePOST(req('/api/analyze', '{oops'))).status).toBe(400);
    expect((await analyzePOST(req('/api/analyze', { reviews: [] }))).status).toBe(400);
  });
  it('refuses other websites', async () => {
    expect((await analyzePOST(req('/api/analyze', { reviews: ['good food'] }, { origin: 'https://evil.example' }))).status).toBe(403);
  });
  it('rate limits floods', async () => {
    let last;
    for (let i = 0; i < 13; i++) last = await analyzePOST(req('/api/analyze', { reviews: ['good food ' + i] }));
    expect(last.status).toBe(429);
  });
});

describe('/api/contact', () => {
  it('validates fields', () => {
    expect(validateContact({ name: 'A', email: 'a@b.co', message: 'hello there friend' }).ok).toBe(false);
    expect(validateContact({ name: 'Ali', email: 'nope', message: 'hello there friend' }).ok).toBe(false);
    expect(validateContact({ name: 'Ali', email: 'ali@example.com', message: 'hello there friend' }).ok).toBe(true);
  });
  it('explains when email is not set up', async () => {
    const res = await contactPOST(req('/api/contact', { name: 'Ali', email: 'ali@example.com', message: 'I need review analysis' }));
    expect(res.status).toBe(503);
  });
  it('quietly drops bot submissions', async () => {
    const res = await contactPOST(req('/api/contact', { _honey: 'x', name: 'Bot' }));
    expect((await res.json()).ok).toBe(true);
  });
});

describe('/api/health', () => {
  it('reports status without secrets', async () => {
    const body = await health().json();
    expect(body.ok).toBe(true);
    expect(body.agents).toHaveLength(7);
    expect(JSON.stringify(body)).not.toMatch(/key/i);
  });
});
