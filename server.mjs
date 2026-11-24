import {createHash} from 'node:crypto';
import {readdir, readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import handler from 'serve-handler';

const buildDirectory = fileURLToPath(new URL('./build/', import.meta.url));

// Trust only scripts emitted by the reviewed static build. Never hash request data.
export async function buildSecurityHeaders(root) {
  const hashes = new Set();
  let htmlFiles = 0;
  async function visit(directory) {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
      htmlFiles++;
      const html = await readFile(path, 'utf8');
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        if (/\bsrc\s*=/i.test(match[1]) || !match[2].trim()) continue;
        hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
      }
    }
  }
  await visit(root);
  if (!htmlFiles) throw new Error('Documentation build is missing');
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${[...hashes].sort().join(' ')}`.trim(),
    // Docusaurus/React emit inline styles for theme and code highlighting.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:", "font-src 'self' data:", "connect-src 'self'",
    "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
  if (Buffer.byteLength(policy) > 8192) throw new Error('Documentation script policy exceeds the header budget');
  return {
    'Content-Security-Policy': policy,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

export async function createDocumentationServer({root = buildDirectory} = {}) {
  const directory = resolve(root);
  const headers = await buildSecurityHeaders(directory);
  return createServer(async (request, response) => {
    // Set these before routing so errors, redirects and conditional responses inherit them.
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    try {
      const path = decodeURIComponent((request.url ?? '').split('?')[0]);
      if (!path.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(path)) throw new Error('Invalid path');
    } catch {
      response.writeHead(400, {'Content-Type': 'text/plain; charset=utf-8'});
      response.end('Invalid request');
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, {'Allow': 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8'});
      response.end('Method not allowed');
      return;
    }
    try {
      // Same clean-URL routing as Docusaurus serve for this site's baseUrl '/'.
      await handler(request, response, {
        public: directory, cleanUrls: true, directoryListing: false, symlinks: false,
      });
    } catch {
      if (response.headersSent) { response.destroy(); return; }
      response.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'});
      response.end('Unable to serve documentation');
    }
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid server port');
  const server = await createDocumentationServer();
  server.listen(port, '0.0.0.0', () => console.log('Documentation server ready'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close());
}
