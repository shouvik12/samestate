// Runs Samestate's difference report on a site in headless Chrome and writes it to files, for CI.
// No npm packages: Node 22 and Chrome. The extension is loaded from extension/ through the DevTools protocol.
//
//   node tools/samestate-ci.mjs https://preview.example.com
//   node tools/samestate-ci.mjs https://preview.example.com --devices=iphone,pixel,ipad,desktop --sweep --fail-on=warn
//
// Options
//   --devices=a,b,c   device ids from extension/devices.js (default: the extension's starter devices)
//   --reference=id    the screen the others are compared with (default: desktop)
//   --sweep           also resize the reference screen from 320 to 1920px and report where problems start and stop
//   --identity        phones and tablets tell the page's scripts and the server what they are
//   --out=dir         where to write report.md, report.html, report.csv and report.json (default: samestate-report)
//   --fail-on=level   exit with code 1 when the report has an issue (default), a warning or above (warn), or never (none);
//                     a screen that did not answer in time also fails the run, except with none
//   --baseline=file   compare with an earlier report.json: only findings that are new make the run fail
//   --timeout=seconds how long to wait for the previews to load (default: 60)
// Environment: CHROME_PATH to pick Chrome, SAMESTATE_HEADED=1 to watch it run.
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSION = fileURLToPath(new URL('../extension/', import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => { const hit = args.find(a => a === '--' + name || a.startsWith('--' + name + '=')); return hit ? (hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true) : fallback; };
const address = args.find(a => !a.startsWith('--'));
if (!address) { console.error('Usage: node tools/samestate-ci.mjs <url> [--devices=iphone,pixel,desktop] [--sweep] [--fail-on=issue|warn|none]'); process.exit(2); }
const site = new URL(address);
if (!['http:', 'https:'].includes(site.protocol)) { console.error('Only http and https addresses can be checked.'); process.exit(2); }
const devices = typeof option('devices') === 'string' ? option('devices').split(',').map(s => s.trim()).filter(Boolean) : null;
const reference = option('reference', 'desktop');
const failOn = option('fail-on', 'issue');
const outDir = resolve(option('out', 'samestate-report'));
const timeout = Number(option('timeout', 60)) * 1000;
const baselineFile = option('baseline');

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (process.platform === 'win32') return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch {}
  }
  throw new Error('Chrome not found. Set CHROME_PATH.');
}

// A copy of the extension that already has access to the site (and not to the default site, so it doesn't load it).
function prepareExtension(work) {
  const dir = join(work, 'extension');
  cpSync(EXTENSION, dir, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const host = site.hostname, twin = /^[\d.]+$|^\[/.test(host) || !host.includes('.') ? null : host.startsWith('www.') ? host.slice(4) : host.split('.').length === 2 ? 'www.' + host : null;
  manifest.host_permissions = [`${site.protocol}//${host}/*`, ...(twin ? [`${site.protocol}//${twin}/*`] : [])];
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dir;
}

// DevTools protocol over a pipe (file descriptors 3 and 4), which Chrome requires for loading an extension.
class Pipe {
  constructor(child) {
    this.out = child.stdio[3]; this.next = 0; this.pending = new Map(); this.buffer = '';
    child.stdio[4].on('data', chunk => {
      this.buffer += chunk.toString('utf8');
      let end;
      while ((end = this.buffer.indexOf('\0')) >= 0) {
        const message = JSON.parse(this.buffer.slice(0, end));
        this.buffer = this.buffer.slice(end + 1);
        const call = message.id && this.pending.get(message.id);
        if (!call) continue;
        this.pending.delete(message.id);
        if (message.error) call.fail(new Error(message.error.message)); else call.done(message.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.next;
    this.out.write(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }) + '\0');
    return new Promise((done, fail) => this.pending.set(id, { done, fail }));
  }
}

const sleep = ms => new Promise(done => setTimeout(done, ms));
let chrome, work;
async function run() {
  work = mkdtempSync(join(tmpdir(), 'samestate-ci-'));
  const extension = prepareExtension(work);
  chrome = spawn(findChrome(), [
    process.env.SAMESTATE_HEADED ? '' : '--headless=new', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
    `--user-data-dir=${join(work, 'profile')}`, '--no-first-run', '--no-default-browser-check', '--window-size=1600,1000',
    process.env.CI ? '--no-sandbox' : ''
  ].filter(Boolean), { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const pipe = new Pipe(chrome);
  const { id } = await pipe.send('Extensions.loadUnpacked', { path: extension });
  const { targetId } = await pipe.send('Target.createTarget', { url: `chrome-extension://${id}/app.html` });
  const { sessionId } = await pipe.send('Target.attachToTarget', { targetId, flatten: true });
  const evaluate = async (expression, ms = timeout) => {
    const result = await Promise.race([
      pipe.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId),
      sleep(ms).then(() => { throw new Error('Timed out: ' + expression.slice(0, 80)); })
    ]);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };

  for (let tries = 0; !(await evaluate('typeof detect === "function" && typeof samestateReport === "function"').catch(() => false)); tries++) {
    if (tries > 100) throw new Error('Samestate did not start.');
    await sleep(100);
  }
  if (devices) {
    const unknown = await evaluate(`(() => {
      const wanted = ${JSON.stringify(devices)};
      const missing = wanted.filter(id => !DEVICES.some(d => d.id === id));
      if (!missing.length) for (const d of DEVICES) if (d.on !== wanted.includes(d.id)) toggleDevice(d, wanted.includes(d.id));
      return missing;
    })()`);
    if (unknown.length) throw new Error('Unknown device ids: ' + unknown.join(', ') + '. See extension/devices.js.');
  }
  if (option('identity')) await evaluate('setDeviceIdentity(true, false)');
  await evaluate(`open(new URL(${JSON.stringify(site.href)}), true)`);
  const loaded = Date.now();
  let retried = false;
  for (;;) {
    const state = await evaluate(`({ screens: active().length, ready: active().filter(d => d.ready).length, message: $('#joblog').textContent || $('#src').value })`);
    if (state.screens && state.ready === state.screens) break;
    if (!state.screens && Date.now() - loaded > 5000 && !retried) { retried = true; await evaluate(`open(new URL(${JSON.stringify(site.href)}), true)`); } // the first open can lose a race with startup
    if (Date.now() - loaded > timeout) throw new Error(`Only ${state.ready} of ${state.screens} previews loaded${state.message ? ` (Samestate says: ${state.message})` : ''}. Is the site reachable, and can it be shown in a frame?`);
    await sleep(250);
  }
  await sleep(2500); // late images, fonts and layout shifts
  if (reference) await evaluate(`(() => { const r = $('#ref'); if ([...r.options].some(o => o.value === ${JSON.stringify(reference)})) r.value = ${JSON.stringify(reference)}; })()`);
  await evaluate('detect(true)');
  if (option('sweep')) await evaluate('sweepWidths()', 10 * 60_000);
  const report = await evaluate(`({
    findings: findings.map(f => ({ id: reportName(f.dev) + '|' + f.kind, severity: f.sev, category: f.cat, issue: f.kind, screen: reportName(f.dev), title: f.title, detail: f.detail })),
    screens: (lastScan?.screens || []).map(d => reportName(d)),
    missing: (lastScan?.missing || []).map(d => reportName(d)),
    md: samestateReport('md'), csv: samestateReport('csv'), html: samestateReport('html')
  })`);

  mkdirSync(outDir, { recursive: true });
  const json = { site: site.href, at: new Date().toISOString(), screens: report.screens, notMeasured: report.missing, findings: report.findings };
  writeFileSync(join(outDir, 'report.md'), report.md);
  writeFileSync(join(outDir, 'report.html'), report.html);
  writeFileSync(join(outDir, 'report.csv'), report.csv);
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(json, null, 2));

  let judged = report.findings;
  if (typeof baselineFile === 'string') {
    const before = new Set(JSON.parse(readFileSync(baselineFile, 'utf8')).findings.map(f => f.id));
    judged = judged.filter(f => !before.has(f.id));
    const now = new Set(report.findings.map(f => f.id));
    const fixed = JSON.parse(readFileSync(baselineFile, 'utf8')).findings.filter(f => !now.has(f.id));
    console.log(`Compared with ${baselineFile}: ${judged.length} new, ${fixed.length} fixed.`);
  }
  const count = sev => judged.filter(f => f.severity === sev).length;
  console.log(`${site.href} on ${report.screens.length} screens: ${count('issue')} issues, ${count('warn')} warnings, ${count('info')} adaptations${typeof baselineFile === 'string' ? ' (new only)' : ''}.`);
  for (const f of judged.filter(f => f.severity === 'issue').slice(0, 20)) console.log(`  issue  ${f.screen}: ${f.title}`);
  console.log(`Report written to ${outDir}`);
  // An incomplete scan is not a clean one: screens that did not answer fail the run like an issue does.
  if (report.missing.length) console.log(`  Not measured (no answer in time): ${report.missing.join(', ')}`);
  return failOn === 'none' ? 0 : (count('issue') || report.missing.length || (failOn === 'warn' && count('warn'))) ? 1 : 0;
}

let code = 2;
try { code = await run(); }
catch (error) { console.error('Samestate CI failed: ' + error.message); }
finally {
  chrome?.kill();
  await sleep(300);
  if (work) try { rmSync(work, { recursive: true, force: true }); } catch {}
}
process.exit(code);
