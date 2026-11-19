// UI acceptance checks for outline and element inspection in desktop Chrome. No npm packages: Node 22's WebSocket talks to Chrome directly.
//
//   node tests/outline.mjs                  uses Chrome from CHROME_PATH or the usual install location
//   SMOKE_HEADED=1 node tests/outline.mjs   shows the browser window while it runs
//   SMOKE_ROOT=path node tests/outline.mjs  serves another copy of the web build instead of docs/
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
 const server = await serve(), profile = mkdtempSync(join(tmpdir(), 'samestate-outline-'));
 const {chrome,port} = await launch(profile);
 const errors=[],results=[];
 const record=(name,ok,detail='')=>{results.push({name,ok});console.log(`${ok?'ok  ':'FAIL'} ${name}${detail?': '+detail:''}`)};
 try{
  const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  const page=new Session(target.webSocketDebuggerUrl);await page.open();
  await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Browser.setDownloadBehavior',{behavior:'deny'});
  page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description||exceptionDetails.text));
  const evaluate=s=>page.evaluate(s);
  const until=async(s,ms=30_000)=>{for(const start=Date.now();Date.now()-start<ms;await sleep(100))if(await evaluate(s).catch(()=>false))return;throw Error('Timed out: '+s)};
  await page.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
  await until('typeof samestateOutline === "object"');
  await evaluate(`$('#skip').click(); open(DEMO_URL)`);
  await until('active().length && active().every(d=>d.ready)');
  await evaluate(`for(const d of DEVICES)if(d.on&&!['iphone','desktop'].includes(d.id))toggleDevice(d,false);$('#ref').value='desktop';focusDev=DEVICES.find(d=>d.id==='desktop');setMode('focus');if(!$('#sidebar').hidden)$('#toggle-sidebar').click();`);
  await until('active().length===2&&active().every(d=>d.ready)');
  const fixture=`<a id="skip-inspect" style="position:absolute;left:-9999px" href="#content">Skip to content</a>
<header><nav aria-label="Primary"><button id="priority" tabindex="3">Priority</button><a href="#content">Home</a></nav></header>
<main id="content"><h1>Inspection fixture</h1><h3>Skipped section</h3><div role="heading" aria-level="2">ARIA subtitle</div><div role="heading">Implicit level</div>
<h2 style="display:none">Hidden heading</h2><h2 style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Screen-reader heading</h2>
<button id="tiny" onclick="window.__activated=(window.__activated||0)+1" style="box-sizing:border-box;width:20px;height:18px;padding:1px 2px 3px 4px;margin:4px 8px 12px 16px;border:1px solid black;font-size:12px;line-height:14px;color:#aaa;background:#fff">Go</button>
<button id="medium" style="box-sizing:border-box;width:32px;height:32px;padding:0">Tap</button>
<label>Email<input id="email" value="PRIVATE_TYPED_VALUE"></label><label>Password<input type="password" value="PASSWORD_SECRET_VALUE"></label>
<label><input type="radio" name="choice" value="A">A</label><label><input type="radio" name="choice" value="B" checked>B</label>
<button aria-hidden="true">Hidden from AT</button><div inert><button>Inert control</button></div><fieldset disabled><input aria-label="Disabled field"></fieldset><button tabindex="-1">Not a tab stop</button>
<details><summary>Closed details</summary><button>Closed child</button></details>
<div data-samestate-private><h2>CONFIDENTIAL-NOTE</h2><button>PRIVATE_CONTROL_NAME</button></div>
<p style="font-size:16px;line-height:16px;width:1000px">${'Readable content for long lines and line spacing. '.repeat(20)}</p>
</main><footer><nav><a href="#footer">Footer</a></nav></footer>`;
  await evaluate(`for(const d of active()){const doc=d.iframe.contentDocument;doc.body.innerHTML=${JSON.stringify(fixture)};const style=doc.createElement('style');style.textContent='body{background:white!important;color:#111!important;padding:20px!important;margin:0!important}button,input,a{font-family:Arial}header,nav,footer,main{display:block!important}h1{font-size:32px!important}';doc.head.append(style);doc.defaultView.__activated=0;} $('#open-outline').click();`);
  await until('!!samestateOutline.get().data');
  const got=await evaluate('samestateOutline.get()'),data=got.data;
  record('Measure opens the Outline panel',await evaluate(`!$('#pane-outline').hidden&&!$('#panel').hidden&&$('#outline-screen').options.length===2`));
  record('Native and ARIA headings are listed',data.headings.some(i=>i.name==='ARIA subtitle'&&i.level===2)&&data.headings.some(i=>i.name==='Implicit level'&&i.suggestions.length));
  record('Hidden and screen-reader-only states differ',data.headings.some(i=>i.name==='Hidden heading'&&i.hidden&&i.atHidden)&&data.headings.some(i=>i.name==='Screen-reader heading'&&i.hidden&&!i.atHidden));
  record('Suggestions explain skipped levels',data.headings.find(i=>i.name==='Skipped section').suggestions.some(s=>s.title.includes('hierarchy')));
  record('Landmarks include named nav and page regions',data.landmarks.some(i=>i.role==='navigation'&&i.name==='Primary')&&data.landmarks.some(i=>i.role==='banner')&&data.landmarks.some(i=>i.role==='main')&&data.landmarks.some(i=>i.role==='contentinfo'));
  record('Positive tabindex precedes normal focus order',data.focus[0].name==='Priority'&&data.focus[0].tabindex===3&&data.focus[0].suggestions.some(s=>s.title.includes('document focus')));
  record('Focus order retains the off-screen skip link',data.focus.some(i=>i.name==='Skip to content'&&i.hidden));
  record('Focus order handles disabled, inert, closed and radio controls',!data.focus.some(i=>['Inert control','Disabled field','Not a tab stop','Closed child','A'].includes(i.name))&&data.focus.some(i=>i.name==='B'&&i.role==='radio'),data.focus.map(i=>i.name+' ('+i.role+')').join(', '));
  record('ARIA-hidden focusable controls are flagged',data.focus.find(i=>i.name==='Hidden from AT').suggestions.some(s=>s.kind==='check'));
  record('Field values and private text are absent',!JSON.stringify(data).match(/PRIVATE_TYPED_VALUE|PASSWORD_SECRET_VALUE|CONFIDENTIAL-NOTE|PRIVATE_CONTROL_NAME/));
  await evaluate(`$('#outline-mode').value='focus';$('#outline-mode').dispatchEvent(new Event('change'));var key=samestateOutline.get().data.focus.find(i=>i.name==='Go').key;document.querySelector('[data-outline-key="'+key+'"]').click();`);
  await until('samestateOutline.get().measurement?.name==="Go"');
  const measured=await evaluate('samestateOutline.get().measurement');
  record('Measurements use CSS pixels before scaling',measured.rect.width===20&&measured.rect.height===18&&measured.padding.left===4&&measured.margin.right===8&&measured.typography.fontSize===12);
  record('Target and contrast guidance includes exceptions and sources',measured.suggestions.some(s=>s.title.includes('pointer target')&&s.detail.includes('exceptions'))&&measured.suggestions.some(s=>s.title.includes('contrast')&&s.source.startsWith('https://www.w3.org/WAI/')));
  await evaluate(`var key=samestateOutline.get().data.focus.find(i=>i.name==='Tap').key;document.querySelector('[data-outline-key="'+key+'"]').click();`);
  await until('samestateOutline.get().measurement?.name==="Tap"');
  const medium=await evaluate('samestateOutline.get().measurement');
  record('44px advice is distinguished from the AA minimum',medium.suggestions.some(s=>s.detail.includes('44')&&s.detail.includes('AAA')&&s.detail.includes('AA'))&&!medium.suggestions.some(s=>s.title==='Review the pointer target'));
  await evaluate(`$('#outline-landmarks-overlay').click();$('#outline-focus-overlay').click()`);await sleep(250);
  record('Landmark boxes and numbered focus arrows are drawn',await evaluate(`(() => { const doc=DEVICES.find(d=>d.id==='desktop').iframe.contentDocument,host=doc.querySelector('[data-samestate-outline]');return !!host&&host.shadowRoot.textContent.includes('main')&&host.shadowRoot.querySelectorAll('svg circle').length>3&&host.shadowRoot.querySelectorAll('svg line').length>2;})()`));
  await evaluate('detect(true)');const withOverlays=await evaluate('findings.map(f=>[f.cat,f.kind,reportName(f.dev)]).sort().map(JSON.stringify).join("|")');
  await evaluate(`$('#outline-clear').click()`);await sleep(150);await evaluate('detect(true)');
  const withoutOverlays=await evaluate('findings.map(f=>[f.cat,f.kind,reportName(f.dev)]).sort().map(JSON.stringify).join("|")');
  record('Inspection overlays do not become report findings',withOverlays===withoutOverlays);
  await evaluate(`$('#outline-pick').click()`);
  const point=await evaluate(`(() => {const d=DEVICES.find(d=>d.id==='desktop'),r=d.iframe.contentDocument.getElementById('tiny').getBoundingClientRect(),f=d.iframe.getBoundingClientRect(),scale=f.width/d.iframe.contentWindow.innerWidth;return {x:f.left+(r.left+r.width/2)*scale,y:f.top+(r.top+r.height/2)*scale};})()`);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  await until('samestateOutline.get().measurement?.name==="Go"&&$("#outline-pick").getAttribute("aria-pressed")==="false"');await sleep(250);
  record('Picking measures without activating or syncing a control',await evaluate('active().every(d=>d.iframe.contentWindow.__activated===0)'));
  await evaluate(`$('#outline-pick').click()`);await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await until('$("#outline-pick").getAttribute("aria-pressed")==="false"');record('Escape cancels picking from the UI',true);
  await evaluate(`$('#outline-pick').click();showTab('checks')`);await sleep(150);record('Leaving Outline cancels picking',await evaluate('active().every(d=>!d.outlineState?.pick)'));
  await evaluate(`showTab('outline')`);await until('!!samestateOutline.get().data');
  await evaluate(`$('#outline-mode').value='focus';$('#outline-mode').dispatchEvent(new Event('change'));$('#outline-issues-only').click()`);
  record('Suggestions-only filter hides ordinary rows',await evaluate(`document.querySelectorAll('#outline-list [data-outline-key]').length<samestateOutline.get().data.focus.length`));
  await evaluate(`window.__outlineBlob=null;const make=URL.createObjectURL;URL.createObjectURL=b=>{window.__outlineBlob=b;return make(b)};$('#outline-export').click();`);
  const exported=await evaluate('__outlineBlob.text()');record('Export retains measurements and guidance without secrets',JSON.parse(exported).format==='samestate-outline'&&!/PRIVATE_TYPED_VALUE|PASSWORD_SECRET_VALUE|CONFIDENTIAL-NOTE|PRIVATE_CONTROL_NAME/.test(exported));
  await evaluate(`$('#outline-screen').value=String(workspaceScreens().findIndex(d=>d.id==='iphone'));$('#outline-screen').dispatchEvent(new Event('change'))`);
  await until('samestateOutline.get().screen==="iphone"&&!!samestateOutline.get().data');
  record('Selecting a hidden Focus preview makes it measurable',await evaluate(`focusDev.id==='iphone'&&DEVICES.find(d=>d.id==='iphone').iframe.contentDocument.querySelector('h1').getBoundingClientRect().width>0`));
  await evaluate(`$('#outline-screen').value=String(workspaceScreens().findIndex(d=>d.id==='desktop'));$('#outline-screen').dispatchEvent(new Event('change'))`);
  await until('samestateOutline.get().screen==="desktop"&&!!samestateOutline.get().data');
  // A page with only an ARIA level-1 heading must not receive a missing-main-heading warning.
  await evaluate(`(async()=>{setMode('grid');for(const d of active()){const doc=d.iframe.contentDocument;doc.querySelector('h1').outerHTML='<div role="heading" aria-level="1">Accessible page title</div>';} await detect(true);})()`);
  record('Difference reports recognize ARIA headings',await evaluate(`!findings.some(f=>f.kind==='No main heading')`));
  if(process.env.OUTLINE_SCREENSHOT){
    await evaluate(`focusDev=DEVICES.find(d=>d.id==='desktop');setMode('focus');$('#reload').click()`);await until('active().every(d=>d.ready)');await sleep(500);await evaluate(`$('#outline-issues-only').checked=false;$('#outline-mode').value='headings';$('#open-outline').click()`);await until('!!samestateOutline.get().data');
    await evaluate(`$('#outline-landmarks-overlay').click();$('#outline-focus-overlay').click();var key=samestateOutline.get().data.headings.find(h=>h.level===1).key;document.querySelector('[data-outline-key="'+key+'"]').click()`);await until('!!samestateOutline.get().measurement');await sleep(150);
    const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(process.env.OUTLINE_SCREENSHOT,Buffer.from(shot.data,'base64'));
  }
  record('No page errors',errors.length===0,errors.join('; '));const failed=results.filter(r=>!r.ok);console.log(`\n${results.length-failed.length}/${results.length} outline checks passed`);if(failed.length)process.exitCode=1;
 }finally{chrome.kill();server.close();await sleep(300);rmSync(profile,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1});
