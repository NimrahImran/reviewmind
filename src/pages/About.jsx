import { Link } from 'react-router-dom';
import Icon from '../components/Icons.jsx';
import { PageHead, SectionHead } from '../components/Section.jsx';
import { SITE } from '../data/site.js';

const STACK = [
  ['cpu', 'Fine-tuned transformer', 'XLM-RoBERTa fine-tuned in two stages: 16,663 Roman Urdu sentences, then real-style customer reviews. 81.7% accuracy on 60 reviews it never saw. Runs inside the API as a 123 MB int8 model.'],
  ['spark', 'Agentic AI layer', 'Google Gemini with a strict JSON schema runs the topic, tone, fake-review and reply agents in a single call to save quota.'],
  ['shield', 'Always-on fallback', 'A rule-based engine with a Roman Urdu dictionary answers instantly if the AI is busy, so the product never breaks.'],
  ['server', 'Serverless API', 'Node.js functions on Vercel with input validation, rate limiting, origin checks, caching and request IDs in every log line.'],
  ['code', 'React frontend', 'React and Vite, fully responsive from phone to wide screen, with no tracking scripts.'],
  ['check', 'Tested', 'Automated tests cover every agent, the API routes, error cases and the report builder.'],
];

const FLOW = ['Review in', 'Lingo cleans', 'Pulse scores', 'Lens, Echo, Shield, Quill', 'Ledger reports'];

export default function About() {
  return (
    <>
      <PageHead eyebrow="About" title="Why ReviewMind exists">
        Most AI tools read English. Customers in Pakistan and the Gulf write in Roman Urdu, mix languages, use short forms and love sarcasm. ReviewMind was built for how people really write.
      </PageHead>

      <section className="section tight">
        <div className="wrap about-grid">
          <div className="about-text">
            <h2>The problem</h2>
            <p>
              A restaurant in Karachi can get hundreds of reviews a month on Google, Foodpanda and Instagram. Reading them all takes hours, and English-only tools misread “bakwas”, “zabardast” and “wah kya service hai”.
            </p>
            <h2>The answer</h2>
            <p>
              ReviewMind gives each review to a team of seven AI agents. In a few seconds you know how the customer feels, what they are talking about, whether they are being sarcastic, whether the review is fake, and you get a reply ready to send.
            </p>
          </div>
          <ol className="flow" aria-label="How a review moves through ReviewMind">
            {FLOW.map((f, k) => (
              <li key={f}>
                <span>{k + 1}</span>
                {f}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" id="tech">
        <div className="wrap">
          <SectionHead eyebrow="Under the hood" title="Built like a real product">
            Clean code, a documented API and a model you can retrain. Technical clients can check every part.
          </SectionHead>
          <div className="stack-grid">
            {STACK.map(([icon, title, text]) => (
              <article key={title} className="stack">
                <i>
                  <Icon name={icon} />
                </i>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="api-box">
            <div>
              <p className="lbl">API</p>
              <code>POST /api/analyze</code>
              <p>Send up to ten reviews, get every agent’s answer and the report as JSON.</p>
            </div>
            <a className="btn ghost" href="/openapi.json">
              OpenAPI reference <Icon name="ext" />
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="builder">
          <div className="builder-mark" aria-hidden="true">
            NI
          </div>
          <div>
            <p className="eyebrow">Built by</p>
            <h2>{SITE.owner}</h2>
            <p className="builder-role">{SITE.ownerRole}</p>
            <p>{SITE.ownerBio}</p>
            <div className="ctas">
              <Link className="btn solid" to="/hire">
                Work with me <Icon name="arrow" />
              </Link>
            </div>
          </div>
          </div>
        </div>
      </section>
    </>
  );
}
