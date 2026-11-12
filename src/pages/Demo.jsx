import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Meter, Pill } from '../components/AgentCard.jsx';
import Icon from '../components/Icons.jsx';
import { PageHead } from '../components/Section.jsx';
import { AGENTS, SAMPLES } from '../data/agents.js';

const BUSINESSES = ['Restaurant', 'Cafe', 'Hotel', 'Online store', 'Salon', 'Clinic', 'Other'];
const MAX = 10;
const pct = (n) => Math.round(n * 100);

async function analyze(reviews, business) {
  let res;
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reviews, business }),
    });
  } catch {
    throw new Error('Could not reach ReviewMind. Check your internet connection and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!body) throw new Error('The server sent an unexpected answer. Please try again.');
  if (!res.ok || !body.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body;
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const ref = useRef(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const r = document.createRange();
      r.selectNodeContents(ref.current);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <>
      <span ref={ref} className="sr-only">
        {text}
      </span>
      <button type="button" className="copy-btn" onClick={copy}>
        <Icon name={done ? 'check' : 'copy'} />
        {done ? 'Copied' : 'Copy reply'}
      </button>
    </>
  );
}

function Pipeline({ stage, data }) {
  return (
    <ol className="pipeline" aria-label="Agent progress">
      {AGENTS.map((a, k) => {
        const t = data?.trace?.find((x) => x.agent === a.name);
        const state = data ? 'done' : stage > k ? 'done' : stage === k ? 'running' : 'waiting';
        return (
          <li key={a.id} className={`pipe ${state}`} style={{ '--c': a.color }}>
            <img src={`/img/${a.id}-head.webp`} alt="" width="44" height="44" />
            <span>
              <b>{a.name}</b>
              <small>{state === 'done' ? (t ? t.engine : 'Done') : state === 'running' ? 'Working…' : a.role}</small>
            </span>
            {state === 'done' && <Icon name="check" className="pipe-ok" />}
          </li>
        );
      })}
    </ol>
  );
}

function Report({ report, engines }) {
  return (
    <section className="report" aria-label="Ledger report">
      <div className="report-head">
        <img src="/img/ledger-head.webp" alt="" width="56" height="56" />
        <div>
          <p className="eyebrow">Ledger · report</p>
          <h2>{report.headline}</h2>
        </div>
      </div>
      <div className="report-grid">
        <div className="report-box">
          <div className="lbl">Sentiment across {report.total} review{report.total > 1 ? 's' : ''}</div>
          <div className="split" aria-hidden="true">
            {['positive', 'neutral', 'negative'].map((l) => (
              <i key={l} className={l} style={{ width: `${report.sentiment[l]}%` }} />
            ))}
          </div>
          <div className="split-legend">
            <span className="pos">Positive {report.sentiment.positive}%</span>
            <span className="neu">Neutral {report.sentiment.neutral}%</span>
            <span className="neg">Negative {report.sentiment.negative}%</span>
          </div>
        </div>
        <div className="report-box facts">
          <div className="row">
            <span>Top complaint</span>
            {report.topComplaint ? <Pill label="negative">{report.topComplaint}</Pill> : <span className="muted">None</span>}
          </div>
          <div className="row">
            <span>Top praise</span>
            {report.topPraise ? <Pill label="positive">{report.topPraise}</Pill> : <span className="muted">None</span>}
          </div>
          <div className="row">
            <span>Sarcastic reviews</span>
            <span className="num">{report.sarcastic}</span>
          </div>
          <div className="row">
            <span>Flagged as possibly fake</span>
            <span className="num">{report.flagged}</span>
          </div>
        </div>
        <div className="report-box">
          <div className="lbl">What to do next</div>
          <ol className="actions">
            {report.actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ol>
        </div>
      </div>
      <p className="engines">
        Sentiment: {engines.sentiment} · Other agents: {engines.analysis}
      </p>
    </section>
  );
}

function ResultCard({ r }) {
  const cleanedDiffers = r.lingo.cleaned && r.lingo.cleaned.replace(/[.\s]+$/, '').toLowerCase() !== r.text.replace(/[.\s]+$/, '').toLowerCase();
  const fakeTone = r.shield.verdict === 'genuine' ? 'positive' : r.shield.verdict === 'suspicious' ? 'neutral' : 'negative';
  return (
    <article className="result">
      <header className="result-head">
        <span className="result-n">Review {r.index + 1}</span>
        <Pill label={r.overall} />
        <span className="chip-sm">{r.lingo.language}</span>
        {r.stars && <span className="stars small">{'★'.repeat(r.stars)}<s>{'★'.repeat(5 - r.stars)}</s></span>}
      </header>
      <p className="result-text">“{r.text}”</p>
      <div className="result-grid">
        <div className="agent-out" style={{ '--c': '#c23a51' }}>
          <h4><img src="/img/pulse-head.webp" alt="" width="28" height="28" />Pulse · Sentiment</h4>
          <div className="row">
            <Pill label={r.pulse.label} />
            <span className="num">{pct(r.pulse.confidence)}% confident</span>
          </div>
          <small className="muted">by {r.pulse.source}</small>
        </div>
        <div className="agent-out" style={{ '--c': '#d9b26f' }}>
          <h4><img src="/img/lens-head.webp" alt="" width="28" height="28" />Lens · Topics</h4>
          {r.lens.length ? (
            r.lens.map((a) => (
              <div className="row" key={a.aspect} title={a.evidence}>
                <span>{a.aspect}</span>
                <Pill label={a.sentiment} />
              </div>
            ))
          ) : (
            <span className="muted">No clear topic in this review.</span>
          )}
        </div>
        <div className="agent-out" style={{ '--c': '#d99583' }}>
          <h4><img src="/img/lingo-head.webp" alt="" width="28" height="28" />Lingo · Language</h4>
          <div className="row">
            <span>Detected</span>
            <span className="chip-sm">{r.lingo.language}</span>
          </div>
          {cleanedDiffers ? <div className="quote">{r.lingo.cleaned}</div> : <span className="muted">Spelling was already clean.</span>}
        </div>
        <div className="agent-out" style={{ '--c': '#a8386c' }}>
          <h4><img src="/img/echo-head.webp" alt="" width="28" height="28" />Echo · Tone</h4>
          <div className="row">
            <span>Sarcasm</span>
            {r.echo.sarcasm ? <Pill label="negative">Detected</Pill> : <Pill label="positive">None</Pill>}
          </div>
          <div className="row">
            <span>Emotion</span>
            <span className="cap">{r.echo.emotion}</span>
          </div>
          <small className="muted">{r.echo.note}</small>
        </div>
        <div className="agent-out" style={{ '--c': '#c9ced6' }}>
          <h4><img src="/img/shield-head.webp" alt="" width="28" height="28" />Shield · Fake check</h4>
          <div className="row">
            <span>Verdict</span>
            <Pill label={fakeTone}>{r.shield.verdict}</Pill>
          </div>
          <Meter label="Fake score" value={r.shield.score} color={`var(--${fakeTone === 'positive' ? 'pos' : fakeTone === 'neutral' ? 'neu' : 'neg'})`} />
          <small className="muted">{r.shield.reasons.join(' · ')}</small>
        </div>
        <div className="agent-out wide" style={{ '--c': '#cf7a45' }}>
          <h4><img src="/img/quill-head.webp" alt="" width="28" height="28" />Quill · Suggested reply</h4>
          <div className="quote">{r.quill.reply}</div>
          <CopyButton text={r.quill.reply} />
        </div>
      </div>
    </article>
  );
}

export default function Demo() {
  const [text, setText] = useState(SAMPLES[0].text);
  const [business, setBusiness] = useState(SAMPLES[0].business);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const results = useRef(null);

  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const tooMany = lines.length > MAX;
  const tooLong = lines.some((l) => l.length > 600);

  useEffect(() => {
    if (!loading) return;
    setStage(0);
    const t = setInterval(() => setStage((s) => (s < AGENTS.length - 1 ? s + 1 : s)), 650);
    return () => clearInterval(t);
  }, [loading]);

  const run = async (e) => {
    e?.preventDefault();
    if (!lines.length) return setError('Paste at least one review first.');
    if (tooMany) return setError(`You can analyze up to ${MAX} reviews at a time. Remove ${lines.length - MAX}.`);
    if (tooLong) return setError('Each review can be up to 600 characters.');
    setError('');
    setData(null);
    setLoading(true);
    try {
      const out = await analyze(lines, business);
      setData(out);
      setTimeout(() => results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setStage(-1);
    }
  };

  return (
    <>
      <PageHead eyebrow="Live demo" title="Watch the agents read your reviews">
        Paste one review, or up to ten (one per line), in Roman Urdu or English. All seven agents will answer in a few seconds.
      </PageHead>

      <section className="section tight">
        <div className="wrap demo-layout">
          <form className="panel demo-form" onSubmit={run} noValidate>
            <div className="field">
              <label htmlFor="business">Business type</label>
              <select id="business" value={business} onChange={(e) => setBusiness(e.target.value)}>
                {BUSINESSES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <div className="field-top">
                <label htmlFor="reviews">Reviews</label>
                <span className={`counter ${tooMany ? 'bad' : ''}`}>
                  {lines.length} / {MAX}
                </span>
              </div>
              <textarea
                id="reviews"
                rows={8}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError('');
                }}
                placeholder={'Khana zabardast tha lekin delivery late thi\nStaff was very friendly'}
                aria-describedby="reviews-help"
              />
              <p id="reviews-help" className="help">One review per line. Up to 600 characters each.</p>
            </div>
            <div className="samples">
              <span className="lbl">Try a sample</span>
              <div className="sample-row">
                {SAMPLES.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className={`sample ${text === s.text ? 'on' : ''}`}
                    onClick={() => {
                      setText(s.text);
                      setBusiness(s.business);
                      setError('');
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn solid big" type="submit" disabled={loading}>
              {loading ? 'Agents are reading…' : (<>Analyze {lines.length > 1 ? `${lines.length} reviews` : 'review'} <Icon name="arrow" /></>)}
            </button>
          </form>

          <aside className="panel pipe-panel">
            <p className="lbl">The team</p>
            <Pipeline stage={loading ? stage : -1} data={data} />
            {!loading && !data && <p className="help">Press Analyze to watch each agent take its turn.</p>}
            {data && <p className="help">Done in {Math.max(...data.trace.map((t) => t.ms))} ms.</p>}
          </aside>
        </div>
      </section>

      {data && (
        <section className="section tight" ref={results} aria-live="polite">
          <div className="wrap results">
            {data.notice && (
              <p className="notice">
                <Icon name="bolt" />
                {data.notice}
              </p>
            )}
            <Report report={data.report} engines={data.engines} />
            {data.results.map((r) => (
              <ResultCard key={r.index} r={r} />
            ))}
            <div className="demo-end">
              <p>Want ReviewMind on all of your business’s reviews?</p>
              <Link className="btn solid" to="/hire">
                Talk to me <Icon name="arrow" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
