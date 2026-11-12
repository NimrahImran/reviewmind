import { useState } from 'react';
import Icon from '../components/Icons.jsx';
import { PageHead } from '../components/Section.jsx';
import { SITE } from '../data/site.js';

const PROJECTS = ['Review analysis for my business', 'AI agent or chatbot', 'Machine learning model', 'Data dashboard', 'Something else'];
const BUDGETS = ['Under $500', '$500 – $2,000', '$2,000 – $10,000', '$10,000+', 'Not sure yet'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SERVICES = [
  ['store', 'ReviewMind for your business', 'Connect your Google, Daraz or Foodpanda reviews and get weekly reports and reply drafts.'],
  ['users', 'Custom AI agents', 'Agents that read, decide and act for your team, built around your own data.'],
  ['cpu', 'Fine-tuned models', 'Models trained on your language and your customers, including Roman Urdu.'],
];

export default function Hire() {
  const [form, setForm] = useState({ name: '', email: '', project: PROJECTS[0], budget: BUDGETS[4], message: '', _honey: '' });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle');
  const [serverError, setServerError] = useState('');
  const links = Object.entries(SITE.links).filter(([, url]) => url);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (form.name.trim().length < 2) er.name = 'Enter your name.';
    if (!EMAIL_RE.test(form.email.trim())) er.email = 'Enter a valid email address.';
    if (form.message.trim().length < 10) er.message = 'Write a short message (at least 10 characters).';
    setErrors(er);
    if (Object.keys(er).length) return;
    setState('sending');
    setServerError('');
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || 'Your message could not be sent. Please try again.');
      setState('sent');
    } catch (err) {
      setServerError(err.message === 'Failed to fetch' ? 'Could not reach the server. Check your connection and try again.' : err.message);
      setState('idle');
    }
  };

  return (
    <>
      <PageHead eyebrow="Hire me" title="Let’s build your AI system">
        Need ReviewMind for your business, or a custom AI agent or model? Tell me about your project and I’ll reply within 24 hours.
      </PageHead>

      <section className="section tight">
        <div className="wrap hire-layout">
          <div className="hire-side">
            {SERVICES.map(([icon, title, text]) => (
              <article key={title} className="service">
                <i>
                  <Icon name={icon} />
                </i>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
            {links.length > 0 && (
              <div className="profiles">
                <p className="lbl">Also find me on</p>
                {links.map(([k, url]) => (
                  <a key={k} className="btn ghost" href={url} target="_blank" rel="noreferrer">
                    {k[0].toUpperCase() + k.slice(1)} <Icon name="ext" />
                  </a>
                ))}
              </div>
            )}
            <img className="hire-bot" src="/img/quill.webp" alt="" width="900" height="900" loading="lazy" />
          </div>

          <div className="panel">
            {state === 'sent' ? (
              <div className="sent" role="status">
                <i>
                  <Icon name="check" />
                </i>
                <h2>Message sent</h2>
                <p>Thank you, {form.name.split(' ')[0]}. I’ll reply to {form.email} within 24 hours.</p>
                <button type="button" className="btn ghost" onClick={() => { setForm({ ...form, message: '' }); setState('idle'); }}>
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="hire-form">
                <div className="two">
                  <div className="field">
                    <label htmlFor="name">Your name</label>
                    <input id="name" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} placeholder="Ali Khan" />
                    {errors.name && <p className="field-error">{errors.name}</p>}
                  </div>
                  <div className="field">
                    <label htmlFor="email">Email</label>
                    <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} placeholder="ali@company.com" />
                    {errors.email && <p className="field-error">{errors.email}</p>}
                  </div>
                </div>
                <div className="two">
                  <div className="field">
                    <label htmlFor="project">What do you need?</label>
                    <select id="project" value={form.project} onChange={set('project')}>
                      {PROJECTS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="budget">Budget</label>
                    <select id="budget" value={form.budget} onChange={set('budget')}>
                      {BUDGETS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="message">Tell me about your project</label>
                  <textarea id="message" rows={6} value={form.message} onChange={set('message')} aria-invalid={!!errors.message} placeholder="I run a restaurant in Lahore and get around 300 reviews a month…" />
                  {errors.message && <p className="field-error">{errors.message}</p>}
                </div>
                <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form._honey} onChange={set('_honey')} name="company_website" />
                {serverError && (
                  <p className="form-error" role="alert">
                    {serverError}
                  </p>
                )}
                <button className="btn solid big" type="submit" disabled={state === 'sending'}>
                  {state === 'sending' ? 'Sending…' : (<>Send message <Icon name="arrow" /></>)}
                </button>
                <p className="help center">Your details are only used to reply to you.</p>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
