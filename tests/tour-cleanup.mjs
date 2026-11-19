// UI acceptance checks for the guided demo cleanup in desktop Chrome. No npm packages: Node 22's WebSocket talks to Chrome directly.
//
//   node tests/tour-cleanup.mjs                  uses Chrome from CHROME_PATH or the usual install location
//   SMOKE_HEADED=1 node tests/tour-cleanup.mjs   shows the browser window while it runs
//   SMOKE_ROOT=path node tests/tour-cleanup.mjs  serves another copy of the web build instead of docs/
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




const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const server = await serve(), profile = mkdtempSync(join(tmpdir(), 'samestate-tour-cleanup-'));
  const { chrome, port } = await launch(profile); let page;
  const errors = [], results = [];
  const record = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
  try {
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    page = new Session(target.webSocketDebuggerUrl); await page.open(); await page.send('Runtime.enable'); await page.send('Page.enable');
    page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.exception?.description || exceptionDetails.text));
    const evaluate = e => page.evaluate(e);
    const until = async e => { for (let i = 0; i < 300; i++) { if (await evaluate(e).catch(() => false)) return; await sleep(100); } throw Error('Timed out: ' + e); };
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('samestate.tourMuted','true')" });
    await page.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    await until('!!window.samestateTourFeatures && active().length && active().every(d=>d.ready)');
    await evaluate('endTour(false)'); await until('!samestateTourFeatures.active && !pendingSnap.size');
    const emptyDemo = await evaluate(`(async()=>{
      ++tour;tourRunning=true;samestateTourFeatures.begin();
      for(const el of $('#checks-groups').querySelectorAll('input'))el.checked=['meta','capture'].includes(el.value);
      $('#checks-groups').dispatchEvent(new Event('change',{bubbles:true}));
      await samestateChecks.previewDemo();endTour(false);
      while(samestateTourFeatures.active)await sleep(50);
      return samestateChecks.get()===null && !$('#checks-results').childElementCount && $('#checks-export-json').disabled;
    })()`);
    record('Finishing restores an empty results panel correctly',emptyDemo);

    await evaluate(`
      samestateTest.load({samestate:'test',version:1,site:'demo:index.html',plan:'Keep my own journey',steps:[{do:'expect',text:'Customer stories'}]});
      for(const el of $('#checks-groups').querySelectorAll('input')) el.checked=['meta','capture'].includes(el.value);
      $('#checks-groups').dispatchEvent(new Event('change',{bubbles:true}));
      $('#checks-run').click();
    `);
    await until('!samestateChecks.running && !!samestateChecks.get()?.finishedAt');
    await evaluate(`
      const card=$('#checks-results .check-result[data-status=review]');
      card.querySelector('[data-review-status=passed]').click();
      const notes=card.querySelector('textarea');notes.value='Keep my reviewed note';notes.dispatchEvent(new Event('input',{bubbles:true}));
      $('#screen-settings').value='contrast';$('#screen-settings').dispatchEvent(new Event('change'));
      $('#ai-key').value='LOCAL_DEMO_KEY_SHOULD_NOT_SEND';
      window.__beforeTour={test:samestateTest.get(),raw:localStorage.getItem('samestate.test'),groups:localStorage.getItem('samestate.checkGroups'),report:samestateChecks.get()};
      window.__runDemoStep=title=>{
        const id=++tour;tourRunning=true;samestateTourFeatures.begin();$('#tour').hidden=false;
        const t={ok:()=>touring(id),nap:async()=>touring(id),point:async()=>touring(id),click:async()=>touring(id),focus:()=>{},until:async ready=>{for(let i=0;i<200&&touring(id);i++){if(ready())return true;await sleep(50)}return false;}};
        window.__demoDone=false;window.__demoError=null;
        STEPS.find(step=>step.title===title).run(t).catch(error=>{window.__demoError=error.message}).finally(()=>{window.__demoDone=true});
      };
    `);
    record('Last-week chapter is registered', await evaluate('samestateTourFeatures.titles.length===21 && STEPS.length===46'));
    await evaluate(`__runDemoStep('Run all checks')`); await until('samestateChecks.running');
    record('Pause and Skip remain usable during demo checks', await evaluate(`!$('#tour').inert && !$('#skip').disabled && !$('#tourpause').disabled`));
    await evaluate('endTour(false)'); await until('!samestateTourFeatures.active && !samestateChecks.running && __demoDone');
    record('Skip stops owned checks and restores previous results/notes', await evaluate('JSON.stringify(samestateChecks.get())===JSON.stringify(__beforeTour.report)'));
    record('Skip restores group selection and screen settings', await evaluate(`localStorage.getItem('samestate.checkGroups')===__beforeTour.groups && screenSettings==='contrast' && $('#screen-settings').value==='contrast'`));
    record('Grouped-demo cancellation leaves saved test untouched', await evaluate(`localStorage.getItem('samestate.test')===__beforeTour.raw && JSON.stringify(samestateTest.get())===JSON.stringify(__beforeTour.test) && !__demoError`));
    await evaluate(`__runDemoStep('Replay a saved test')`); await until('__demoDone');
    record('Bundled journey replays successfully on every screen', await evaluate(`!__demoError && $('#test-steps').querySelectorAll('.ok').length===4 && localStorage.getItem('samestate.test')===__beforeTour.raw`));
    await evaluate('endTour(false)'); await until('!samestateTourFeatures.active');
    await evaluate(`__runDemoStep('Replay a saved test')`); await until('samestateTest.busy');
    await evaluate('endTour(false)'); await until('!samestateTourFeatures.active && !samestateTest.busy && __demoDone');
    record('Skip stops replay and restores the tester journey', await evaluate(`localStorage.getItem('samestate.test')===__beforeTour.raw && JSON.stringify(samestateTest.get())===JSON.stringify(__beforeTour.test) && !__demoError`));
    record('AI credential field remains unchanged', await evaluate(`$('#ai-key').value==='LOCAL_DEMO_KEY_SHOULD_NOT_SEND'`));
    await evaluate(`__runDemoStep('Rulers and layout grids')`); await until(`$('#grid-dialog').open && __demoDone`);
    record('Native modal contains the live tour controls', await evaluate(`$('#tour').parentNode.id==='grid-dialog' && $('#tour-callout').parentNode.id==='grid-dialog' && $('#tour-cursor').parentNode.id==='grid-dialog'`));
    await evaluate('endTour(false)'); await until(`!samestateTourFeatures.active && !$('#grid-dialog').open && $('#tour').parentNode===document.body`);
    record('Skip closes demo modals and clears their overlays', await evaluate(`active().every(d=>!debugTools(d).size && !debugSim(d)) && $('#tour-cursor').parentNode===document.body && !__demoError`));
    await evaluate(`++tour;tourRunning=true;samestateTourFeatures.begin();$('#checks-run').click()`);
    record('Normal check launches still wait for the demo', await evaluate(`!samestateChecks.running && $('#checks-status').textContent.includes('Finish the current demo')`));
    await evaluate('endTour(false)'); await until('!samestateTourFeatures.active');
    await evaluate(`++tour;tourRunning=true;samestateTourFeatures.begin();openCommandBar()`);
    await until(`!samestateTourFeatures.active && $('#command-bar').open`);
    record('Manual search takes over and stays open after cleanup',await evaluate(`!tourRunning && $('#command-bar').open`));
    await evaluate(`$('#command-bar').close();++tour;tourRunning=true;samestateTourFeatures.begin();showTab('outline')`);
    await until(`!samestateTourFeatures.active && !$('#panel').hidden && !$('#pane-outline').hidden && !!samestateOutline.get().data`);
    record('Manual Measure takes over and stays visible after cleanup',await evaluate(`!tourRunning && !$('#panel').hidden && !$('#pane-outline').hidden`));
    await evaluate(`(async()=>{$('#find-selector').value='h2';await findElements(1);window.__findBefore={index:findIndex,selector:findSelector,status:$('#find-status').textContent};__runDemoStep('Find elements across screens')})()`);
    await until('__demoDone');await evaluate('endTour(false)');await until('!samestateTourFeatures.active');
    record('Demo restores selector-search position and status',await evaluate(`findIndex===__findBefore.index && findSelector===__findBefore.selector && $('#find-selector').value==='h2' && $('#find-status').textContent===__findBefore.status`));
    record('No page errors', errors.length === 0, errors.join('; '));
    const failed=results.filter(r=>!r.ok);console.log(`\n${results.length-failed.length}/${results.length} tour cleanup checks passed`);if(failed.length)process.exitCode=1;
  } finally {page?.ws.close();chrome.kill();server.closeAllConnections();server.close();await sleep(300);rmSync(profile,{recursive:true,force:true});}
}
main().then(()=>process.exit(process.exitCode||0)).catch(error=>{console.error(error);process.exit(1)});
