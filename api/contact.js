// @ts-check
// POST /api/contact — sends the Hire Me form to the owner's Gmail inbox.
// Set GMAIL_USER and GMAIL_APP_PASSWORD (and optionally CONTACT_TO_EMAIL) in
// Vercel → Settings → Environment Variables. No email address is ever placed
// in the website's code.

import nodemailer from 'nodemailer';
import { allowRequest, clientIp, isSameOrigin, json, log, newRequestId } from './_lib/http.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PROJECTS = ['Review analysis for my business', 'AI agent or chatbot', 'Machine learning model', 'Data dashboard', 'Something else'];
const clean = (/** @type {unknown} */ v, /** @type {number} */ max) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f<>]/g, ' ').trim().slice(0, max);
const esc = (/** @type {string} */ s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);

/**
 * @param {any} body
 * @returns {{ ok: true, name: string, email: string, project: string, budget: string, message: string } | { ok: false, error: string }}
 */
export function validateContact(body) {
  const name = clean(body?.name, 80);
  const email = clean(body?.email, 120);
  const message = clean(body?.message, 3000);
  const project = PROJECTS.includes(body?.project) ? body.project : 'Something else';
  const budget = clean(body?.budget, 40);
  if (name.length < 2) return { ok: false, error: 'Please enter your name.' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (message.length < 10) return { ok: false, error: 'Please write a short message (at least 10 characters).' };
  return { ok: true, name, email, project, budget, message };
}

/** @param {Request} request */
export async function POST(request) {
  const requestId = newRequestId();
  if (!isSameOrigin(request)) return json({ ok: false, error: 'This form only works on the ReviewMind website.' }, 403, requestId);
  const limit = allowRequest(`contact:${clientIp(request)}`, 5, 10 * 60_000);
  if (!limit.ok) return json({ ok: false, error: 'Too many messages. Please try again in a few minutes.' }, 429, requestId);

  /** @type {any} */
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 12_000) throw new Error('too large');
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'Send the form as JSON.' }, 400, requestId);
  }
  // Hidden field only bots fill in: pretend success, send nothing.
  if (body?._honey) return json({ ok: true }, 200, requestId);

  const v = validateContact(body);
  if (!v.ok) return json({ ok: false, error: v.error }, 400, requestId);

  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (!user || !pass) {
    // Keep the message in the logs so it is never lost.
    log('warn', { requestId, event: 'contact_not_configured', name: v.name, email: v.email, project: v.project, message: v.message });
    return json({ ok: false, error: 'The contact form is not switched on yet. Please try again later.' }, 503, requestId);
  }

  const subject = `New ReviewMind enquiry from ${v.name}`;
  const text = `Name: ${v.name}\nEmail: ${v.email}\nProject: ${v.project}\nBudget: ${v.budget || 'Not given'}\n\n${v.message}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222">
<h2 style="margin:0 0 12px;color:#9b2335">New enquiry from ReviewMind</h2>
<p><strong>Name:</strong> ${esc(v.name)}<br><strong>Email:</strong> ${esc(v.email)}<br><strong>Project:</strong> ${esc(v.project)}<br><strong>Budget:</strong> ${esc(v.budget || 'Not given')}</p>
<p style="padding:12px 16px;background:#f7f1ec;border-radius:8px">${esc(v.message).replace(/\n/g, '<br>')}</p>
<p style="color:#888;font-size:13px">Reply to this email to answer ${esc(v.name)} directly.</p></div>`;

  try {
    const mailer = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await mailer.sendMail({
      from: `ReviewMind website <${user}>`,
      to: process.env.CONTACT_TO_EMAIL?.trim() || user,
      replyTo: `${v.name} <${v.email}>`,
      subject,
      text,
      html,
    });
    log('info', { requestId, event: 'contact', delivered: true });
    return json({ ok: true }, 200, requestId);
  } catch (err) {
    log('error', {
      requestId,
      event: 'contact',
      delivered: false,
      note: String(/** @type {any} */ (err)?.message || err).slice(0, 300),
      name: v.name,
      email: v.email,
      message: v.message,
    });
    return json({ ok: false, error: 'Your message could not be sent right now. Please try again in a few minutes.' }, 502, requestId);
  }
}

export function GET() {
  return json({ ok: false, error: 'Use POST.' }, 405);
}
