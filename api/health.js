// @ts-check
// GET /api/health — shows which parts are switched on (never reveals any key).
import { activeModel, hasKey } from './_lib/gemini.js';
import { hasLocalModel, modelCard } from './_lib/pulse-model.js';
import { json } from './_lib/http.js';

function metrics() {
  const m = modelCard()?.test_metrics_int8_onnx;
  return m ? { reviewAccuracy: m.review_accuracy, reviewF1: m.review_f1_macro, publicAccuracy: m.accuracy, publicF1: m.f1_macro } : null;
}

export function GET() {
  return json({
    ok: true,
    service: 'ReviewMind API',
    version: '1.0.0',
    agents: ['Lingo', 'Pulse', 'Lens', 'Echo', 'Shield', 'Quill', 'Ledger'],
    mode: hasKey() ? 'full' : 'basic',
    aiModel: hasKey() ? activeModel() : null,
    sentimentModel: hasLocalModel() ? { name: 'ReviewMind Pulse (fine-tuned XLM-RoBERTa, int8 ONNX)', testMetrics: metrics(), selfCheck: '/api/analyze?check=model' } : null,
    contactForm: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    time: new Date().toISOString(),
  });
}
