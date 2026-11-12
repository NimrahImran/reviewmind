import { describe, expect, it } from 'vitest';
import { basicAspects, basicFake, basicReply, basicSentiment, basicTone, detectLanguage, normalizeText } from '../api/_lib/lexicon.js';

describe('Lingo', () => {
  it('detects languages', () => {
    expect(detectLanguage('Khana zabardast tha lekin delivery bohat late thi')).toBe('Roman Urdu');
    expect(detectLanguage('The product arrived broken and support never replied')).toBe('English');
    expect(detectLanguage('کھانا بہت اچھا تھا')).toBe('Urdu');
  });
  it('cleans Roman Urdu short forms', () => {
    expect(normalizeText('bht acha tha yr, price b theek tha')).toBe('Bohat acha tha yaar, price bhi theek tha');
    expect(normalizeText('wow!!!!')).toBe('Wow!');
  });
});

describe('Pulse', () => {
  it('reads positive, negative and neutral', () => {
    expect(basicSentiment('Service bohat achi thi, staff ne foran madad ki').label).toBe('positive');
    expect(basicSentiment('Worst experience, food was cold and staff was rude').label).toBe('negative');
    expect(basicSentiment('Khana acha nahi tha').label).toBe('negative');
  });
  it('uses stars as evidence', () => {
    expect(basicSentiment('theek tha', 1).label).toBe('negative');
    expect(basicSentiment('theek tha', 5).label).toBe('positive');
  });
});

describe('Lens', () => {
  it('splits topics with their own verdicts', () => {
    const a = basicAspects('Khana zabardast tha lekin delivery bohat late thi');
    expect(a.find((x) => x.aspect === 'Food')?.sentiment).toBe('positive');
    expect(a.find((x) => x.aspect === 'Delivery')?.sentiment).toBe('negative');
  });
});

describe('Echo', () => {
  it('catches sarcasm', () => {
    const t = basicTone('Wah kya service hai, sirf 3 ghante wait kiya', 'positive');
    expect(t.sarcasm).toBe(true);
    expect(t.real_sentiment).toBe('negative');
  });
  it('leaves honest praise alone', () => {
    expect(basicTone('Great food and friendly staff', 'positive').sarcasm).toBe(false);
  });
});

describe('Shield', () => {
  it('flags advert-like reviews', () => {
    expect(basicFake('Best product ever!!! Buy now!!! 100% original!!!').verdict).toBe('likely fake');
  });
  it('trusts detailed reviews', () => {
    expect(basicFake('The biryani was fresh but delivery took 70 minutes and the rider was rude').verdict).toBe('genuine');
  });
});

describe('Quill', () => {
  it('replies in the review language', () => {
    expect(basicReply({ sentiment: 'negative', aspects: [{ aspect: 'Delivery', sentiment: 'negative' }], language: 'Roman Urdu', sarcasm: false })).toMatch(/Maazrat/);
    expect(basicReply({ sentiment: 'positive', aspects: [], language: 'English', sarcasm: false })).toMatch(/Thank you/);
  });
});
