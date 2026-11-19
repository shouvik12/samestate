// UI acceptance checks for the demo carousel in desktop Chrome. No npm packages: Node 22's WebSocket talks to Chrome directly.
//
//   node tests/tour-navigation.mjs                  uses Chrome from CHROME_PATH or the usual install location
//   SMOKE_HEADED=1 node tests/tour-navigation.mjs   shows the browser window while it runs
//   SMOKE_ROOT=path node tests/tour-navigation.mjs  serves another copy of the web build instead of docs/
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
  const server=await serve(),profile=mkdtempSync(join(tmpdir(),'samestate-carousel-'));
  const {chrome,port}=await launch(profile);let page;const errors=[],results=[];
  const record=(name,ok,detail='')=>{results.push({name,ok});console.log(`${ok?'ok  ':'FAIL'} ${name}${detail?': '+detail:''}`)};
  try {
    const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
    page=new Session(target.webSocketDebuggerUrl);await page.open();await page.send('Runtime.enable');await page.send('Page.enable');
    page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description||exceptionDetails.text));
    const evaluate=e=>page.evaluate(e);
    const until=async e=>{for(let i=0;i<350;i++){if(errors.length)throw Error(errors.join('; '));if(await evaluate(e).catch(()=>false))return;await sleep(100)}throw Error('Timed out: '+e+'; '+JSON.stringify(await evaluate(`({step:tourStep,phase:tourPhase,paused:tourPaused,title:$('#tourname').textContent})`)))};
    const index=title=>evaluate(`STEPS.findIndex(s=>s.title===${JSON.stringify(title)})`);
    const ready=async title=>{const i=await index(title);await until(`tourStep===${i} && tourPhase==='waiting' && tourPaused`)};
    const jump=async title=>{const i=await index(title);await evaluate(`$('#tour-step').value='${i}';$('#tour-step').dispatchEvent(new Event('input',{bubbles:true}));$('#tour-step').dispatchEvent(new Event('change',{bubbles:true}));true`);await ready(title)};
    await page.send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('samestate.tourMuted','true')"}); // Audio has its own acceptance suite.
    await page.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?tour-pace=0.05`});
    await until('!!window.samestateTourFeatures && active().length && active().every(d=>d.ready)');
    await evaluate('endTour(false)');await until('!samestateTourFeatures.active && !pendingSnap.size');
    await evaluate(`samestateTest.load({samestate:'test',version:1,site:'demo:index.html',plan:'Keep my carousel test',steps:[{do:'expect',text:'Customer stories'}]});window.__carouselSaved={test:localStorage.getItem('samestate.test'),groups:localStorage.getItem('samestate.checkGroups'),grid:localStorage.getItem('samestate.grid')}`);
    record('Carousel controls and complete step picker exist',await evaluate(`!!$('#tour-prev') && !!$('#tour-next') && $('#tour-step').options.length===STEPS.length`));
    await jump('Same state, different layout');
    record('Jump prepares the live Sign in scene',await evaluate(`active().every(d=>d.iframe.contentDocument.querySelector('#signin').open) && $('#tour-step').value==='1'`));
    await evaluate(`$('#tour-prev').click()`);await ready('Click sync');
    record('Previous restores the earlier Products scene',await evaluate(`active().every(d=>!d.iframe.contentDocument.querySelector('#signin').open && (d.iframe.contentDocument.querySelector('#drawer.open') || d.iframe.contentDocument.querySelector('.dd-menu:not([hidden])')))`));
    record('First step disables Previous',await evaluate(`$('#tour-prev').disabled && !$('#tour-next').disabled`));
    const firstOpen=await evaluate('openId');await evaluate(`$('#tour-next').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))`);await sleep(150);
    record('Left arrow at the boundary keeps the first scene',await evaluate(`tourStep===0 && tourPhase==='waiting'`) && await evaluate('openId')===firstOpen);
    const opened=await evaluate('openId');await evaluate(`$('#tour-next').click()`);await ready('Same state, different layout');
    record('Next advances a finished scene without reloading',await evaluate('openId')===opened && await evaluate(`active().every(d=>d.iframe.contentDocument.querySelector('#signin').open)`));
    await evaluate(`$('#tour-next').click()`);await ready('Any screen can lead');
    record('Consecutive Next shows the real closed-dialog scene',await evaluate(`active().every(d=>!d.iframe.contentDocument.querySelector('#signin').open)`));
    await jump('Works both ways');record('A jump reconstructs the required dark-mode state',await evaluate(`active().every(d=>!d.iframe.contentDocument.documentElement.classList.contains('dark'))`));
    await jump('Rulers and layout grids');
    record('Step picker works inside the grid dialog',await evaluate(`$('#grid-dialog').open && $('#tour-step').closest('dialog').id==='grid-dialog'`));
    await jump('Keyboard order and landmarks');
    record('Step picker leaves grid preferences untouched',await evaluate(`localStorage.getItem('samestate.grid')===__carouselSaved.grid`));
    record('Direct jump prepares Outline before showing focus order',await evaluate(`!$('#pane-outline').hidden && samestateOutline.get().data.focus.length>0 && active().some(d=>d.outlineState?.focus)`));
    await jump('Human review and combined results');
    record('Direct jump produces real combined results with pending reviews',await evaluate(`samestateChecks.get().results.some(r=>!r.manual) && samestateChecks.get().results.filter(r=>r.manual).every(r=>r.status==='review') && !$('#tour').inert`));
    if(process.env.TOUR_NAV_SCREENSHOT){const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(process.env.TOUR_NAV_SCREENSHOT,Buffer.from(shot.data,'base64'));}
    await jump('Search every tool');
    record('Navigation stays usable in a native modal',await evaluate(`$('#command-bar').open && $('#tour').parentNode.id==='command-bar' && !$('#tour-next').disabled`));
    await evaluate(`$('#tour-next').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);await ready('Meta and social previews');
    record('Right arrow advances from a modal to Meta',await evaluate(`!$('#command-bar').open && !$('#pane-meta').hidden && !!lastMeta`));
    await evaluate(`$('#tour-prev').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))`);await ready('Search every tool');
    record('Left arrow returns to the search scene',await evaluate(`$('#command-bar').open && $('#command-input').value==='meta'`));
    const fixed=await evaluate('tourStep');await evaluate(`$('#command-input').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);await sleep(150);
    record('Arrow keys in editable fields keep their normal behavior',await evaluate('tourStep')===fixed);
    await evaluate(`goTourStep(6);goTourStep(8);goTourStep(12);true`);await ready('Follow links');await sleep(300);
    record('Rapid changes settle on the latest requested step',await evaluate(`tourStep===12 && active().every(d=>d.iframe.contentDocument.location.pathname.endsWith('/pricing.html'))`));
    await evaluate(`$('#tourpause').click()`);await until('tourStep>=13');
    record('Resume continues automatic playback',await evaluate('!tourManual && !tourPaused'));
    await jump('Sweep responsive widths');
    record('Completed width sweep is visible after a direct jump',await evaluate(`!sweepRun && $('#sweep-status').textContent.includes('1920px')`));
    await evaluate(`goTourStep(STEPS.findIndex(s=>s.title==='Sweep responsive widths'));true`);await until('!!sweepRun');
    await evaluate(`goTourStep(0);true`);await ready('Click sync');
    record('Changing steps cancels an active sweep and restores widths',await evaluate(`!sweepRun && active().every(d=>!d.sweepW)`));
    await evaluate(`$('#tour').dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,pointerType:'touch',button:0,clientX:160,clientY:50,bubbles:true}));$('#tour').dispatchEvent(new PointerEvent('pointerup',{pointerId:9,pointerType:'touch',button:0,clientX:70,clientY:52,bubbles:true}))`);await ready('Same state, different layout');
    record('Swiping left advances the carousel',true);
    await evaluate(`$('#tour').dispatchEvent(new PointerEvent('pointerdown',{pointerId:10,pointerType:'touch',button:0,clientX:70,clientY:50,bubbles:true}));$('#tour').dispatchEvent(new PointerEvent('pointerup',{pointerId:10,pointerType:'touch',button:0,clientX:160,clientY:52,bubbles:true}))`);await ready('Click sync');
    record('Swiping right restores the previous scene',true);

    await evaluate(`$('#tour-next').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))`);await ready('That is the tour');
    record('Last step disables Next and still allows Previous',await evaluate(`$('#tour-next').disabled && !$('#tour-prev').disabled`));
    await evaluate(`$('#tour-prev').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}))`);await ready('Click sync');
    record('Home returns to the first scene',await evaluate('tourStep===0'));
    await evaluate(`goTourStep(5);$('#skip').click();true`);await until('!tourRunning && !samestateTourFeatures.active');await sleep(350);
    record('Skip cancels pending navigation without restarting',await evaluate(`$('#tour').hidden && !tourRunning`));
    record('Saved tests and group choices survive all navigation',await evaluate(`localStorage.getItem('samestate.test')===__carouselSaved.test && localStorage.getItem('samestate.checkGroups')===__carouselSaved.groups && samestateTest.get().plan==='Keep my carousel test'`));
    record('No page errors',errors.length===0,errors.join('; '));
    const failed=results.filter(r=>!r.ok);console.log(`\n${results.length-failed.length}/${results.length} carousel checks passed`);if(failed.length)process.exitCode=1;
  }finally{page?.ws.close();chrome.kill();server.closeAllConnections();server.close();await sleep(300);rmSync(profile,{recursive:true,force:true});}
}
main().then(()=>process.exit(process.exitCode||0)).catch(error=>{console.error(error);process.exit(1)});
