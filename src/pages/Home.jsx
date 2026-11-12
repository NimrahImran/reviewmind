import { Link } from 'react-router-dom';
import Hero from '../components/Hero.jsx';
import Icon from '../components/Icons.jsx';
import { SectionHead } from '../components/Section.jsx';
import { AGENTS } from '../data/agents.js';

const STRENGTHS = [
  ['globe', 'Roman Urdu first', 'Reads “bht acha tha yr” as easily as English, with no translation step.'],
  ['wave', 'Understands sarcasm', '“Wah kya service hai” is caught as a complaint, not praise.'],
  ['layers', 'Topic by topic', 'One review can love the food and hate the delivery. You see both.'],
  ['shield', 'Honest numbers', 'Fake and spam reviews are flagged before they reach your report.'],
];

const STEPS = [
  ['upload', 'Paste your reviews', 'Copy reviews from Google, Daraz, Foodpanda, Instagram or WhatsApp. Up to ten at a time in the demo.'],
  ['users', 'Seven agents read them', 'Each agent does one job: feeling, topics, language, tone, fake check, reply and report.'],
  ['bolt', 'Act on the answer', 'See your top complaint, copy ready replies and know exactly what to fix first.'],
];

const FOR = ['Restaurants', 'Cafes', 'Online stores', 'Hotels', 'Salons', 'Clinics', 'Delivery apps', 'Brands on Daraz'];

export default function Home() {
  return (
    <>
      <Hero />

      <section className="section">
        <div className="wrap">
          <div className="strengths">
            {STRENGTHS.map(([icon, title, text]) => (
              <article key={title} className="strength">
                <i>
                  <Icon name={icon} />
                </i>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <SectionHead eyebrow="How it works" title="From messy reviews to clear decisions">
            Customers in Pakistan and the Gulf write the way they talk. ReviewMind is built for exactly that.
          </SectionHead>
          <ol className="steps">
            {STEPS.map(([icon, title, text], k) => (
              <li key={title} className="step">
                <span className="step-num">{k + 1}</span>
                <i>
                  <Icon name={icon} />
                </i>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow="The team" title="Seven agents, each with one job">
            Like a real team, every agent is a specialist. Together they read a review in seconds.
          </SectionHead>
          <div className="agent-grid">
            {AGENTS.map((a) => (
              <Link key={a.id} to={`/agents#${a.id}`} className="agent-tile" style={{ '--c': a.color }}>
                <img src={`/img/${a.id}-head.webp`} alt="" width="160" height="160" loading="lazy" />
                <div>
                  <h3>{a.name}</h3>
                  <p className="tile-role">{a.role}</p>
                  <p>{a.short}</p>
                </div>
              </Link>
            ))}
            <Link to="/demo" className="agent-tile tile-cta">
              <div>
                <h3>See them work</h3>
                <p>Run the live demo on your own reviews.</p>
              </div>
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="for-band">
            <div>
              <p className="eyebrow">Built for</p>
              <h2>Any business that lives on reviews</h2>
            </div>
            <ul className="chips">
              {FOR.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta-band">
            <img src="/img/team.webp" alt="" width="1500" height="576" loading="lazy" />
            <div className="cta-copy">
              <h2>Try ReviewMind on your own reviews</h2>
              <p>Paste a review in Roman Urdu or English and watch all seven agents answer.</p>
              <div className="ctas">
                <Link className="btn solid" to="/demo">
                  Open the live demo <Icon name="arrow" />
                </Link>
                <Link className="btn ghost" to="/hire">
                  Get it for your business
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
