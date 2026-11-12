import { useEffect, useRef, useState } from 'react';
import card from '../../model/runtime/model_card.json';
import Icon from './Icons.jsx';

// "For developers" panel: everything a technical reviewer wants, without adding a page.
// Open it from the </> button in the nav, the footer link, or any URL ending in #developers.

export const openDevPanel = () => window.dispatchEvent(new Event('rm:dev'));

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const TABS = [
  ['overview', 'Architecture'],
  ['model', 'Model'],
  ['api', 'API'],
  ['ops', 'Security'],
  ['status', 'Live status'],
];

const FLOW = [
  ['Request', 'POST /api/analyze · up to 10 reviews · validated, size-capped, same-origin, rate-limited'],
  ['Lingo', 'Detects Roman Urdu, English or mixed; normalises spellings (bht → bohat, nai → nahi)'],
  ['Pulse', 'Fine-tuned XLM-RoBERTa, int8 ONNX, runs inside the function on WebAssembly. No outside model service'],
  ['Lens · Echo · Shield · Quill', 'Topics, tone and sarcasm, fake-review signals and reply drafts via Gemini JSON mode with a strict schema'],
  ['Ledger', 'Builds the business report: sentiment mix, top complaints, praise and priorities'],
  ['Fallback', 'If Gemini is down or not configured, a rule-based engine answers so the site never breaks'],
];

const STACK = [
  ['Frontend', 'React 18, React Router 6, Vite, hand-written CSS, self-hosted fonts'],
  ['Backend', 'Vercel serverless functions (Node, Web Request API)'],
  ['Model', 'XLM-RoBERTa-base, fine-tuned in JAX/Optax, exported to ONNX, int8 per-channel'],
  ['Inference', 'onnxruntime-web (WASM) in Node; custom SentencePiece tokenizer in JavaScript'],
  ['AI', 'Google Gemini with model fallback and JSON schema output'],
  ['Email', 'Nodemailer over Gmail SMTP (app password from environment variables)'],
  ['Quality', 'Vitest unit + API tests, OpenAPI 3.1 spec, structured JSON logs'],
];

const SECURITY = [
  ['lock', 'Keys stay on the server', 'Gemini and Gmail credentials live in environment variables. The browser never sees them; /api/health reports only on/off.'],
  ['shield', 'Abuse protection', 'Same-origin check, 12 analyses per minute per IP, 5 contact messages per 10 minutes, 20 KB body limit, honeypot field on the form.'],
  ['check', 'Strict validation', '1 to 10 reviews, 3 to 600 characters each, optional 1 to 5 star rating. Bad input gets a clear 400 with the reason.'],
  ['bolt', 'Fast and resilient', '10-minute response cache, model loaded once per instance, Gemini model fallback chain, rule-based backup engine.'],
  ['server', 'Traceable', 'Every response carries a request ID; logs are structured JSON with no review text or personal data.'],
  ['layers', 'Hardened headers', 'Content-type sniffing, framing and referrer policies set for every route.'],
];

const CURL = `curl -X POST https://<your-domain>/api/analyze \\
  -H "Content-Type: application/json" \\
  -d '{"business":"Restaurant","reviews":[{"text":"Khana zabardast tha magar delivery bohat late","stars":3}]}'`;

const RESPONSE = `{
  "ok": true,
  "mode": "full",
  "engines": { "analysis": "Gemini", "sentiment": "ReviewMind fine-tuned XLM-RoBERTa (int8 ONNX)" },
  "results": [{
    "lingo":  { "language": "Roman Urdu", "cleaned": "..." },
    "pulse":  { "label": "positive", "confidence": 0.73, "source": "ReviewMind fine-tuned XLM-RoBERTa" },
    "lens":   [{ "aspect": "Food", "sentiment": "positive", "evidence": "Khana zabardast tha" },
               { "aspect": "Delivery", "sentiment": "negative", "evidence": "delivery bohat late" }],
    "echo":   { "sarcasm": false, "emotion": "calm", "real_sentiment": "neutral" },
    "shield": { "score": 8, "verdict": "genuine", "reasons": ["Specific, natural details"] },
    "quill":  { "reply": "Maazrat chahte hain! ...", "language": "Roman Urdu" },
    "overall": "mixed"
  }],
  "report": { "sentiment": { ... }, "topics": [ ... ], "topComplaint": "Delivery", "actions": [ ... ] },
  "trace": [{ "agent": "Pulse", "engine": "...", "ms": 92 }, ...],
  "requestId": "..."
}`;

function Copy({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="dev-copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        }, () => {});
      }}
    >
      <Icon name={done ? 'check' : 'copy'} /> {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Bar({ label, before, after }) {
  return (
    <div className="dev-bar">
      <div className="dev-bar-head">
        <span>{label}</span>
        <span className="num">
          {pct(before)} <Icon name="arrow" /> <strong>{pct(after)}</strong>
        </span>
      </div>
      <div className="dev-track">
        <i className="before" style={{ width: pct(before) }} />
        <i className="after" style={{ width: pct(after) }} />
      </div>
    </div>
  );
}

function Status() {
  const [h, setH] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => live && setH(d), () => live && setErr(true));
    return () => {
      live = false;
    };
  }, []);
  if (err) return <p className="muted">The API is not reachable from this preview. On the live site this shows real-time status.</p>;
  if (!h) return <p className="muted">Checking the API…</p>;
  const rows = [
    ['API', h.ok ? 'Online' : 'Down', h.ok],
    ['Analysis mode', h.mode === 'full' ? 'Full (Gemini + fine-tuned model)' : 'Basic engine + fine-tuned model', h.mode === 'full'],
    ['Pulse model', h.sentimentModel ? 'Loaded from the repository' : 'Off', Boolean(h.sentimentModel)],
    ['AI model', h.aiModel || 'Not configured', Boolean(h.aiModel)],
    ['Contact form email', h.contactForm ? 'Connected' : 'Not configured', h.contactForm],
    ['Version', h.version, true],
  ];
  return (
    <ul className="dev-status">
      {rows.map(([k, v, good]) => (
        <li key={k}>
          <span>{k}</span>
          <b className={good ? 'ok' : 'off'}>
            <i /> {v}
          </b>
        </li>
      ))}
    </ul>
  );
}

export default function DevPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('overview');
  const closeRef = useRef(null);
  const d = card.domain_tuning;
  const m = card.test_metrics_int8_onnx;

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('rm:dev', show);
    if (window.location.hash === '#developers') setOpen(true);
    return () => window.removeEventListener('rm:dev', show);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="dev-layer" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <aside className="dev-panel" role="dialog" aria-modal="true" aria-labelledby="dev-title">
        <header className="dev-head">
          <div>
            <span className="dev-kicker">
              <Icon name="code" /> For developers
            </span>
            <h2 id="dev-title">Under the hood</h2>
          </div>
          <button ref={closeRef} type="button" className="dev-close" aria-label="Close" onClick={() => setOpen(false)}>
            <Icon name="close" />
          </button>
        </header>

        <div className="dev-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="dev-body">
          {tab === 'overview' && (
            <>
              <p className="dev-lead">One request goes through seven agents. The sentiment model is our own and runs inside the API itself, with no outside model service.</p>
              <ol className="dev-flow">
                {FLOW.map(([k, v]) => (
                  <li key={k}>
                    <b>{k}</b>
                    <span>{v}</span>
                  </li>
                ))}
              </ol>
              <h3>Stack</h3>
              <dl className="dev-dl">
                {STACK.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {tab === 'model' && (
            <>
              <p className="dev-lead">
                XLM-RoBERTa-base, fine-tuned in two stages and compressed to int8 (per-channel) ONNX. Every number below is measured on held-out data the model never saw.
              </p>
              <div className="dev-stats">
                <div>
                  <strong className="num">{pct(m.review_accuracy)}</strong>
                  <span>accuracy on {card.review_test_size} unseen real-style reviews</span>
                </div>
                <div>
                  <strong className="num">{pct(m.accuracy)}</strong>
                  <span>accuracy on {card.test_size.toLocaleString()} public test sentences</span>
                </div>
                <div>
                  <strong className="num">~0.1 s</strong>
                  <span>per review on a serverless CPU</span>
                </div>
              </div>
              <h3>Effect of review training</h3>
              <Bar label="Unseen reviews" before={d.before.review_acc} after={m.review_accuracy} />
              <Bar label="Public test set" before={d.before.public_acc} after={m.accuracy} />
              <h3>Training</h3>
              <dl className="dev-dl">
                <div>
                  <dt>Stage 1</dt>
                  <dd>{card.training_stages[0]}, UCI Roman Urdu Data Set</dd>
                </div>
                <div>
                  <dt>Stage 2</dt>
                  <dd>{card.training_stages[1]}</dd>
                </div>
                <div>
                  <dt>Labels</dt>
                  <dd>{card.labels.join(' · ')}</dd>
                </div>
                <div>
                  <dt>Vocabulary</dt>
                  <dd>{card.vocabulary}</dd>
                </div>
                <div>
                  <dt>Macro F1</dt>
                  <dd>
                    {pct(m.review_f1_macro)} reviews · {pct(m.f1_macro)} public
                  </dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>123 MB int8 (from 489 MB), same review accuracy as full precision</dd>
                </div>
              </dl>
              <p className="dev-note">The public dataset is short social-media text with noisy labels, which is why its score is lower; the review set reflects what the product actually reads.</p>
            </>
          )}

          {tab === 'api' && (
            <>
              <p className="dev-lead">A small, documented JSON API. The full schema is in the OpenAPI file.</p>
              <ul className="dev-endpoints">
                <li>
                  <em className="post">POST</em> <code>/api/analyze</code> <span>Analyse 1 to 10 reviews</span>
                </li>
                <li>
                  <em className="post">POST</em> <code>/api/contact</code> <span>Send a message from the Hire me form</span>
                </li>
                <li>
                  <em className="get">GET</em> <code>/api/health</code> <span>Status of every part, no secrets</span>
                </li>
              </ul>
              <div className="dev-code">
                <div className="dev-code-head">
                  <span>Request</span>
                  <Copy text={CURL} />
                </div>
                <pre>{CURL}</pre>
              </div>
              <div className="dev-code">
                <div className="dev-code-head">
                  <span>Response (shortened)</span>
                </div>
                <pre>{RESPONSE}</pre>
              </div>
              <a className="btn ghost" href="/openapi.json" target="_blank" rel="noreferrer">
                OpenAPI 3.1 spec <Icon name="ext" />
              </a>
            </>
          )}

          {tab === 'ops' && (
            <div className="dev-sec">
              {SECURITY.map(([icon, t, v]) => (
                <div key={t}>
                  <i>
                    <Icon name={icon} />
                  </i>
                  <b>{t}</b>
                  <p>{v}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'status' && (
            <>
              <p className="dev-lead">Live answer from <code>/api/health</code>.</p>
              <Status />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
