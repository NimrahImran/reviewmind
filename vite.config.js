import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Runs the /api functions inside the Vite dev server, exactly as Vercel
 * runs them in production (Web Request in, Web Response out).
 */
function localApi() {
  return {
    name: 'reviewmind-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`);
          const handler = mod[req.method];
          if (!handler) {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          const chunks = [];
          for await (const c of req) chunks.push(c);
          const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
          });
          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          if (!response.body) return res.end();
          const reader = response.body.getReader();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.end('API error');
        }
      });
    },
  };
}

/** Puts the real site address into the share-card tags at build time. */
function siteUrl() {
  const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'localhost:5173';
  const url = host.startsWith('http') ? host : `https://${host}`;
  return {
    name: 'reviewmind-site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', url.replace(/\/$/, '')),
  };
}

export default defineConfig(({ mode }) => {
  // Make .env values (like GEMINI_API_KEY) visible to the local /api functions.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

  return {
    plugins: [react(), localApi(), siteUrl()],
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // React rarely changes, so browsers can keep it cached between updates.
          manualChunks: { react: ['react', 'react-dom'] },
        },
      },
    },
  };
});
