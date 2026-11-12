import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AGENTS, TEAM } from '../data/agents.js';
import AgentCard from './AgentCard.jsx';
import Icon from './Icons.jsx';

const SLIDES = [...AGENTS, TEAM];
const N = SLIDES.length;
const MS = 10_000;

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export default function Hero() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const touch = useRef(null);
  const bar = useRef(null);
  const a = SLIDES[i];

  const go = useCallback((k) => {
    setI(((k % N) + N) % N);
    setCycle((c) => c + 1);
  }, []);

  // Each agent's colour tints the whole page while its slide is showing.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', a.color);
    root.style.setProperty('--glow', rgba(a.color, a.id === 'shield' ? 0.32 : 0.5));
    return () => {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--glow');
    };
  }, [a]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => (document.hidden ? setCycle((c) => c + 1) : go(i + 1)), MS);
    return () => clearTimeout(t);
  }, [i, paused, cycle, go]);

  // Keep the active agent visible in the bar on small screens.
  useEffect(() => {
    const el = bar.current?.children[i];
    if (!el || !bar.current) return;
    const b = bar.current;
    if (el.offsetLeft < b.scrollLeft || el.offsetLeft + el.offsetWidth > b.scrollLeft + b.clientWidth) {
      b.scrollTo({ left: el.offsetLeft - 16, behavior: 'smooth' });
    }
  }, [i]);

  const onKey = (e) => {
    if (e.key === 'ArrowRight') go(i + 1);
    if (e.key === 'ArrowLeft') go(i - 1);
  };

  return (
    <section className={`hero ${paused ? 'paused' : ''}`} aria-roledescription="carousel" aria-label="ReviewMind agents" onKeyDown={onKey}>
      <div className="hero-bg" aria-hidden="true" />
      <div className="wrap hero-wrap">
        <div className="hero-main">
          <div className="hero-copy" aria-live="polite">
            <div className="fade" key={a.id}>
              <p className="count">{a.id === 'team' ? 'The team' : <>Agent <b>{String(i + 1).padStart(2, '0')}</b> / 07</>}</p>
              <h1>{a.name}</h1>
              <p className="role">{a.role}</p>
              <div className="words">
                {a.words.map((w) => (
                  <span key={w}>{w}.</span>
                ))}
              </div>
              <p className="desc">{a.desc}</p>
              <ul className="feats">
                {a.feats.map(([icon, text]) => (
                  <li key={text}>
                    <i>
                      <Icon name={icon} />
                    </i>
                    {text}
                  </li>
                ))}
              </ul>
              <div className="ctas">
                <Link className="btn solid" to="/demo">
                  Analyze a review <Icon name="arrow" />
                </Link>
                <Link className="btn ghost" to="/agents">
                  Meet the agents
                </Link>
              </div>
            </div>
          </div>

          <div
            className={`stage ${a.id === 'team' ? 'isteam' : ''}`}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touch.current == null) return;
              const d = e.changedTouches[0].clientX - touch.current;
              if (Math.abs(d) > 50) go(i + (d < 0 ? 1 : -1));
              touch.current = null;
            }}
          >
            <div className={`team ${a.id === 'team' ? 'on' : ''}`}>
              <img src="/img/team.webp" alt="All seven ReviewMind agents standing together" width="1500" height="576" />
            </div>
            {AGENTS.map((x, k) => (
              <div key={x.id} className={`bot ${k === i ? 'on' : ''}`}>
                <img src={`/img/${x.id}.webp`} alt={k === i ? `${x.name}, the ${x.role.toLowerCase()} agent` : ''} width="900" height="900" loading={k < 2 ? 'eager' : 'lazy'} />
              </div>
            ))}
            <AgentCard agent={a} key={`card-${a.id}`} className="hero-card swap" />
          </div>
        </div>

        <div className="hero-bar">
          <div className="agents-bar" ref={bar} role="tablist" aria-label="Choose an agent">
            {SLIDES.map((x, k) => (
              <button key={x.id} type="button" role="tab" aria-selected={k === i} className={`ag ${k === i ? 'on' : ''}`} onClick={() => go(k)}>
                <img alt="" src={`/img/${x.id === 'team' ? 'pulse' : x.id}-head.webp`} width="34" height="34" />
                <span>{x.name}</span>
                <u key={k === i ? cycle : 'idle'} />
              </button>
            ))}
          </div>
          <div className="arrows">
            <button type="button" aria-label="Previous agent" onClick={() => go(i - 1)}>
              <Icon name="left" />
            </button>
            <button type="button" aria-label="Next agent" onClick={() => go(i + 1)}>
              <Icon name="arrow" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
