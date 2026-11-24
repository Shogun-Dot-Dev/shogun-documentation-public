import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {request} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {buildSecurityHeaders, createDocumentationServer} from '../server.mjs';

const trustedScript = 'window.docsTheme="dark";';
const trustedHash = createHash('sha256').update(trustedScript).digest('base64');

test('security headers cover pages, assets, errors, redirects, HEAD and range responses', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'docs-headers-'));
  const root = join(temp, 'public');
  await mkdir(root);
  await writeFile(join(temp, 'private.txt'), 'private-fixture');
  await writeFile(join(root, 'index.html'), `<html><script>${trustedScript}</script><h1>Docs</h1></html>`);
  await writeFile(join(root, 'guide.html'), '<h1>Guide</h1>');
  await writeFile(join(root, '404.html'), '<h1>Not found</h1>');
  await writeFile(join(root, 'app.js'), 'window.docsLoaded = true;');
  const server = await createDocumentationServer({root});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [path, options, status] of [
      ['/', {}, 200], ['/guide', {}, 200], ['/app.js', {}, 200],
      ['/missing', {}, 404], ['/guide.html', {redirect: 'manual'}, 301],
      ['/', {method: 'HEAD'}, 200], ['/app.js', {headers: {Range: 'bytes=0-5'}}, 206],
      ['/', {method: 'POST'}, 405], ['/package.json', {}, 404],
      ['/%00', {}, 400], ['/%invalid', {}, 400],
    ]) {
      const response = await fetch(origin + path, options);
      assert.equal(response.status, status, path);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000');
      const policy = response.headers.get('content-security-policy');
      assert.ok(policy.includes(`'sha256-${trustedHash}'`));
      assert.ok(policy.includes("frame-ancestors 'none'"));
      const scripts = policy.split(';').map(x => x.trim()).find(x => x.startsWith('script-src '));
      assert.ok(scripts);
      assert.ok(!scripts.includes('unsafe-inline'));
      assert.ok(!policy.includes('unsafe-eval'));
      await response.body?.cancel();
    }
    // Use the raw HTTP path so URL normalization cannot hide traversal defects.
    for (const path of ['/%2e%2e%2fprivate.txt', '/..%5cprivate.txt', '/%00']) {
      const body = await new Promise((resolve, reject) => {
        const req = request(origin, {path}, response => {
          let result = ''; response.on('data', chunk => result += chunk);
          response.on('end', () => resolve(result));
          assert.equal(response.headers['x-frame-options'], 'DENY');
        });
        req.on('error', reject); req.end();
      });
      assert.ok(!body.includes('private-fixture'));
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(temp, {recursive: true, force: true});
  }
});

test('missing build fails closed and request strings cannot add allowed scripts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-build-'));
  try {
    await assert.rejects(buildSecurityHeaders(root), /build is missing/);
    await writeFile(join(root, 'index.html'), `<script>${trustedScript}</script>`);
    const headers = await buildSecurityHeaders(root);
    const untrustedHash = createHash('sha256').update('window.untrusted=true;').digest('base64');
    assert.ok(!headers['Content-Security-Policy'].includes(untrustedHash));
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('actual documentation build produces a bounded hash policy', async () => {
  const headers = await buildSecurityHeaders(fileURLToPath(new URL('../build/', import.meta.url)));
  assert.ok(headers['Content-Security-Policy'].includes('sha256-'));
  assert.ok(Buffer.byteLength(headers['Content-Security-Policy']) <= 8192);
  const config = await readFile(new URL('../docusaurus.config.ts', import.meta.url), 'utf8');
  assert.match(config, /baseUrl:\s*'\/'/);
});
