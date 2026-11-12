// Checks that the website's JavaScript tokenizer gives exactly the same token ids as the
// Python (Hugging Face) tokenizer used in training.
// Usage: node model/training/parity.mjs cases.json   (cases: [{ "text": "...", "ids": [0, ..., 2] }])
import { readFileSync } from 'node:fs';
import { UnigramTokenizer } from '../../api/_lib/pulse-model.js';

const tok = new UnigramTokenizer(JSON.parse(readFileSync(new URL('../runtime/vocab.json', import.meta.url))));
const cases = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let same = 0;
const bad = [];
for (const c of cases) {
  const a = tok.encode(c.text, 512).join(',');
  if (a === c.ids.join(',')) same++;
  else if (bad.length < 5) bad.push({ text: c.text, js: a, py: c.ids.join(',') });
}
console.log(`parity ${same}/${cases.length}`);
if (bad.length) console.log(JSON.stringify(bad, null, 1));
