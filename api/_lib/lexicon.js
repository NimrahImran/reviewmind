// @ts-check
// ReviewMind basic engine: fast, rule-based versions of every agent.
//
// It runs with no API key and no network, so the demo always answers. When
// Gemini (and optionally the fine-tuned model) is set up, the full engine is
// used instead and this file only provides the shared language helpers.

/* ------------------------------------------------------------------ */
/* Lingo: language detection and Roman Urdu clean-up                    */
/* ------------------------------------------------------------------ */

/** Common Roman Urdu spellings mapped to one standard form. */
export const NORMALIZE = {
  bht: 'bohat', bhot: 'bohat', bhut: 'bohat', buhat: 'bohat', bahut: 'bohat', bohot: 'bohat', boht: 'bohat',
  acha: 'acha', achaa: 'acha', acchaa: 'acha', accha: 'acha', achha: 'acha',
  achi: 'achi', achhi: 'achi', acchi: 'achi',
  nai: 'nahi', nhi: 'nahi', ni: 'nahi', nahin: 'nahi', nae: 'nahi', nahii: 'nahi',
  yr: 'yaar', yar: 'yaar', yaarr: 'yaar',
  b: 'bhi', bi: 'bhi',
  h: 'hai', hy: 'hai', hai: 'hai', he: 'hai', hain: 'hain', hn: 'hain',
  k: 'ke', ky: 'ke',
  mn: 'main', mein: 'main', me: 'main',
  tha: 'tha', thaa: 'tha', thi: 'thi', thee: 'thi',
  kia: 'kya', kiya: 'kiya', kya: 'kya',
  zbrdst: 'zabardast', zabrdast: 'zabardast', zbardast: 'zabardast',
  khna: 'khana', khaana: 'khana',
  thk: 'theek', thik: 'theek', theek: 'theek', thek: 'theek',
  bkwas: 'bakwas', bakwass: 'bakwas',
  pr: 'par', pe: 'par',
  sb: 'sab', sbse: 'sabse',
  krna: 'karna', krne: 'karne', kr: 'kar',
  dia: 'diya', diya: 'diya',
  plz: 'please', pls: 'please',
  gud: 'good', gr8: 'great', thx: 'thanks', thnx: 'thanks',
};

const ROMAN_URDU_MARKERS = new Set([
  'hai', 'hain', 'tha', 'thi', 'the', 'nahi', 'bohat', 'acha', 'achi', 'bura', 'buri', 'kya', 'kiya', 'aur', 'lekin', 'magar',
  'bhi', 'ke', 'ki', 'ka', 'ko', 'se', 'main', 'par', 'yaar', 'sab', 'sabse', 'khana', 'zabardast', 'bakwas', 'theek', 'wala',
  'wali', 'diya', 'karna', 'kar', 'gaya', 'gayi', 'raha', 'rahi', 'mila', 'mili', 'wapis', 'paisay', 'paise', 'mehnga', 'sasta',
  'ghanta', 'ghante', 'din', 'jaldi', 'dair', 'der', 'koi', 'kuch', 'bilkul', 'shukriya', 'wah', 'yeh', 'ye', 'woh', 'wo', 'hum',
  'aap', 'ap', 'mera', 'meri', 'apna', 'hua', 'hui', 'agar', 'phir', 'abhi', 'kabhi', 'bas', 'zyada', 'kam', 'maza', 'mazay',
]);

const ENGLISH_MARKERS = new Set([
  'the', 'is', 'was', 'were', 'and', 'but', 'very', 'good', 'bad', 'great', 'food', 'service', 'not', 'it', 'this', 'that',
  'i', 'we', 'my', 'our', 'they', 'with', 'for', 'of', 'to', 'in', 'on', 'arrived', 'product', 'staff', 'price', 'quality',
  'delivery', 'order', 'love', 'loved', 'hate', 'never', 'again', 'would', 'recommend', 'excellent', 'terrible', 'amazing',
]);

/** @param {string} text */
export function tokenize(text) {
  return (text.toLowerCase().match(/[a-z؀-ۿ]+|\d+/g) || []);
}

/**
 * Detects Urdu script, Roman Urdu, English, or a mix.
 * @param {string} text
 * @returns {'Urdu' | 'Roman Urdu' | 'English' | 'Mixed'}
 */
export function detectLanguage(text) {
  if (/[؀-ۿ]/.test(text)) return 'Urdu';
  const words = tokenize(text).map((w) => NORMALIZE[w] || w);
  let ru = 0;
  let en = 0;
  for (const w of words) {
    if (ROMAN_URDU_MARKERS.has(w)) ru++;
    else if (ENGLISH_MARKERS.has(w)) en++;
  }
  if (ru === 0 && en === 0) return 'English';
  if (ru >= 2 && en >= 2 && Math.min(ru, en) / Math.max(ru, en) > 0.5) return 'Mixed';
  return ru > en ? 'Roman Urdu' : 'English';
}

/**
 * Fixes common Roman Urdu short forms and spellings, keeping punctuation.
 * @param {string} text
 */
export function normalizeText(text) {
  const out = text.replace(/[A-Za-z]+/g, (word) => {
    const fixed = NORMALIZE[/** @type {keyof typeof NORMALIZE} */ (word.toLowerCase())];
    if (!fixed) return word;
    return word[0] === word[0].toUpperCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;
  });
  const tidy = out.replace(/\s+/g, ' ').replace(/([!?.])\1{2,}/g, '$1').trim();
  return tidy ? tidy[0].toUpperCase() + tidy.slice(1) : tidy;
}

/* ------------------------------------------------------------------ */
/* Pulse and Lens: sentiment and topics                                 */
/* ------------------------------------------------------------------ */

const POSITIVE = new Set([
  'acha', 'achi', 'ache', 'zabardast', 'behtareen', 'kamal', 'mazedar', 'lajawab', 'shandar', 'umda', 'pasand', 'khush', 'theek',
  'fresh', 'tasty', 'maza', 'shukriya', 'jaldi', 'sasta', 'saaf',
  'good', 'great', 'excellent', 'amazing', 'awesome', 'love', 'loved', 'best', 'nice', 'perfect', 'fast', 'friendly', 'helpful',
  'delicious', 'clean', 'fantastic', 'recommend', 'recommended', 'happy', 'polite', 'quick', 'fine', 'wonderful', 'superb', 'cheap',
  'affordable', 'original', 'comfortable', 'beautiful', 'worth', 'thanks', 'satisfied',
]);

const NEGATIVE = new Set([
  'bura', 'buri', 'bekar', 'bakwas', 'ganda', 'gandi', 'ghatiya', 'mehnga', 'mehngi', 'dair', 'der', 'late', 'thanda', 'thandi',
  'toota', 'tooti', 'kharab', 'naraz', 'fazool', 'badtameez', 'wapis', 'dhoka', 'fraud', 'kam',
  'bad', 'worst', 'terrible', 'awful', 'poor', 'slow', 'rude', 'dirty', 'cold', 'broken', 'damaged', 'expensive', 'overpriced',
  'disappointed', 'disappointing', 'never', 'waste', 'horrible', 'stale', 'wrong', 'missing', 'refund', 'fake', 'unhappy',
  'delay', 'delayed', 'hate', 'angry', 'useless', 'problem', 'issue', 'complaint',
]);

const NEGATORS = new Set(['nahi', 'not', 'no', 'never', 'na', 'mat', "isn't", "wasn't", "didn't", "don't"]);

/** Topic keywords (Roman Urdu + English). */
export const ASPECTS = {
  Food: ['khana', 'food', 'taste', 'zaika', 'biryani', 'pizza', 'burger', 'karahi', 'chai', 'coffee', 'meal', 'dish', 'fresh', 'tasty', 'mazedar', 'delicious', 'stale', 'thanda', 'cold', 'mazay', 'maza'],
  Delivery: ['delivery', 'rider', 'late', 'parcel', 'courier', 'shipping', 'arrived', 'aya', 'ayi', 'pohncha', 'deliver', 'delayed', 'delay', 'tracking', 'din'],
  Price: ['price', 'qeemat', 'mehnga', 'mehngi', 'sasta', 'expensive', 'cheap', 'overpriced', 'paise', 'paisay', 'rupay', 'rs', 'cost', 'value', 'worth', 'affordable', 'discount'],
  Service: ['service', 'staff', 'waiter', 'rawaiya', 'behaviour', 'behavior', 'rude', 'polite', 'friendly', 'helpful', 'support', 'manager', 'badtameez', 'madad', 'team', 'response', 'replied', 'reply'],
  Quality: ['quality', 'product', 'original', 'fake', 'toota', 'tooti', 'broken', 'damaged', 'material', 'kharab', 'size', 'fitting', 'durable', 'cheap'],
  Cleanliness: ['saaf', 'ganda', 'gandi', 'clean', 'dirty', 'safai', 'hygiene', 'smell', 'washroom'],
  Ambience: ['mahol', 'ambience', 'atmosphere', 'music', 'seating', 'jagah', 'place', 'decor', 'view', 'crowded', 'noisy'],
  'Wait time': ['wait', 'intezar', 'ghante', 'ghanta', 'queue', 'line', 'dair', 'der', 'minutes', 'hour', 'hours'],
  Rooms: ['room', 'kamra', 'bed', 'bathroom', 'ac', 'wifi', 'check-in', 'checkin'],
};

/**
 * Scores a piece of text: positive minus negative words, with negation flips.
 * @param {string[]} words already normalised
 */
function scoreWords(words) {
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const flipped = NEGATORS.has(words[i - 1]) || NEGATORS.has(words[i + 1]) || NEGATORS.has(words[i - 2]);
    if (POSITIVE.has(w)) flipped ? neg++ : pos++;
    else if (NEGATIVE.has(w) && w !== 'never') flipped ? pos++ : neg++;
    else if (w === 'never') neg += 0.5;
  }
  return { pos, neg };
}

/** @param {string} text */
function words(text) {
  return tokenize(text).map((w) => NORMALIZE[/** @type {keyof typeof NORMALIZE} */ (w)] || w);
}

/**
 * @param {string} text
 * @param {number | null} [stars]
 * @returns {{ label: 'positive'|'neutral'|'negative', confidence: number }}
 */
export function basicSentiment(text, stars = null) {
  const { pos, neg } = scoreWords(words(text));
  let score = pos - neg;
  if (stars) score += (stars - 3) * 0.8;
  const strength = pos + neg + (stars ? Math.abs(stars - 3) : 0);
  const label = score > 0.4 ? 'positive' : score < -0.4 ? 'negative' : 'neutral';
  const confidence = Math.min(0.95, 0.55 + Math.min(strength, 5) * 0.08);
  return { label, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Splits a review into clauses ("lekin", "but", ",") and gives each topic
 * found its own verdict.
 * @param {string} text
 * @returns {{ aspect: string, sentiment: 'positive'|'neutral'|'negative', evidence: string }[]}
 */
export function basicAspects(text) {
  const clauses = text.split(/\b(?:lekin|magar|but|however|although|par)\b|[,;.!?]+/i).map((c) => c.trim()).filter(Boolean);
  /** @type {Map<string, { aspect: string, sentiment: 'positive'|'neutral'|'negative', evidence: string }>} */
  const found = new Map();
  for (const clause of clauses) {
    const w = words(clause);
    for (const [aspect, keys] of Object.entries(ASPECTS)) {
      if (found.has(aspect) || !w.some((x) => keys.includes(x))) continue;
      const { pos, neg } = scoreWords(w);
      const sentiment = pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
      found.set(aspect, { aspect, sentiment, evidence: clause.slice(0, 120) });
    }
  }
  return [...found.values()].slice(0, 5);
}

/* ------------------------------------------------------------------ */
/* Echo: tone and sarcasm                                               */
/* ------------------------------------------------------------------ */

/**
 * @param {string} text
 * @param {'positive'|'neutral'|'negative'} surface
 */
export function basicTone(text, surface) {
  const lower = text.toLowerCase();
  const w = words(text);
  const praiseOpener = /\b(wah|waah|kya baat|wow|great|amazing|brilliant|thanks a lot|shukriya)\b/.test(lower);
  const complaintFact = /(\d+\s*(ghant|hour|din|day|minute|min))|late|dair|der|wait|intezar|broken|toota|cold|thanda|never|nahi aya|didn't|not/.test(lower);
  const { neg } = scoreWords(w);
  const sarcasm = praiseOpener && complaintFact && (neg > 0 || /sirf|only|just|bas/.test(lower));
  const angry = /!{2,}/.test(text) && neg > 0 || /\b(worst|never again|kabhi nahi|fraud|dhoka|badtameez)\b/.test(lower);
  const emotion = sarcasm ? 'frustrated' : angry ? 'angry' : surface === 'positive' ? 'happy' : surface === 'negative' ? 'disappointed' : 'calm';
  return {
    sarcasm,
    emotion,
    real_sentiment: sarcasm ? 'negative' : surface,
    note: sarcasm
      ? 'The words sound like praise, but the details describe a bad experience.'
      : angry
        ? 'Strong, angry wording. This customer may need a quick personal reply.'
        : 'The tone matches the words.',
  };
}

/* ------------------------------------------------------------------ */
/* Shield: fake or spam review signals                                  */
/* ------------------------------------------------------------------ */

/** @param {string} text */
export function basicFake(text) {
  const reasons = [];
  let score = 8;
  const w = tokenize(text);
  const exclaims = (text.match(/!/g) || []).length;
  const caps = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  if (exclaims >= 3) {
    score += 22;
    reasons.push('Too many exclamation marks');
  }
  if (caps >= 2) {
    score += 12;
    reasons.push('Shouting in capital letters');
  }
  if (/\b(buy now|order now|100%|best (product|shop|seller) ever|must buy|dm|whatsapp|link in bio|click)\b/i.test(text)) {
    score += 30;
    reasons.push('Sounds like an advert, not an experience');
  }
  const unique = new Set(w).size;
  if (w.length >= 6 && unique / w.length < 0.6) {
    score += 15;
    reasons.push('Repeats the same words');
  }
  const hasDetail = w.some((x) => Object.values(ASPECTS).some((keys) => keys.includes(x))) || /\d/.test(text);
  if (!hasDetail) {
    score += 18;
    reasons.push('No real details about the product or visit');
  }
  if (w.length < 4) {
    score += 10;
    reasons.push('Very short');
  }
  score = Math.max(2, Math.min(97, score));
  const verdict = score >= 60 ? 'likely fake' : score >= 35 ? 'suspicious' : 'genuine';
  if (!reasons.length) reasons.push('Specific, natural details');
  return { score, verdict, reasons: reasons.slice(0, 3) };
}

/* ------------------------------------------------------------------ */
/* Quill: reply drafts                                                  */
/* ------------------------------------------------------------------ */

/**
 * @param {{ sentiment: string, aspects: { aspect: string, sentiment: string }[], language: string, sarcasm: boolean }} r
 */
export function basicReply(r) {
  const bad = r.aspects.filter((a) => a.sentiment === 'negative').map((a) => a.aspect.toLowerCase());
  const good = r.aspects.filter((a) => a.sentiment === 'positive').map((a) => a.aspect.toLowerCase());
  const negative = r.sentiment === 'negative' || r.sarcasm;
  if (r.language === 'Roman Urdu' || r.language === 'Mixed') {
    if (negative || bad.length) {
      return `Maazrat chahte hain! ${bad.length ? `Aap ko ${bad.join(' aur ')} mein jo pareshani hui` : 'Aap ka tajurba acha nahi raha'}, us par hum sharminda hain. ${good.length ? `Khushi hai ke ${good.join(' aur ')} aap ko pasand aaya. ` : ''}Hum ne yeh team tak pohncha diya hai. Barah-e-karam apna order number inbox kar dein, hum foran madad karenge.`;
    }
    return `Bohat shukriya! ${good.length ? `Khushi hui ke ${good.join(' aur ')} aap ko pasand aaya.` : 'Aap ki raaye hamare liye bohat qeemti hai.'} Umeed hai aap jald dobara aayenge.`;
  }
  if (negative || bad.length) {
    return `We're sorry about your experience${bad.length ? ` with the ${bad.join(' and ')}` : ''}. ${good.length ? `We're glad you liked the ${good.join(' and ')}. ` : ''}We've shared this with our team. Please send us your order number and we'll make it right.`;
  }
  return `Thank you so much! ${good.length ? `We're happy you enjoyed the ${good.join(' and ')}.` : 'Your feedback means a lot to us.'} We hope to see you again soon.`;
}
