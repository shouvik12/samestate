// UI acceptance checks for the tool lookup in desktop Chrome. No npm packages: Node 22's WebSocket talks to Chrome directly.
//
//   node tests/tool-search.mjs                  uses Chrome from CHROME_PATH or the usual install location
//   SMOKE_HEADED=1 node tests/tool-search.mjs   shows the browser window while it runs
//   SMOKE_ROOT=path node tests/tool-search.mjs  serves another copy of the web build instead of docs/
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



const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const server=await serve(),profile=mkdtempSync(join(tmpdir(),'samestate-lookup-'));const {chrome,port}=await launch(profile);let page;const errors=[],results=[];
 const record=(name,ok,detail='')=>{results.push({name,ok});console.log(`${ok?'ok  ':'FAIL'} ${name}${detail?': '+detail:''}`)};
 try{
  const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();page=new Session(target.webSocketDebuggerUrl);await page.open();await page.send('Runtime.enable');await page.send('Page.enable');
  page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description||exceptionDetails.text));
  const evaluate=e=>page.evaluate(e),until=async(e)=>{for(let i=0;i<200;i++){if(await evaluate(e).catch(()=>false))return;await sleep(100)}throw Error('Timed out: '+e)};
  await page.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});await until('typeof commands === "function" && !!document.querySelector("#search-tools")');
  await evaluate(`$('#skip').click();open(DEMO_URL)`);await until('active().length&&active().every(d=>d.ready)');
  const open=()=>evaluate(`$('#search-tools').click()`),query=q=>evaluate(`$('#command-input').value=${JSON.stringify(q)};$('#command-input').dispatchEvent(new Event('input'))`);
  await open();const count=await evaluate('commands().length');record('Visible Search tools opens the full catalog',await evaluate(`$('#command-bar').open&&commandList.length===commands().length&&commandList.length>100`),String(count)+' features');
  await query('where can I find meta data');record('Purpose search finds metadata',await evaluate(`commandList.some(c=>c.id==='panel:meta')`));
  await query('meta');record('Meta panel ranks first for its alias',await evaluate(`commandList[0]?.id==='panel:meta'`));
  await evaluate(`$('#command-input').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);record('Arrow keys update the active result',await evaluate(`commandAt===1&&$('#command-input').getAttribute('aria-activedescendant')==='command-1'`));await evaluate(`$('#command-input').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));$('#command-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await until('!$("#pane-meta").hidden&&document.querySelectorAll("#meta-view .cards section").length===7');record('A lookup result opens the Meta panel',await evaluate(`!$('#command-bar').open&&!$('#pane-meta').hidden`));
  await open();await query('best practices');record('Measurement suggestions are discoverable',await evaluate(`commandList.some(c=>c.id==='#open-outline')`));
  await query('accesibility');record('Minor spelling mistakes still find features',await evaluate(`commandList.length>0&&commandList.some(c=>/accessibility/i.test(c.description+' '+c.aliases))`));
  await query('');await evaluate(`$('#command-category').value='Capture';$('#command-category').dispatchEvent(new Event('change'))`);record('Category filters keep only their tools',await evaluate(`commandList.length>3&&commandList.every(c=>c.hint==='Capture')`));
  await evaluate(`$('#command-category').value='';$('#command-category').dispatchEvent(new Event('change'))`);await query('Run test');
  record('Unavailable tools remain searchable with a reason',await evaluate(`commandList[0]?.id==='#test-run'&&!commandList[0].available&&!!commandList[0].reason`));
  await evaluate('runCommand(0)');record('Unavailable results explain instead of running',await evaluate(`$('#command-bar').open&&$('#command-message').textContent.length>0&&!samestateTest.busy`));
  await query('a-tool-that-definitely-does-not-exist-xyz');await evaluate(`$('#command-input').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));$('#command-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);record('Empty results handle keyboard actions safely',await evaluate(`commandList.length===0&&!$('#command-input').hasAttribute('aria-activedescendant')&&$('#command-bar').open`));
  await query('night mode');record('Exact simulator name retains its ranking',await evaluate(`commandList[0]?.label==='Simulator: Night mode'`));await evaluate('runCommand(0)');await sleep(200);record('Enter runs the chosen simulator on all screens',await evaluate(`active().every(d=>d.iframe.style.filter.includes('sepia'))`));
  await evaluate(`debugTarget='all';setSim('');debugTarget=null`);
  await open();await query('Open Workspaces');await evaluate('runCommand(0)');record('Closed drawers open through the lookup',await evaluate(`$('#workspaces-drawer').open&&!$('#command-bar').open`));
  await open();await query('Configure AI connection');await evaluate('runCommand(0)');record('AI setup is discoverable without sending a request',await evaluate(`$('#tests-drawer').open&&$('#test-ai').open&&!samestateTest.busy`));
  await evaluate(`$('#ai-key').value='SECRET_TOOL_LOOKUP_KEY'`);await open();record('Catalog never includes stored field values',await evaluate(`!JSON.stringify(commands().map(({label,description,aliases,reason})=>({label,description,aliases,reason}))).includes('SECRET_TOOL_LOOKUP_KEY')`));
  await query('pdf');record('Formats and exports are included',await evaluate(`commandList.some(c=>/pdf/i.test(c.label))`));
  await query('Design overlay');record('Reference-screen tools are included',await evaluate(`commandList.some(c=>c.label==='Design overlay'&&c.description.includes('reference screen'))`));
  await query('Sync: Typing');record('Sync controls are included',await evaluate(`commandList.some(c=>c.id==='sync:form')`));
  await query('');const coverage=await evaluate(`DEBUG_MENU.filter(i=>i.id||i.sim!==undefined||i.action).filter(i=>!commands().some(c=>i.id?c.label.startsWith(i.label):i.sim!==undefined?c.label.startsWith('Simulator: '+i.label):i.action==='grid'?c.label==='Grid settings':c.label===i.label.replace('…',''))).map(i=>i.label)`);record('Every debug tool, simulator and action is indexed',coverage.length===0,coverage.join(', '));
  if(process.env.TOOL_SEARCH_SCREENSHOT){await query('meta');await sleep(50);const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(process.env.TOOL_SEARCH_SCREENSHOT,Buffer.from(shot.data,'base64'));}
  await evaluate(`$('#command-bar').close();$('#search-tools').focus()`);await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'k',code:'KeyK',modifiers:2,windowsVirtualKeyCode:75});await until('$("#command-bar").open');record('Ctrl+K opens the same lookup',true);
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until('!$("#command-bar").open');record('Escape closes and restores focus',await evaluate(`document.activeElement.id==='search-tools'`));
  record('No page errors',errors.length===0,errors.join('; '));const failed=results.filter(r=>!r.ok);console.log(`\n${results.length-failed.length}/${results.length} tool lookup checks passed`);if(failed.length)process.exitCode=1;
 }finally{page?.ws.close();chrome.kill();server.closeAllConnections();server.close();await sleep(300);rmSync(profile,{recursive:true,force:true});}
}
main().then(()=>process.exit(process.exitCode||0)).catch(e=>{console.error(e);process.exit(1)});
