// UI acceptance checks for the grouped checks workflow in desktop Chrome. No npm packages: Node 22's WebSocket talks to Chrome directly.
//
//   node tests/checks.mjs                  uses Chrome from CHROME_PATH or the usual install location
//   SMOKE_HEADED=1 node tests/checks.mjs   shows the browser window while it runs
//   SMOKE_ROOT=path node tests/checks.mjs  serves another copy of the web build instead of docs/
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(process.env.SMOKE_ROOT || fileURLToPath(new URL('../docs/', import.meta.url)));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4', '.gif': 'image/gif', '.json': 'application/json' };

function serve() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(ROOT, '.' + path);
    if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try {
      if (!statSync(file).isFile()) throw new Error();
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
    } catch { res.writeHead(404).end(); }
  });
  return new Promise(done => server.listen(0, '127.0.0.1', () => done(server)));
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (process.platform === 'win32') return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch {}
  }
  throw new Error('Chrome not found. Set CHROME_PATH.');
}

function launch(profile) {
  const args = [
    process.env.SMOKE_HEADED ? '' : '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1600,1000', '--autoplay-policy=no-user-gesture-required',
    process.env.CI ? '--no-sandbox' : '', 'about:blank'
  ].filter(Boolean);
  const chrome = spawn(findChrome(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
  return new Promise((done, fail) => {
    let log = '';
    const timer = setTimeout(() => fail(new Error('Chrome did not start:\n' + log)), 30_000);
    chrome.stderr.on('data', chunk => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); done({ chrome, port: new URL(match[1]).port }); }
    });
    chrome.on('exit', code => { clearTimeout(timer); fail(new Error(`Chrome exited (${code}):\n${log}`)); });
  });
}

class Session {
  constructor(url) { this.ws = new WebSocket(url); this.next = 0; this.pending = new Map(); this.handlers = {}; }
  open() {
    this.ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (!message.id) { (this.handlers[message.method] || []).forEach(handle => handle(message.params)); return; }
      const call = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) call.fail(new Error(message.error.message)); else call.done(message.result);
    };
    return new Promise((done, fail) => { this.ws.onopen = done; this.ws.onerror = () => fail(new Error('Could not connect to Chrome')); });
  }
  send(method, params = {}) {
    const id = ++this.next;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((done, fail) => this.pending.set(id, { done, fail }));
  }
  on(method, handle) { (this.handlers[method] ||= []).push(handle); }
  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  }
}


const sleep = ms => new Promise(done => setTimeout(done, ms));
async function main() {
  const server = await serve(), profile = mkdtempSync(join(tmpdir(), 'samestate-checks-'));
  const { chrome, port } = await launch(profile);
  const errors = [], results = [];
  const record = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
  try {
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    const page = new Session(target.webSocketDebuggerUrl); await page.open();
    await page.send('Runtime.enable'); await page.send('Page.enable');
    await page.send('Browser.setDownloadBehavior', { behavior: 'deny' });
    page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.exception?.description || exceptionDetails.text));
    const evaluate = expression => page.evaluate(expression);
    const until = async (expression, ms = 60_000) => {
      for (const start = Date.now(); Date.now() - start < ms; await sleep(100)) if (await evaluate(expression).catch(() => false)) return;
      throw new Error('Timed out: ' + expression);
    };
    await page.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    await until('typeof samestateChecks === "object"');
    await evaluate(`$('#skip').click(); open(DEMO_URL)`);
    await until('!tourRunning && active().length > 0 && active().every(d => d.ready)');
    await evaluate(`$('#open-checks').click()`);
    record('Toolbar opens setup and combined results', await evaluate(`$('#checks-drawer').open && !$('#panel').hidden && !$('#pane-checks').hidden`));
    await evaluate(`$('#checks-select-none').click()`);
    record('Empty selection disables Run', await evaluate(`$('#checks-run').disabled`));
    const select = async ids => evaluate(`(() => { for (const el of document.querySelectorAll('#checks-groups input')) el.checked = ${JSON.stringify(ids)}.includes(el.value); $('#checks-groups').dispatchEvent(new Event('change')); })()`);
    const run = async () => {
      await evaluate(`$('#checks-run').click()`);
      await until('!samestateChecks.running');
      return evaluate('samestateChecks.get()');
    };
    await select(['layout', 'accessibility', 'meta', 'performance', 'links', 'visual', 'capture', 'workspaces']);
    const grouped = await run();
    record('Selected report groups run together', grouped.results.filter(r => !r.manual).length === 5 && grouped.results.every(r => !['queued', 'running'].includes(r.status)));
    record('Known sample problems produce failures', grouped.results.some(r => !r.manual && r.status === 'failed' && r.findings.length));
    record('Visual items remain unapproved', grouped.results.filter(r => r.manual).length >= 10 && grouped.results.filter(r => r.manual).every(r => r.status === 'review') && grouped.counts.review > 0);
    record('Measurement gaps are visible', grouped.results.find(r => r.group === 'performance').status !== 'passed');
    await evaluate(`(() => { const card = document.querySelector('.check-result:has([data-review-status])'); card.querySelector('[data-review-status=failed]').click(); const note = card.querySelector('textarea'); note.value = '<script>review note</script>'; note.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const reviewed = await evaluate('samestateChecks.get()');
    record('Human decisions and notes join the report', reviewed.results.find(r => r.manual).status === 'failed' && reviewed.results.find(r => r.manual).notes === '<script>review note</script>');
    await evaluate(`window.__downloads = []; window.__createURL = URL.createObjectURL; URL.createObjectURL = blob => { window.__downloads.push(blob); return window.__createURL(blob); }; $('#checks-export-html').click(); $('#checks-export-json').click();`);
    const downloads = await evaluate(`Promise.all(__downloads.map(b => b.text()))`);
    record('Combined HTML and JSON exports retain evidence', downloads.length === 2 && downloads[0].includes('&lt;script&gt;review note&lt;/script&gt;') && !downloads[0].includes('<script>review note</script>') && JSON.parse(downloads[1]).results.some(r => r.manual && r.status === 'failed'));
    if (process.env.CHECKS_SCREENSHOT) {
      await evaluate(`document.querySelector('#sidebar').scrollTop = $('#checks-drawer').offsetTop - document.querySelector('#sidebar').offsetTop; document.scrollingElement.scrollTop = 0; $('#pane-checks').scrollTop = 0`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(process.env.CHECKS_SCREENSHOT, Buffer.from(shot.data, 'base64'));
    }
    if (process.env.CHECKS_REVIEW_SCREENSHOT) {
      await evaluate(`if (samestateUiTheme.mode === 'dark') $('#ui-mode').click(); const pane = $('#pane-checks'), card = document.querySelector('.check-result:has([data-review-status])'); pane.scrollTop += card.getBoundingClientRect().top - pane.getBoundingClientRect().top - $('#checks-summary').getBoundingClientRect().height - 12;`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(process.env.CHECKS_REVIEW_SCREENSHOT, Buffer.from(shot.data, 'base64'));
    }
    await select(['journey']);
    await evaluate(`samestateTest.load({ samestate: 'test', version: 1, site: 'demo:index.html', steps: [{do: 'expect', text: 'THIS TEXT DOES NOT EXIST ON THE PAGE'}] })`);
    const failedJourney = await run();
    record('Saved journey failures appear in combined results', failedJourney.results[0].status === 'failed' && failedJourney.results[0].steps[0].results);
    await evaluate(`DEVICES.find(d => d.id === 'iphone').ready = false`);
    await select(['meta']); const missing = await run();
    record('Missing previews never produce a clean pass', missing.results[0].status !== 'passed' && missing.results[0].detail.includes('Not measured:'));
    await evaluate(`DEVICES.find(d => d.id === 'iphone').ready = true`);
    await evaluate(`$('#screen-settings').value = 'scheme'; $('#screen-settings').dispatchEvent(new Event('change')); $('#long-text').checked = true; $('#long-text').dispatchEvent(new Event('change')); window.__beforeRotations = active().map(d => [d.id, d.rot]);`);
    await select(['settings']);
    await evaluate(`$('#checks-run').click()`);
    await until('samestateChecks.running && screenSettings !== "scheme"');
    record('Controls stay locked during automatic checks', await evaluate(`$('#checks-options').disabled && $('#devices-drawer').inert && document.querySelector('.wall').inert && !$('#checks-stop').hidden`));
    await evaluate(`$('#checks-stop').click()`); await until('!samestateChecks.running');
    const stopped = await evaluate(`({ data: samestateChecks.get(), settings: screenSettings, longText, rotations: active().map(d => [d.id, d.rot]), unlocked: !$('#devices-drawer').inert && !$('#checks-options').disabled })`);
    record('Stop restores settings and marks remaining checks', stopped.data.stopped && stopped.data.results.some(r => r.status === 'stopped') && stopped.settings === 'scheme' && stopped.longText && stopped.unlocked && JSON.stringify(stopped.rotations) === await evaluate('JSON.stringify(__beforeRotations)'));
    // Limit the normal settings pass to two devices for speed, using the actual settings/report machinery.
    await evaluate(`for (const d of DEVICES) if (d.on && !['iphone','desktop'].includes(d.id)) toggleDevice(d, false)`);
    await until('active().length === 2 && active().every(d => d.ready)');
    await select(['settings']); const variants = await run();
    record('Every non-vision setting and long text is scanned', variants.results.filter(r => !r.manual).length === 13 && variants.results.filter(r => !r.manual).every(r => !['queued','running','stopped'].includes(r.status)) && variants.results.some(r => r.manual && r.status === 'review'));
    await select(['widths']);
    await evaluate(`$('#checks-run').click()`); await until('!!sweepRun');
    await evaluate(`$('#checks-stop').click()`); await until('!samestateChecks.running');
    record('Sweep cancellation restores the reference width', await evaluate(`!sweepRun && active().every(d => !d.sweepW) && samestateChecks.get().stopped`));
    record('No page errors', errors.length === 0, errors.join('; '));
    const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} workflow checks passed`);
    if (failed.length) process.exitCode = 1;
  } finally {
    chrome.kill(); server.close(); await sleep(300); rmSync(profile, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
