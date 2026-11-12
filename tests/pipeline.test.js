import { afterEach, describe, expect, it } from 'vitest';
import { analyze, basicReview, buildReport, fromGemini, validateInput } from '../api/_lib/pipeline.js';
import { cleanForModel, UnigramTokenizer } from '../api/_lib/pulse-model.js';

afterEach(() => {
  delete process.env.MOCK_GEMINI;
  delete process.env.GEMINI_API_KEY;
});

describe('validateInput', () => {
  it('accepts strings, objects and newline text', () => {
    expect(validateInput({ reviews: ['acha tha yaar'] }).ok).toBe(true);
    const v = validateInput({ reviews: [{ text: 'Food was great', stars: 5 }], business: 'Restaurant' });
    expect(v.ok && v.reviews[0].stars).toBe(5);
    const t = validateInput({ reviews: 'first review here\n\nsecond review here' });
    expect(t.ok && t.reviews.length).toBe(2);
  });
  it('refuses bad input with a clear message', () => {
    expect(validateInput({})).toEqual({ ok: false, error: 'Add at least one review.' });
    expect(validateInput({ reviews: ['x'.repeat(601)] }).ok).toBe(false);
    expect(validateInput({ reviews: Array(11).fill('good food here') }).ok).toBe(false);
  });
});

describe('analyze', () => {
  it('answers in basic mode with no key', async () => {
    const out = await analyze([{ text: 'Khana zabardast tha lekin delivery bohat late thi', stars: 3 }], 'Restaurant');
    expect(out.mode).toBe('basic');
    expect(out.notice).toMatch(/basic mode/);
    expect(out.results[0].overall).toBe('mixed');
    expect(out.trace).toHaveLength(7);
  });
  it('uses the AI engine when available', async () => {
    process.env.MOCK_GEMINI = '1';
    const out = await analyze([{ text: 'Wah kya service hai, sirf 3 ghante wait kiya', stars: null }], 'Cafe');
    expect(out.mode).toBe('full');
    expect(out.results[0].echo.sarcasm).toBe(true);
    expect(out.results[0].pulse.label).toBe('negative');
    expect(out.report.headline).toBe('Mock analysis of the reviews.');
  });
});

describe('fromGemini', () => {
  it('fills gaps from the basic engine and clamps numbers', () => {
    const r = fromGemini({ reviews: [{ index: 0, sentiment: 'positive', confidence: 4, fake_score: 300, aspects: [] }] }, [{ text: 'great food', stars: null }]);
    expect(r[0].pulse.confidence).toBe(1);
    expect(r[0].shield.score).toBe(100);
    expect(r[0].shield.verdict).toBe('likely fake');
    expect(r[0].lens.length).toBeGreaterThan(0);
  });
  it('falls back per review when one is missing', () => {
    const r = fromGemini({ reviews: [] }, [{ text: 'Food was cold', stars: null }]);
    expect(r[0].pulse.source).toBe('basic engine');
  });
});

describe('Ledger', () => {
  it('builds the report', () => {
    const results = ['Food was great but delivery was late', 'Delivery was very late and food was cold', 'Great food, friendly staff'].map((t, i) => basicReview({ text: t, stars: null }, i));
    const rep = buildReport(results);
    expect(rep.total).toBe(3);
    expect(rep.topComplaint).toBe('Delivery');
    expect(rep.sentiment.positive + rep.sentiment.neutral + rep.sentiment.negative).toBeGreaterThanOrEqual(99);
    expect(rep.actions.length).toBeGreaterThan(0);
  });
});

describe('Pulse model helpers', () => {
  it('cleans text the way the model was trained', () => {
    expect(cleanForModel('bht acha tha yr!!!! https://x.co')).toBe('bohat acha tha yaar!');
  });
  it('tokenizes with a unigram vocabulary', () => {
    const tok = new UnigramTokenizer({ unk: 3, pieces: ['<s>', '<pad>', '</s>', '<unk>', '\u2581acha', '\u2581a', 'cha', 'a'], scores: [0, 0, 0, 0, -1, -2, -2, -3] });
    expect(tok.encode('acha')).toEqual([0, 4, 2]);
    expect(tok.encode('acha zz')).toEqual([0, 4, 3, 2]);
  });
});
