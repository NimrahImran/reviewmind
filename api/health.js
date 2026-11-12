// @ts-check
// GET /api/health — shows which parts are switched on (never reveals any key).
import { activeModel, hasKey } from './_lib/gemini.js';
import { hasLocalModel, modelCard } from './_lib/pulse-model.js';
import { json } from './_lib/http.js';

export function GET() {
  return json({
    ok: true,
    service: 'ReviewMind API',
    version: '1.0.0',
    agents: ['Lingo', 'Pulse', 'Lens', 'Echo', 'Shield', 'Quill', 'Ledger'],
    mode: hasKey() ? 'full' : 'basic',
    aiModel: hasKey() ? activeModel() : null,
    sentimentModel: hasLocalModel() ? { name: 'ReviewMind Pulse (fine-tuned XLM-RoBERTa, int8 ONNX)', testMetrics: modelCard()?.test_metrics_int8_onnx ?? null } : null,
    contactForm: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    time: new Date().toISOString(),
  });
}
