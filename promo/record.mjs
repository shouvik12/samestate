// Records the promo video: opens the real web build (docs/) in headless Chrome, runs promo/stage.js on top of it,
// captures every frame Chrome draws, and encodes a 30-second H.264 video with the soundtrack.
//
//   python3 promo/music.py promo/out/music.wav
//   python3 promo/voiceover.py                 (optional: narration over the music → promo/out/soundtrack.wav)
//   node promo/record.mjs landscape     →  promo/out/samestate-promo-landscape.mp4  (1920x1080)
//   node promo/record.mjs portrait      →  promo/out/samestate-promo-portrait.mp4   (1080x1920)
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORMAT = process.argv[2] === 'portrait' ? 'portrait' : 'landscape';
const [W, H] = FORMAT === 'portrait' ? [1080, 1920] : [1920, 1080];
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'promo', 'out');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4', '.json': 'application/json' };
const wait = ms => new Promise(done => setTimeout(done, ms));
// ffmpeg on the PATH, or where Homebrew installs it (some shells leave Homebrew off the PATH).
const FFMPEG = process.env.FFMPEG || ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(path => existsSync(path)) || 'ffmpeg';

const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(ROOT, '.' + path);
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
  try {
    if (!statSync(file).isFile()) throw new Error();
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));

const profile = mkdtempSync(join(tmpdir(), 'samestate-promo-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  `--window-size=${W},${H}`, '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let log = '';
const port = await new Promise(done => chrome.stderr.on('data', c => { log += c; const m = log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)/); if (m) done(m[1]); }));
const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(done => { ws.onopen = done; });
let next = 0;
const pending = new Map(), frames = [];
ws.onmessage = event => {
  const m = JSON.parse(event.data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.fail(new Error(m.error.message)) : p.done(m.result); return; }
  if (m.method === 'Page.screencastFrame') {
    frames.push({ data: m.params.data, at: m.params.metadata.timestamp });
    send('Page.screencastFrameAck', { sessionId: m.params.sessionId });
  }
};
function send(method, params = {}) {
  const id = ++next;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((done, fail) => pending.set(id, { done, fail }));
}
async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}

try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  // The real web build, opened as the top-level page as a user would; the stage script is added on top of it.
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/docs/index.html` });
  for (let i = 0; i < 100 && !(await evaluate("typeof startTour === 'function'").catch(() => false)); i++) await wait(100);
  await evaluate(`window.PROMO_FORMAT = ${JSON.stringify(FORMAT)};\n` + readFileSync(join(ROOT, 'promo', 'stage.js'), 'utf8'));
  console.log(`Preparing the app (${FORMAT} ${W}x${H})…`);
  console.log('Wall:', JSON.stringify(await evaluate('promo.prepare()')));
  await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  await wait(400);
  console.log('Recording…');
  const { start, length } = await evaluate('(async () => { const start = Date.now() / 1000; const length = await promo.show(); return { start, length }; })()');
  await wait(300);
  await send('Page.stopScreencast');

  // Frames from the show's start, each held until the next one: a variable-rate sequence ffmpeg turns into 30 fps.
  const end = start + 30;
  const before = frames.filter(f => f.at <= start).at(-1);
  const shown = [...(before ? [{ ...before, at: start }] : []), ...frames.filter(f => f.at > start && f.at < end)];
  const dir = join(OUT, `frames-${FORMAT}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let list = '';
  shown.forEach((frame, i) => {
    const name = `f${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(join(dir, name), Buffer.from(frame.data, 'base64'));
    const duration = (shown[i + 1]?.at ?? end) - frame.at;
    list += `file '${name}'\nduration ${duration.toFixed(4)}\n`;
  });
  list += `file 'f${String(shown.length - 1).padStart(5, '0')}.jpg'\n`;
  writeFileSync(join(dir, 'frames.txt'), list);
  const rates = shown.slice(1).map((f, i) => f.at - shown[i].at);
  console.log(`Captured ${shown.length} frames over ${(length / 1000).toFixed(1)} s (average ${(shown.length / 30).toFixed(1)} fps, longest gap ${(Math.max(...rates) * 1000).toFixed(0)} ms)`);

  const video = join(OUT, `samestate-promo-${FORMAT}.mp4`);
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.txt'),
    '-i', join(OUT, existsSync(join(OUT, 'soundtrack.wav')) ? 'soundtrack.wav' : 'music.wav'), // narrated mix when promo/voiceover.py has run
    '-vf', `fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p`,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '30', '-movflags', '+faststart', video], { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true }); // the JPEG frames are only needed for the encode
  console.log('Wrote', video);
} finally {
  chrome.kill();
  server.close();
  await wait(300);
  rmSync(profile, { recursive: true, force: true });
}
