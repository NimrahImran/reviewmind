// Builds public/openapi.json, the machine-readable API reference.
// Run: node scripts/build-openapi.mjs
import { writeFileSync } from 'node:fs';
import { BUSINESSES, LIMITS } from '../api/_lib/pipeline.js';

const label = { type: 'string', enum: ['positive', 'neutral', 'negative'] };
const error = { type: 'object', properties: { ok: { const: false }, error: { type: 'string' }, requestId: { type: 'string' } } };

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'ReviewMind API',
    version: '1.0.0',
    description: 'Seven AI agents that analyze customer reviews in Roman Urdu, English and Urdu: sentiment (Pulse), topics (Lens), language clean-up (Lingo), tone and sarcasm (Echo), fake-review score (Shield), reply drafts (Quill) and a batch report (Ledger).',
    contact: { name: 'Nimra Imran' },
    license: { name: 'MIT' },
  },
  servers: [{ url: '/' }],
  paths: {
    '/api/analyze': {
      get: {
        summary: 'Check that the fine-tuned model is live',
        description: 'With ?check=model, loads the Pulse model and runs it on two fixed sentences. Limit: 6 requests per minute per IP.',
        parameters: [{ name: 'check', in: 'query', required: true, schema: { type: 'string', enum: ['model'] } }],
        responses: {
          200: { description: 'Model answered', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, model: { type: 'string' }, ms: { type: 'integer' }, results: { type: 'array', items: { type: 'object' } } } } } } },
          503: { description: 'Model unavailable; the site falls back to the other engines' },
        },
      },
      post: {
        summary: 'Analyze up to ten reviews',
        description: `Runs every review through all seven agents. Up to ${LIMITS.maxReviews} reviews, ${LIMITS.minChars}–${LIMITS.maxChars} characters each. Identical requests are cached for 10 minutes. Limit: 12 requests per minute per IP.`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reviews'],
                properties: {
                  reviews: {
                    type: 'array',
                    maxItems: LIMITS.maxReviews,
                    items: {
                      oneOf: [
                        { type: 'string', minLength: LIMITS.minChars, maxLength: LIMITS.maxChars },
                        { type: 'object', required: ['text'], properties: { text: { type: 'string' }, stars: { type: 'integer', minimum: 1, maximum: 5 } } },
                      ],
                    },
                  },
                  business: { type: 'string', enum: BUSINESSES, default: 'Other' },
                },
              },
              example: { reviews: ['Khana zabardast tha lekin delivery bohat late thi', { text: 'Wah kya service hai, sirf 3 ghante wait kiya', stars: 2 }], business: 'Restaurant' },
            },
          },
        },
        responses: {
          200: {
            description: 'Every agent’s answer and the report',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { const: true },
                    mode: { type: 'string', enum: ['full', 'basic'], description: 'basic = rule-based engine (no AI key, or AI busy)' },
                    engines: { type: 'object', properties: { analysis: { type: 'string' }, sentiment: { type: 'string' } } },
                    notice: { type: 'string' },
                    results: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          index: { type: 'integer' },
                          text: { type: 'string' },
                          stars: { type: ['integer', 'null'] },
                          overall: { type: 'string', enum: ['positive', 'neutral', 'negative', 'mixed'] },
                          lingo: { type: 'object', properties: { language: { type: 'string' }, cleaned: { type: 'string' } } },
                          pulse: { type: 'object', properties: { label, confidence: { type: 'number' }, source: { type: 'string' } } },
                          lens: { type: 'array', items: { type: 'object', properties: { aspect: { type: 'string' }, sentiment: label, evidence: { type: 'string' } } } },
                          echo: { type: 'object', properties: { sarcasm: { type: 'boolean' }, emotion: { type: 'string' }, real_sentiment: label, note: { type: 'string' } } },
                          shield: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 100 }, verdict: { type: 'string', enum: ['genuine', 'suspicious', 'likely fake'] }, reasons: { type: 'array', items: { type: 'string' } } } },
                          quill: { type: 'object', properties: { reply: { type: 'string' }, language: { type: 'string' } } },
                        },
                      },
                    },
                    report: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        sentiment: { type: 'object', properties: { positive: { type: 'integer' }, neutral: { type: 'integer' }, negative: { type: 'integer' } } },
                        topComplaint: { type: ['string', 'null'] },
                        topPraise: { type: ['string', 'null'] },
                        flagged: { type: 'integer' },
                        sarcastic: { type: 'integer' },
                        headline: { type: 'string' },
                        actions: { type: 'array', items: { type: 'string' } },
                      },
                    },
                    trace: { type: 'array', items: { type: 'object', properties: { agent: { type: 'string' }, engine: { type: 'string' }, ms: { type: 'integer' } } } },
                    requestId: { type: 'string' },
                  },
                },
              },
            },
          },
          400: { description: 'Invalid input', content: { 'application/json': { schema: error } } },
          403: { description: 'Request from another website', content: { 'application/json': { schema: error } } },
          429: { description: 'Too many requests', content: { 'application/json': { schema: error } } },
        },
      },
    },
    '/api/contact': {
      post: {
        summary: 'Send the Hire Me form to the owner’s inbox',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'message'],
                properties: { name: { type: 'string', minLength: 2 }, email: { type: 'string', format: 'email' }, project: { type: 'string' }, budget: { type: 'string' }, message: { type: 'string', minLength: 10, maxLength: 3000 } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Sent' },
          400: { description: 'Invalid form', content: { 'application/json': { schema: error } } },
          429: { description: 'Too many messages', content: { 'application/json': { schema: error } } },
          503: { description: 'Email not configured on the server', content: { 'application/json': { schema: error } } },
        },
      },
    },
    '/api/health': {
      get: { summary: 'Service status (never shows keys)', responses: { 200: { description: 'Status' } } },
    },
  },
};

writeFileSync(new URL('../public/openapi.json', import.meta.url), JSON.stringify(spec, null, 2) + '\n');
console.log('public/openapi.json written');
