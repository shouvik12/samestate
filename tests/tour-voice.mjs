// UI acceptance checks for the finished demo narration in desktop Chrome. No npm packages: Node 22's WebSocket talks to Chrome directly.
//
//   node tests/tour-voice.mjs                  uses Chrome from CHROME_PATH or the usual install location
//   SMOKE_HEADED=1 node tests/tour-voice.mjs   shows the browser window while it runs
//   SMOKE_ROOT=path node tests/tour-voice.mjs  serves another copy of the web build instead of docs/
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(process.env.SMOKE_ROOT || fileURLToPath(new URL('../docs/', import.meta.url)));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4', '.gif': 'image/gif', '.json': 'application/json', '.mp3': 'audio/mpeg' };

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
    '--mute-audio', '--no-first-run', '--no-default-browser-check', '--window-size=1600,1000', '--autoplay-policy=document-user-activation-required',
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





const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const server=await serve(),profile=mkdtempSync(join(tmpdir(),'samestate-tour-voice-'));const {chrome,port}=await launch(profile);let page;
 const errors=[],results=[];
 const record=(name,ok,detail='')=>{results.push({name,ok});console.log(`${ok?'ok  ':'FAIL'} ${name}${detail?': '+detail:''}`)};
 try{
  const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();page=new Session(target.webSocketDebuggerUrl);await page.open();await page.send('Runtime.enable');await page.send('Page.enable');
  page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description||exceptionDetails.text));
  const evaluate=e=>page.evaluate(e);
  const until=async e=>{for(let i=0;i<300;i++){if(errors.length)throw Error(errors.join('; '));if(await evaluate(e).catch(()=>false))return;await sleep(100)}throw Error('Timed out: '+e+'; '+JSON.stringify(await evaluate(`({phase:tourPhase,step:tourStep,voice:samestateTourVoice.get()})`)))};
  const click=async selector=>{const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await page.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});};
  const url=`http://127.0.0.1:${server.address().port}/?tour-pace=0.05`;
  await page.send('Page.navigate',{url});await until('!!window.samestateTourVoice && !!window.samestateDemoNarration && tourPhase!==\'preparing\'');
  const clips=await evaluate('samestateDemoNarration.clips');
  record('All 46 steps have narration matching their current captions',await evaluate(`STEPS.length===46 && samestateDemoNarration.clips.length===46 && STEPS.every(step=>{const el=document.createElement('div');el.innerHTML=step.text;return samestateDemoNarration.clips.some(c=>c.title===step.title&&c.caption===el.textContent.trim().replace(/\\s+/g,' '))})`));
  const files=clips.flatMap(c=>c.extensionFile?[c.file,c.extensionFile]:[c.file]);
  record('All 47 MP3 files are identical in extension and web builds',files.every(f=>{const web=readFileSync(join(ROOT,'demo/narration',f)),ext=readFileSync(join(ROOT,'../extension/demo/narration',f));return web.length>5000&&web.equals(ext)}));
  const decoded=await evaluate(`(async()=>{const ctx=new OfflineAudioContext(1,1,44100),out=[];for(const c of samestateDemoNarration.clips){for(const file of [c.file,...(c.extensionFile?[c.extensionFile]:[])]){const res=await fetch('demo/narration/'+file);const b=await ctx.decodeAudioData(await res.arrayBuffer());const samples=b.getChannelData(0);let peak=0;for(let i=0;i<samples.length;i+=100)peak=Math.max(peak,Math.abs(samples[i]));out.push({file,duration:b.duration,peak});}}return out})()`);
  record('Every clip decodes into audible audio',decoded.length===47&&decoded.every(c=>c.duration>2&&c.duration<60&&c.peak>.02&&c.peak<=1.01),`${decoded.length} decoded clips`);
  await until('samestateTourVoice.get().blocked');
  record('Mute sits beside Pause with an accessible label',await evaluate(`$('#tour-mute').previousElementSibling===$('#tourpause') && $('#tour-mute').getAttribute('aria-label')==='Enable demo narration'`));
  await until('samestateTourVoice.get().blocked');
  record('Browser autoplay blocking offers Enable voice without stopping the demo',await evaluate(`$('#tour-mute span').textContent==='Enable voice' && !samestateTourVoice.waiting && tourRunning`));
  await click('#tour-mute');await until("!$('#tour-audio').paused && $('#tour-audio').currentTime>.15");
  record('A real click enables the bundled voice recording',await evaluate(`!samestateTourVoice.get().blocked && !samestateTourVoice.get().muted && $('#tour-audio').src.includes('demo/narration/')`));
  if(process.env.VOICE_SCREENSHOT){const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(process.env.VOICE_SCREENSHOT,Buffer.from(shot.data,'base64'));}
  await click('#tourpause');const frozen=await evaluate("$('#tour-audio').currentTime");await sleep(450);
  record('Pause holds both voice and demo',await evaluate(`tourPaused && $('#tour-audio').paused && Math.abs($('#tour-audio').currentTime-${frozen})<.05`));
  await click('#tourpause');await until(`!tourPaused && !$('#tour-audio').paused && $('#tour-audio').currentTime>${frozen+.1}`);
  record('Resume continues the same narration position',true);
  await click('#tour-mute');await sleep(150);
  record('Mute silences narration and saves the preference',await evaluate(`samestateTourVoice.get().muted && $('#tour-audio').paused && localStorage.getItem('samestate.tourMuted')==='true' && $('#tour-mute').getAttribute('aria-pressed')==='true' && !tourPaused`));
  await click('#tour-mute');await until("!samestateTourVoice.get().muted && !$('#tour-audio').paused");
  await evaluate('startTour();true');await until("tourStep===0 && tourPhase==='waiting' && samestateTourVoice.waiting && !tourManual");
  record('Autoplay holds a completed scene until its narration ends',await evaluate('!tourPaused && !samestateTourVoice.get().finished'));
  await evaluate("$('#tour-audio').currentTime=$('#tour-audio').duration-.25;true");await until("tourStep===1 && samestateTourVoice.get().title==='Same state, different layout'");
  record('Narration ending releases automatic playback',true);
  await evaluate('goTourStep(0);true');await until("tourStep===0 && tourPhase==='waiting' && samestateTourVoice.waiting");
  record('Manual selection also waits for its full narration',await evaluate('tourRunning && !tourPaused && !samestateTourVoice.get().finished'));
  await evaluate("$('#tour-audio').currentTime=$('#tour-audio').duration-.25;true");await until('tourStep===0 && tourPaused && samestateTourVoice.get().finished');
  record('Manual navigation holds the step after its voice finishes',true);
  await click('#tour-next');await until("samestateTourVoice.get().title==='Same state, different layout' && !$('#tour-audio').paused");
  record('Next starts the matching clip without overlapping audio',await evaluate(`document.querySelectorAll('#tour-audio').length===1 && $('#tour-audio').src.includes('same-state-different-layout.mp3') && $('#tour-audio').currentTime<2`));
  await click('#tour-prev');await until("samestateTourVoice.get().title==='Click sync' && !$('#tour-audio').paused");
  record('Previous replaces the voice with the earlier explanation',await evaluate(`$('#tour-audio').src.includes('click-sync.mp3') && $('#tour-audio').currentTime<2`));
  await evaluate('goTourStep(5);goTourStep(8);goTourStep(12);true');await until("samestateTourVoice.get().title==='Follow links' && !$('#tour-audio').paused");
  record('Rapid jumps leave only the latest narration playing',await evaluate(`tourStep===12 && $('#tour-audio').src.includes('follow-links.mp3')`));
  await evaluate(`goTourStep(STEPS.findIndex(s=>s.title==='Search every tool'));true`);await until("$('#command-bar').open && samestateTourVoice.get().title==='Search every tool' && !$('#tour-audio').paused");
  record('Voice controls remain usable inside native modal tools',await evaluate(`$('#tour-mute').closest('dialog').id==='command-bar' && !$('#tour-mute').inert`));
  await click('#tour-mute');record('Mute works from the modal',await evaluate('samestateTourVoice.get().muted'));
  await click('#skip');await until('!tourRunning && !samestateTourFeatures.active');
  record('Skip stops and unloads narration immediately',await evaluate(`$('#tour-audio').paused && !$('#tour-audio').getAttribute('src') && samestateTourVoice.get().title===null`));
  await page.send('Page.navigate',{url});await until('!!window.samestateTourVoice && tourRunning');
  record('Muted preference survives refresh',await evaluate(`samestateTourVoice.get().muted && $('#tour-mute span').textContent==='Unmute'`));
  await evaluate('endTour(false)');await until('!samestateTourFeatures.active');
  await evaluate('goTourStep(0);true');await until("samestateTourVoice.get().title==='Click sync'");await click('#tour-mute');if(await evaluate('tourPaused'))await click('#tourpause');await until("!$('#tour-audio').paused");
  await evaluate("$('#tour-audio').src='demo/narration/missing-voice.mp3';$('#tour-audio').load();true");await until('samestateTourVoice.get().failed');
  record('Missing audio offers Retry without trapping the walkthrough',await evaluate(`!samestateTourVoice.waiting && $('#tour-mute span').textContent==='Retry voice'`));
  await click('#tour-mute');if(await evaluate('tourPaused'))await click('#tourpause');await until("!samestateTourVoice.get().failed && !$('#tour-audio').paused && $('#tour-audio').src.includes('click-sync.mp3')");
  record('Retry restores and plays the correct clip',true);
  await click('#skip');await until('!tourRunning && !samestateTourFeatures.active');
  record('No page errors',errors.length===0,errors.join('; '));
  const failed=results.filter(r=>!r.ok);console.log(`\n${results.length-failed.length}/${results.length} narration checks passed`);if(failed.length)process.exitCode=1;
 }finally{page?.ws.close();chrome.kill();server.closeAllConnections();server.close();await sleep(300);rmSync(profile,{recursive:true,force:true});}
}
main().then(()=>process.exit(process.exitCode||0)).catch(error=>{console.error(error);process.exit(1)});
