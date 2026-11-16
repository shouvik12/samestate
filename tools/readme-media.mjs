// Re-records the README's images from the current web demo (docs/) in headless Chrome:
//
//   node tools/readme-media.mjs        →  docs/media/samestate-demo.gif, screenshot-sync.png, screenshot-report.png, card.png
//
// Needs Node 22, Chrome (CHROME_PATH to pick one) and ffmpeg. The GIF is the guided demo's first step, the Products
// click on every device; the sync screenshot and card.png are its last frame; the report screenshot is the
// difference report on the pricing table. The sidebar is hidden and the zoom set so every device fits.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'docs', 'media');
const FFMPEG = process.env.FFMPEG || ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(path => existsSync(path)) || 'ffmpeg';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4', '.json': 'application/json' };
const wait = ms => new Promise(done => setTimeout(done, ms));
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(ROOT, '.' + path);
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
  try { if (!statSync(file).isFile()) throw 0; res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}/docs/index.html`;

const profile = mkdtempSync(join(tmpdir(), 'samestate-media-'));
const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--window-size=1600,900', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let log = '';
const port = await new Promise(done => chrome.stderr.on('data', c => { log += c; const m = log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)/); if (m) done(m[1]); }));
const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(done => { ws.onopen = done; });
let next = 0; const pending = new Map(); let frames = null;
ws.onmessage = event => {
  const m = JSON.parse(event.data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.fail(new Error(m.error.message)) : p.done(m.result); return; }
  if (m.method === 'Page.screencastFrame') { frames?.push({ data: m.params.data, at: m.params.metadata.timestamp }); send('Page.screencastFrameAck', { sessionId: m.params.sessionId }); }
};
const send = (method, params = {}) => { const id = ++next; ws.send(JSON.stringify({ id, method, params })); return new Promise((done, fail) => pending.set(id, { done, fail })); };
const evaluate = async expression => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
};
const shot = async file => writeFileSync(join(OUT, file), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
async function load(w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: base + '?v=' + Date.now() });
  for (let i = 0; i < 100 && !(await evaluate("typeof startTour === 'function'").catch(() => false)); i++) await wait(100);
}

try {
  await send('Page.enable');

  // 1. The guided demo's first step (the Products click), recorded for the GIF; its last frame is the sync screenshot.
  await load(1600, 900);
  await evaluate(`(async () => {
    await new Promise(done => { const t = setInterval(() => { if (tourRunning && active().length && active().every(d => d.ready)) { clearInterval(t); done(); } }, 20); });
    $('#toggle-sidebar').click();
    for (let z = 100; z >= 30; z -= 2) { setZoom(z); await new Promise(r => setTimeout(r, 15)); if (cv.scrollWidth <= cv.clientWidth + 1 && cv.scrollHeight <= cv.clientHeight + 1) break; }
    return zoom;
  })()`);
  frames = [];
  await send('Page.startScreencast', { format: 'png', maxWidth: 1600, maxHeight: 900, everyNthFrame: 1 });
  const start = Date.now() / 1000;
  await evaluate(`new Promise(done => document.addEventListener('samestate-tour-step', e => { if (e.detail.step === 1) done(); }, { once: true }))`);
  await shot('screenshot-sync.png');
  await wait(1200);
  await send('Page.stopScreencast');
  const end = Date.now() / 1000;
  const dir = mkdtempSync(join(tmpdir(), 'samestate-frames-'));
  const shown = frames.filter(f => f.at >= start - 0.2);
  let list = '';
  shown.forEach((f, i) => { const name = `f${String(i).padStart(5, '0')}.png`; writeFileSync(join(dir, name), Buffer.from(f.data, 'base64')); list += `file '${name}'\nduration ${((shown[i + 1]?.at ?? end) - f.at).toFixed(4)}\n`; });
  list += `file 'f${String(shown.length - 1).padStart(5, '0')}.png'\n`;
  writeFileSync(join(dir, 'frames.txt'), list);
  execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.txt'), '-vf',
    'fps=10,scale=960:540:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    '-loop', '0', join(OUT, 'samestate-demo.gif')]);
  rmSync(dir, { recursive: true, force: true });
  execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', join(OUT, 'screenshot-sync.png'), '-vf', 'scale=1200:675:flags=lanczos', join(OUT, 'card.png')]); // link previews
  console.log(`GIF: ${shown.length} frames over ${(end - start).toFixed(1)} s`);

  // 2. The difference report on the pricing table, with the guided demo closed.
  await load(1600, 900);
  console.log('report:', await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 100 && !tourRunning; i++) await wait(100);
    endTour(false);
    for (let i = 0; i < 150 && !(active().length && active().every(d => d.ready)); i++) await wait(100);
    for (const d of active()) { try { d.iframe.contentDocument.querySelector('#cookies')?.remove(); } catch {} }
    $('#toggle-sidebar').click();
    for (let z = 100; z >= 30; z -= 2) { setZoom(z); await new Promise(r => setTimeout(r, 15)); if (cv.scrollWidth <= cv.clientWidth + 1 && cv.scrollHeight <= cv.clientHeight + 1) break; }
    await wait(800);
    for (const d of active()) d.iframe.contentDocument.querySelector('#plans').scrollIntoView({ block: 'start' });
    await wait(1500);
    await detect(true); await wait(1200);
    showTab('diff'); await wait(400);
    return findings.length + ' findings; chips: ' + [...document.querySelectorAll('#chips .chip')].map(c => c.textContent).join(' | ');
  })()`));
  await shot('screenshot-report.png');
} finally {
  chrome.kill(); server.close(); await wait(300); rmSync(profile, { recursive: true, force: true });
}
