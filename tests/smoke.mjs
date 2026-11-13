// End-to-end smoke test: plays the guided demo of the web build (docs/) in headless Chrome and checks
// what each step did to the sample site. No npm packages: Node 22's WebSocket talks to Chrome directly.
//
//   node tests/smoke.mjs                  uses Chrome from CHROME_PATH or the usual install location
//   SMOKE_HEADED=1 node tests/smoke.mjs   shows the browser window while it runs
//   SMOKE_ROOT=path node tests/smoke.mjs  serves another copy of the web build instead of docs/
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(process.env.SMOKE_ROOT || fileURLToPath(new URL('../docs/', import.meta.url)));
const PACE = 0.3; // ?tour-pace: shorter reading pauses, same waits for the previews
const TIMEOUT = 6 * 60_000;
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

// Runs in the app page before its scripts. After each tour step it checks the state that step should leave.
// It reads the app's own top-level variables (DEVICES, findings, pageScreens…), which resolve when a check runs.
const PROBE = `(() => {
  if (window.top !== window) return;
  const results = [], memory = {};
  window.__smoke = { results, done: false };
  const phone = () => DEVICES.find(d => d.id === 'iphone');
  const byId = id => DEVICES.find(d => d.id === id);
  const docOf = d => { try { return d.iframe.contentDocument; } catch { return null; } };
  const docs = () => workspaceScreens().map(docOf).filter(Boolean);
  const count = test => docs().filter(test).length;
  const top = (d, selector) => Math.round(docOf(d).querySelector(selector).getBoundingClientRect().top);
  const scrollOf = d => Math.round(d.iframe.contentWindow.scrollY);
  const visibleText = selector => [...document.querySelectorAll(selector)].filter(el => !el.closest('[hidden]')).map(el => el.textContent);
  const checks = {
    'Click sync': () => [count(d => d.querySelector('#drawer.open') || d.querySelector('.dd-menu:not([hidden])')) === 7, 'screens with Products open: ' + count(d => d.querySelector('#drawer.open') || d.querySelector('.dd-menu:not([hidden])'))],
    'Same state, different layout': () => [count(d => d.querySelector('#signin')?.open) === 7, 'sign-in dialogs open: ' + count(d => d.querySelector('#signin')?.open)],
    'Any screen can lead': () => [count(d => d.querySelector('#signin')?.open) === 0, 'sign-in dialogs open: ' + count(d => d.querySelector('#signin')?.open)],
    'Twin controls': () => {
      const dark = count(d => d.documentElement.classList.contains('dark'));
      const entry = [...document.querySelectorAll('#log .entry')].find(e => e.querySelector('.h').textContent.startsWith('iPhone 11 Pro · click'));
      const desktop = [...(entry?.querySelectorAll('.r') || [])].find(r => r.querySelector('b').textContent === 'Desktop')?.querySelector('.tag').textContent;
      return [dark === 7 && desktop === 'matched', 'dark screens: ' + dark + ', Desktop: ' + desktop];
    },
    'Works both ways': () => [count(d => d.documentElement.classList.contains('dark')) === 0, 'dark screens: ' + count(d => d.documentElement.classList.contains('dark'))],
    'Scroll sync': () => {
      const scrolled = workspaceScreens().filter(d => scrollOf(d) > 200).length, plans = top(byId('desktop'), '#plans');
      return [scrolled === 7 && plans < 250, 'scrolled screens: ' + scrolled + ', Desktop #plans at ' + plans + 'px'];
    },
    'Difference report': () => {
      const table = reportGroups.find(g => g.kind === 'Table is wider than its container');
      return [findings.length > 20 && table?.screens.length >= 3, findings.length + ' findings in ' + reportGroups.length + ' issues, wide table on ' + (table?.screens.length || 0) + ' screens'];
    },
    'Annotations': () => { const notes = phone().el.querySelectorAll('.preview-note').length; return [notes === 1, 'notes on the iPhone: ' + notes]; },
    'Video playback': () => {
      memory.phoneScroll = scrollOf(phone());
      memory.deskScroll = scrollOf(byId('desktop'));
      const playing = count(d => { const v = d.querySelector('video'); return v && !v.paused; });
      return [playing === 7, 'videos playing: ' + playing];
    },
    'Unlink a screen': () => {
      // Customer stories is near the end of the page, so a tall screen stops short of putting it at the top.
      const stayed = Math.abs(scrollOf(phone()) - memory.phoneScroll) < 5, desk = scrollOf(byId('desktop'));
      memory.phoneScroll = scrollOf(phone());
      return [!phone().linked && stayed && desk > memory.deskScroll + 100, 'iPhone linked: ' + phone().linked + ', stayed: ' + stayed + ', Desktop scrolled ' + memory.deskScroll + ' → ' + desk];
    },
    'Align screens': () => [phone().linked && scrollOf(phone()) > memory.phoneScroll + 100, 'iPhone linked: ' + phone().linked + ', scrolled ' + memory.phoneScroll + ' → ' + scrollOf(phone())],
    'Follow links': () => {
      const pricing = count(d => d.location.pathname.endsWith('/pricing.html'));
      const entry = [...document.querySelectorAll('#log .entry')].find(e => e.querySelector('.h').textContent.startsWith('Desktop · open'));
      const opened = [...(entry?.querySelectorAll('.tag') || [])].filter(tag => tag.textContent === 'opened').length;
      return [pricing === 7 && opened === 6, 'screens on pricing.html: ' + pricing + ', Sync log "opened": ' + opened];
    },
    'Back from any screen': () => { const home = count(d => d.location.pathname.endsWith('/index.html')); return [home === 7, 'screens back on index.html: ' + home]; },
    'Free placement': () => {
      const between = phone().x > byId('desktop').x && phone().x < byId('macbook').x;
      return [document.querySelector('#frames').classList.contains('free') && between, 'x: Desktop ' + byId('desktop').x + ', iPhone ' + phone().x + ', MacBook ' + byId('macbook').x];
    },
    'Preview scale': () => { const scale = phone().el.querySelector('[data-a=scale]').textContent; return [scale === '100%', 'iPhone scale: ' + scale]; },
    'Back to the grid': () => {
      const free = document.querySelector('#frames').classList.contains('free'), scale = phone().el.querySelector('[data-a=scale]').textContent;
      return [!free && scale !== '100%', 'free placement: ' + free + ', iPhone scale: ' + scale];
    },
    'Device catalog': () => {
      const folds = visibleText('#devlist .device-options > *').filter(text => /fold/i.test(text)).length;
      return [document.querySelector('#device-search').value === 'fold' && folds >= 3, 'foldables listed: ' + folds];
    },
    'Themes': () => { const themed = themePreviews().filter(d => d.themeCss).length; return [themed === 7, 'themed previews: ' + themed + ' (' + document.querySelector('#theme-status').textContent + ')']; },
    'Page steps': () => {
      const menu = pageScreens[1] && docOf(pageScreens[1])?.querySelector('#drawer.open');
      return [pageScreens.length === 2 && !!menu, 'steps: ' + pageScreens.length + ', Step 2 menu open: ' + !!menu];
    },
    'Follow a link': () => {
      const last = pageScreens[2], page = last && docOf(last)?.location.pathname;
      return [pageScreens.length === 3 && /pricing\\.html$/.test(page || ''), 'steps: ' + pageScreens.length + ', Step 3: ' + page];
    },
    'Compare sites': () => {
      const pages = sitePanels.map(site => site.url?.pathname.split('/').pop()), screens = sitePanels.map(site => siteScreens(site).length);
      return [sitesMode && pages.join() === 'index.html,pricing.html' && screens.join() === '7,7', 'columns: ' + pages.join(' + ') + ', screens: ' + screens.join(' + ')];
    },
    'Screenshot and Record': () => [!!document.querySelector('#screenshot') && !!document.querySelector('#record'), 'capture buttons present'],
    'That is the tour': () => [!sitesMode && !pageSteps, 'back on the device wall: ' + (!sitesMode && !pageSteps)]
  };
  document.addEventListener('samestate-tour-step', event => {
    const { step, title } = event.detail;
    let ok = false, detail = 'no check for this step';
    try { [ok, detail] = checks[title] ? checks[title]() : [false, detail]; } catch (error) { detail = 'check failed: ' + error.message; }
    results.push({ step, title, ok, detail, at: Math.round(performance.now() / 1000) });
    if (step === STEPS.length) window.__smoke.done = true;
  });
})();`;

// Runs after the tour, on the sample site it leaves open: report export and saved workspaces.
const AFTER_TOUR = `(async () => {
  const results = [], wait = ms => new Promise(done => setTimeout(done, ms));
  const files = [];
  HTMLAnchorElement.prototype.click = function () { if (this.download) files.push(fetch(this.href).then(r => r.text())); };
  const record = (title, ok, detail) => results.push({ title, ok: !!ok, detail });
  try {
    await detect(true);
    for (const format of ['md', 'csv', 'html']) document.querySelector('[data-export=' + format + ']').click();
    const [md, csv, html] = await Promise.all(files);
    record('Export Markdown', md.startsWith('# Samestate difference report') && md.includes('Table is wider than its container'), md.split('\\n').length + ' lines');
    const rows = csv.trim().split('\\r\\n').length - 1;
    record('Export CSV', csv.includes('Severity,Category,Issue,Screen') && rows === findings.length, rows + ' rows for ' + findings.length + ' findings');
    record('Export HTML', html.includes('<h1>Samestate difference report</h1>') && html.includes('class="problem issue"'), html.length + ' characters');
  } catch (error) { record('Export', false, error.message); }
  try {
    const android = DEVICES.find(d => d.id === 'android');
    selectDevice(android, false); setZoom(80);
    document.querySelector('#workspace-name').value = 'Smoke test';
    document.querySelector('#workspace-form').requestSubmit();
    selectDevice(android, true); setZoom(100);
    const row = [...document.querySelectorAll('#workspace-list .workspace')].find(li => li.textContent.includes('Smoke test'));
    row.querySelector('.pill').click();
    for (let i = 0; i < 100 && !document.querySelector('#workspace-status').textContent.startsWith('Opened'); i++) await wait(100);
    const zoomText = document.querySelector('#zoomv').textContent;
    record('Workspace save and open', !android.on && zoomText === '80%' && active().length === 6, 'Android selected: ' + android.on + ', zoom ' + zoomText + ', screens ' + active().length);
  } catch (error) { record('Workspace save and open', false, error.message); }
  return results;
})()`;

async function main() {
  const server = await serve();
  const profile = mkdtempSync(join(tmpdir(), 'samestate-smoke-'));
  const { chrome, port } = await launch(profile);
  const errors = [];
  try {
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    const page = new Session(target.webSocketDebuggerUrl);
    await page.open();
    page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.exception?.description || exceptionDetails.text));
    page.on('Runtime.consoleAPICalled', ({ type, args }) => { if (type === 'error') errors.push('console.error: ' + args.map(a => a.value ?? a.description).join(' ')); });
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
    const url = `http://127.0.0.1:${server.address().port}/?tour-pace=${PACE}`;
    console.log('Playing the guided demo at ' + url);
    await page.send('Page.navigate', { url });

    const start = Date.now();
    let shown = 0, state;
    while (Date.now() - start < TIMEOUT) {
      await new Promise(done => setTimeout(done, 1000));
      state = await page.evaluate('window.__smoke && { done: __smoke.done, results: __smoke.results }').catch(() => null);
      for (const r of state?.results.slice(shown) || []) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${String(r.step).padStart(2)} ${r.title.padEnd(30)} ${r.detail}`);
      shown = state?.results.length || shown;
      if (state?.done) break;
    }
    const results = state?.results || [];
    if (state?.done) {
      for (const r of await page.evaluate(AFTER_TOUR)) {
        console.log(`${r.ok ? 'ok  ' : 'FAIL'}    ${r.title.padEnd(30)} ${r.detail}`);
        results.push(r);
      }
    }
    const failed = results.filter(r => !r.ok);
    if (!state?.done) failed.push({ title: `tour stopped after step ${results.length}` });
    for (const error of errors) failed.push({ title: 'page error: ' + error });
    console.log(`\n${results.length - results.filter(r => !r.ok).length}/${results.length} checks passed in ${Math.round((Date.now() - start) / 1000)}s, ${errors.length} page errors`);
    if (failed.length) {
      console.error('Failures:\n' + failed.map(f => '  - ' + f.title + (f.detail ? ': ' + f.detail : '')).join('\n'));
      process.exitCode = 1;
    }
  } finally {
    chrome.kill();
    server.close();
    await new Promise(done => setTimeout(done, 300));
    rmSync(profile, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exit(1); });
