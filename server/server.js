#!/usr/bin/env node
'use strict';
/*
 * Samestate — one interaction, every device.
 * Zero-dependency server:
 *   :BASE        the shell UI
 *   :BASE+1..N   one reverse proxy per device (own origin, own user-agent)
 * Each proxy strips frame-blocking headers and injects the sync agent.
 */
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path');
const os = require('os'), net = require('net'), tls = require('tls'), zlib = require('zlib');
const { spawn } = require('child_process');

const ROOT = __dirname;
const BASE = parseInt(process.env.PORT || '4700', 10);
const SLOTS = 12;
const WIN = process.platform === 'win32';
const NPM = WIN ? 'npm.cmd' : 'npm';

const state = { status: 'idle', log: [], target: null, kind: null, source: null, startPath: '/', error: null };
const uaBySlot = {};
let child = null, staticSrv = null, job = 0;

const log = s => { state.log.push(s); if (state.log.length > 300) state.log.shift(); console.log('  ' + s); };

const MIME = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.wasm': 'application/wasm', '.map': 'application/json', '.pdf': 'application/pdf' };

function sendFile(res, file, extra) {
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, Object.assign({ 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }, extra));
    res.end(buf);
  });
}

/* ---------- static server for repos / folders without a dev server ---------- */
function staticHandler(dir) {
  return (req, res) => {
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { p = '/'; }
    let f = path.join(dir, p);
    if (!f.startsWith(dir)) { res.writeHead(403); return res.end(); }
    const isFile = x => { try { return fs.statSync(x).isFile(); } catch (e) { return false; } };
    const isDir = x => { try { return fs.statSync(x).isDirectory(); } catch (e) { return false; } };
    if (isDir(f)) f = path.join(f, 'index.html');
    if (!isFile(f)) {
      if (isFile(f + '.html')) f += '.html';
      else if (!path.extname(p) && isFile(path.join(dir, 'index.html'))) f = path.join(dir, 'index.html'); // SPA fallback
    }
    sendFile(res, f);
  };
}
const freePort = () => new Promise((ok, no) => { const s = net.createServer(); s.on('error', no); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });

function run(cmd, args, opts, id) {
  return new Promise((ok, no) => {
    log('$ ' + cmd + ' ' + args.join(' '));
    const c = spawn(cmd, args, Object.assign({ shell: WIN }, opts));
    const out = d => String(d).split(/\r?\n/).map(strip).filter(Boolean).slice(-4).forEach(l => id === job && log('  ' + l.slice(0, 200)));
    c.stdout.on('data', out); c.stderr.on('data', out);
    c.on('error', no);
    c.on('close', code => code === 0 ? ok() : no(new Error(cmd + ' ' + args[0] + ' exited with code ' + code)));
  });
}
const strip = s => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').trim();

function cleanup() {
  if (child) { try { WIN ? spawn('taskkill', ['/pid', child.pid, '/T', '/F']) : process.kill(-child.pid, 'SIGTERM'); } catch (e) { try { child.kill(); } catch (e2) {} } child = null; }
  if (staticSrv) { try { staticSrv.close(); } catch (e) {} staticSrv = null; }
}

function setTarget(origin, kind, startPath, id) {
  if (id !== job) return;
  Object.assign(state, { target: origin, kind, startPath: startPath || '/', status: 'ready' });
  log('✓ Ready: ' + origin + ' (' + kind + ')');
}

function parseRepo(src) {
  let m = src.match(/^(?:https?:\/\/)?(?:www\.)?(github\.com|gitlab\.com|bitbucket\.org)\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+))?\/?$/i);
  if (m) return { url: `https://${m[1]}/${m[2]}/${m[3]}.git`, name: `${m[2]}-${m[3]}`, branch: m[4] };
  if (/^git@|\.git$/.test(src)) return { url: src, name: src.replace(/\.git$/, '').split(/[/:]/).slice(-2).join('-') };
  return null;
}

function findStaticRoot(dir) {
  for (const sub of ['', 'dist', 'build', 'out', '_site', 'public', 'docs', 'site', 'www']) {
    if (fs.existsSync(path.join(dir, sub, 'index.html'))) return { dir: path.join(dir, sub), start: '/' };
  }
  const html = fs.readdirSync(dir).find(f => /\.html?$/i.test(f));
  return html ? { dir, start: '/' + html } : null;
}

async function serveDir(dir, id, kind, start) {
  const port = await freePort();
  staticSrv = http.createServer(staticHandler(dir)).listen(port, '127.0.0.1');
  setTarget('http://127.0.0.1:' + port, kind, start, id);
}

function waitForServer(c, port, id) {
  return new Promise((ok, no) => {
    let done = false, urlSeen = null;
    const finish = (fn, v) => { if (!done) { done = true; clearInterval(iv); clearTimeout(to); fn(v); } };
    const probe = (p, cb) => { const s = net.connect(p, '127.0.0.1'); s.on('connect', () => { s.destroy(); cb(true); }); s.on('error', () => cb(false)); };
    const onData = d => String(d).split(/\r?\n/).map(strip).filter(Boolean).forEach(l => {
      if (id === job) log('  ' + l.slice(0, 200));
      const m = l.match(/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d+)/);
      if (m && !urlSeen) urlSeen = { proto: l.includes('https://' + m[1]) ? 'https' : 'http', port: +m[2] };
    });
    c.stdout.on('data', onData); c.stderr.on('data', onData);
    c.on('close', code => finish(no, new Error('Dev server exited (code ' + code + ') before it started listening')));
    const iv = setInterval(() => {
      const p = urlSeen ? urlSeen.port : port;
      probe(p, up => up && finish(ok, (urlSeen ? urlSeen.proto : 'http') + '://localhost:' + p));
    }, 500);
    const to = setTimeout(() => finish(no, new Error('Timed out waiting for the dev server (3 min)')), 180000);
  });
}

async function project(dir, id, label) {
  let pkg = null; try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch (e) {}
  const scripts = (pkg && pkg.scripts) || {};
  const script = ['dev', 'start', 'serve', 'preview'].find(s => scripts[s]);
  const install = async () => { if (!fs.existsSync(path.join(dir, 'node_modules'))) await run(NPM, ['install', '--no-audit', '--no-fund'], { cwd: dir }, id); };
  if (script) {
    await install();
    const port = await freePort();
    log('$ npm run ' + script + '  (PORT=' + port + ')');
    child = spawn(NPM, ['run', script], { cwd: dir, shell: WIN, detached: !WIN, env: Object.assign({}, process.env, { PORT: String(port), BROWSER: 'none', FORCE_COLOR: '0' }) });
    const origin = await waitForServer(child, port, id);
    return setTarget(origin, label + ' · dev server', '/', id);
  }
  let found = findStaticRoot(dir);
  if (!found && scripts.build) { await install(); await run(NPM, ['run', 'build'], { cwd: dir }, id); found = findStaticRoot(dir); }
  if (!found) throw new Error('No index.html and no dev/start script found in ' + dir);
  log('Serving static files from ' + found.dir);
  await serveDir(found.dir, id, label + ' · static', found.start);
}

async function openSource(src) {
  const id = ++job; cleanup();
  Object.assign(state, { status: 'working', log: [], target: null, error: null, source: src, startPath: '/', kind: null });
  try {
    src = String(src || '').trim();
    if (!src) throw new Error('Enter a URL, a repo, or a folder path');
    if (src === 'demo') return await serveDir(path.join(ROOT, 'demo'), id, 'demo');
    const local = path.resolve(src.replace(/^~(?=$|\/)/, os.homedir()));
    const repo = parseRepo(src);
    if (repo) {
      const dir = path.join(os.tmpdir(), 'samestate-repos', repo.name.replace(/[^\w.-]/g, '_'));
      fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(path.dirname(dir), { recursive: true });
      await run('git', ['clone', '--depth', '1'].concat(repo.branch ? ['-b', repo.branch] : [], [repo.url, dir]), {}, id);
      if (id !== job) return;
      await project(dir, id, 'repo');
    } else if (!/^https?:\/\//i.test(src) && fs.existsSync(local) && fs.statSync(local).isDirectory()) {
      await project(local, id, 'folder');
    } else {
      let u = src; if (!/^https?:\/\//i.test(u)) u = (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u) ? 'http://' : 'https://') + u;
      const url = new URL(u);
      setTarget(url.origin, 'live site', url.pathname + url.search + url.hash, id);
    }
  } catch (e) { if (id === job) { state.status = 'error'; state.error = e.message; log('✖ ' + e.message); } }
}

/* ------------------------------- device proxy ------------------------------- */
const STRIP = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'strict-transport-security', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy', 'permissions-policy'];
const noWww = h => h.replace(/^www\./, '');
const errPage = msg => `<!doctype html><body style="margin:0;font:14px system-ui;color:#8a93a6;background:#12151c;display:grid;place-items:center;height:100vh;text-align:center;padding:24px">${msg}</body>`;

function inject(html, slot, target, self) {
  const tag = `<script src="/__samestate/agent.js" data-slot="${slot}"></script>`;
  html = html.split(target).join(self);
  html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + tag);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, m => m + tag);
  if (/<!doctype[^>]*>/i.test(html)) return html.replace(/<!doctype[^>]*>/i, m => m + tag);
  return tag + html;
}

function proxyHandler(slot) {
  return (req, res) => {
    const self = 'http://' + req.headers.host;
    if (req.url.startsWith('/__samestate/agent.js')) return sendFile(res, path.join(ROOT, 'public', 'agent.js'));
    const t = state.target;
    if (!t) { res.writeHead(503, { 'content-type': 'text/html' }); return res.end(errPage('No site loaded yet')); }
    let u; try { u = new URL(req.url, t); } catch (e) { res.writeHead(400); return res.end(); }
    const headers = Object.assign({}, req.headers);
    headers.host = u.host; headers['accept-encoding'] = 'identity';
    for (const h of ['referer', 'origin']) if (headers[h]) headers[h] = headers[h].split(self).join(t);
    for (const h of Object.keys(headers)) if (/^sec-(fetch|ch)-/.test(h)) delete headers[h];
    if (uaBySlot[slot]) headers['user-agent'] = uaBySlot[slot];
    const up = (u.protocol === 'https:' ? https : http).request(u, { method: req.method, headers }, r => {
      const h = Object.assign({}, r.headers);
      for (const k of STRIP) delete h[k];
      if (h.location) {
        try {
          const l = new URL(h.location, u);
          if (l.origin === t) h.location = l.pathname + l.search + l.hash;
          else if (noWww(l.hostname) === noWww(new URL(t).hostname)) { state.target = l.origin; h.location = l.pathname + l.search + l.hash; } // http→https / www canonicalisation
        } catch (e) {}
      }
      if (h['set-cookie']) h['set-cookie'] = [].concat(h['set-cookie']).map(c => c.replace(/;\s*domain=[^;]*/i, '').replace(/;\s*secure/i, '').replace(/;\s*samesite=none/i, '; SameSite=Lax'));
      if (/text\/html/i.test(h['content-type'] || '')) {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => {
          let buf = Buffer.concat(chunks);
          try { const enc = h['content-encoding']; if (enc === 'gzip') buf = zlib.gunzipSync(buf); else if (enc === 'br') buf = zlib.brotliDecompressSync(buf); else if (enc === 'deflate') buf = zlib.inflateSync(buf); } catch (e) {}
          delete h['content-encoding']; delete h['content-length']; delete h['etag'];
          const out = Buffer.from(inject(buf.toString('utf8'), slot, t, self));
          h['content-length'] = out.length;
          res.writeHead(r.statusCode, h); res.end(out);
        });
      } else { res.writeHead(r.statusCode, h); r.pipe(res); }
    });
    up.on('error', e => { if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/html' }); res.end(errPage('Could not reach ' + t + '<br><small>' + e.message + '</small>')); });
    req.pipe(up);
  };
}

function proxyUpgrade(req, sock, head) { // websockets (HMR for dev servers)
  const t = state.target; if (!t) return sock.destroy();
  const u = new URL(req.url, t), secure = u.protocol === 'https:';
  const up = (secure ? tls : net).connect({ host: u.hostname, port: u.port || (secure ? 443 : 80), servername: u.hostname }, () => {
    const hs = Object.assign({}, req.headers, { host: u.host }); if (hs.origin) hs.origin = t;
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.keys(hs).map(k => `${k}: ${hs[k]}`).join('\r\n') + '\r\n\r\n');
    if (head && head.length) up.write(head);
    up.pipe(sock); sock.pipe(up);
  });
  up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
}

/* ---------------------------------- shell ---------------------------------- */
const body = req => new Promise(ok => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { ok({}); } }); });
const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };

const shell = http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/api/status') return json(res, Object.assign({ base: BASE, slots: SLOTS }, state));
  if (p === '/api/open' && req.method === 'POST') { const b = await body(req); openSource(b.source); return json(res, { ok: true }); }
  if (p === '/api/close' && req.method === 'POST') { job++; cleanup(); Object.assign(state, { status: 'idle', log: [], target: null, kind: null, source: null, error: null }); return json(res, { ok: true }); }
  if (p === '/api/devices' && req.method === 'POST') { const b = await body(req); for (const k in b) uaBySlot[k] = b[k] || ''; return json(res, { ok: true }); }
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const f = path.join(ROOT, 'public', p === '/' ? 'index.html' : p);
  if (!f.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end(); }
  sendFile(res, f);
});

shell.listen(BASE, '127.0.0.1', () => {
  for (let i = 0; i < SLOTS; i++) { const s = http.createServer(proxyHandler(i)); s.on('upgrade', proxyUpgrade); s.listen(BASE + 1 + i, '127.0.0.1'); }
  console.log(`\n  Samestate is running →  http://localhost:${BASE}\n`);
  const arg = process.argv[2];
  if (arg) openSource(arg === '--demo' ? 'demo' : arg);
});
shell.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${BASE} is in use. Try: PORT=4800 node server.js` : e.message); process.exit(1); });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(0); });
