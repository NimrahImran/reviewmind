// The glass card that shows one agent's work on a review.

const LABELS = { positive: 'Positive', neutral: 'Neutral', negative: 'Negative', mixed: 'Mixed' };
const TONE = { positive: 'pos', neutral: 'neu', negative: 'neg', mixed: 'neu' };

export function Stars({ n }) {
  if (!n) return null;
  return (
    <div className="stars" aria-label={`${n} out of 5 stars`}>
      {'★★★★★'.slice(0, n)}
      <s>{'★★★★★'.slice(n)}</s>
    </div>
  );
}

export function Pill({ label, children }) {
  return <span className={`pill ${TONE[label] || 'neu'}`}>{children || LABELS[label] || label}</span>;
}

export function Meter({ label, value, color }) {
  return (
    <>
      <div className="row">
        <span>{label}</span>
        <span className="num">{value}%</span>
      </div>
      <div className="meter">
        <i style={{ width: `${value}%`, background: color }} />
      </div>
    </>
  );
}

function Output({ out }) {
  switch (out.type) {
    case 'sentiment':
      return (
        <>
          <div className="lbl">Sentiment · {out.confidence}% confident</div>
          <div className="seg">
            {['positive', 'neutral', 'negative'].map((l) => (
              <span key={l} className={`${TONE[l]} ${out.label === l ? 'on' : ''}`}>
                {LABELS[l]}
              </span>
            ))}
          </div>
        </>
      );
    case 'aspects':
      return (
        <>
          <div className="lbl">Topics found</div>
          {out.rows.map(([t, l]) => (
            <div className="row" key={t}>
              <span>{t}</span>
              <Pill label={l} />
            </div>
          ))}
        </>
      );
    case 'language':
      return (
        <>
          <div className="row">
            <span className="lbl">Detected</span>
            <Pill label="neutral">{out.language}</Pill>
          </div>
          <div className="lbl">Cleaned text</div>
          <div className="quote">{out.cleaned}</div>
        </>
      );
    case 'tone':
      return (
        <>
          <div className="row">
            <span>Sarcasm</span>
            <Pill label="negative">Detected</Pill>
          </div>
          <div className="row">
            <span>Words look</span>
            <Pill label={out.surface} />
          </div>
          <div className="row">
            <span>Real meaning</span>
            <Pill label={out.real} />
          </div>
        </>
      );
    case 'fake':
      return (
        <>
          <div className="row">
            <span className="lbl">Verdict</span>
            <Pill label="negative">{out.verdict}</Pill>
          </div>
          <Meter label="Fake score" value={out.score} color="var(--neg)" />
          <div className="quote">{out.note}</div>
        </>
      );
    case 'reply':
      return (
        <>
          <div className="lbl">Suggested reply</div>
          <div className="quote">{out.text}</div>
        </>
      );
    case 'report':
      return (
        <>
          {out.bars.map(([l, v]) => (
            <Meter key={l} label={l} value={v} color={`var(--${l === 'Positive' ? 'pos' : l === 'Neutral' ? 'neu' : 'neg'})`} />
          ))}
          <div className="row">
            <span>Top complaint</span>
            <Pill label="negative">{out.top}</Pill>
          </div>
        </>
      );
    default:
      return (
        <>
          <div className="row">
            <span>Overall</span>
            <Pill label="mixed" />
          </div>
          <div className="row">
            <span>Food</span>
            <Pill label="positive" />
          </div>
          <div className="row">
            <span>Delivery</span>
            <Pill label="negative" />
          </div>
          <div className="row">
            <span>Reply</span>
            <Pill label="positive">Ready</Pill>
          </div>
        </>
      );
  }
}

export default function AgentCard({ agent, className = '' }) {
  const ex = agent.example;
  return (
    <div className={`glass-card ${className}`}>
      <div className="who">
        <span className="av">{ex.who[0]}</span>
        <span>
          <b>{ex.who[1]}</b>
          <small>{ex.who[2]}</small>
        </span>
        <span className="tagline">{agent.name}</span>
      </div>
      <p className="rev">{ex.review}</p>
      {ex.stars ? <Stars n={ex.stars} /> : <div style={{ height: 6 }} />}
      <div className="out">
        <Output out={ex.out} />
      </div>
    </div>
  );
}
