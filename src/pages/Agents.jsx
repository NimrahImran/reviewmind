import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AgentCard from '../components/AgentCard.jsx';
import Icon from '../components/Icons.jsx';
import { PageHead } from '../components/Section.jsx';
import { AGENTS } from '../data/agents.js';

export default function Agents() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 80);
  }, [hash]);

  return (
    <>
      <PageHead eyebrow="The agents" title="Meet the team behind every answer">
        ReviewMind splits review analysis into seven small jobs. Each agent is a specialist, and together they turn one messy review into clear, useful answers.
      </PageHead>

      <nav className="wrap agent-jump" aria-label="Jump to an agent">
        {AGENTS.map((a) => (
          <a key={a.id} href={`#${a.id}`} style={{ '--c': a.color }}>
            <img src={`/img/${a.id}-head.webp`} alt="" width="28" height="28" />
            {a.name}
          </a>
        ))}
      </nav>

      {AGENTS.map((a, k) => (
        <section key={a.id} id={a.id} className={`agent-row ${k % 2 ? 'flip' : ''}`} style={{ '--c': a.color }}>
          <div className="wrap agent-row-in">
            <div className="agent-copy">
              <p className="count">
                Agent <b>{String(k + 1).padStart(2, '0')}</b> / 07
              </p>
              <h2>{a.name}</h2>
              <p className="role">{a.role}</p>
              <p className="agent-long">{a.long}</p>
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
              <p className="engine">
                <Icon name="cpu" /> Runs on: {a.engine}
              </p>
            </div>
            <div className="agent-visual">
              <div className="agent-glow" aria-hidden="true" />
              <img className="agent-bot" src={`/img/${a.id}.webp`} alt={`${a.name}, the ${a.role.toLowerCase()} agent`} width="900" height="900" loading="lazy" />
              <AgentCard agent={a} className="agent-visual-card" />
            </div>
          </div>
        </section>
      ))}

      <section className="section">
        <div className="wrap">
          <div className="cta-band slim">
            <div className="cta-copy">
              <h2>See all seven work on your reviews</h2>
              <div className="ctas">
                <Link className="btn solid" to="/demo">
                  Open the live demo <Icon name="arrow" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
