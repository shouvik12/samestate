// UI acceptance checks for the app-wide voiced feature help in desktop Chrome. No npm packages: Node 22's WebSocket talks to Chrome directly.
//
//   node tests/feature-help.mjs                  uses Chrome from CHROME_PATH or the usual install location
//   SMOKE_HEADED=1 node tests/feature-help.mjs   shows the browser window while it runs
//   SMOKE_ROOT=path node tests/feature-help.mjs  serves another copy of the web build instead of docs/
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






const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const AUDIT=`(()=>{const els=[...document.querySelectorAll('button,input:not([type=hidden]),select,textarea,summary,a[href],h1,h2,h3,legend,.dev-name,.viewport-size,.finding,.check-result,.outline-metrics dt,.debug-heading,.debug-group')].filter(e=>!e.closest('#feature-help,.sr-only'));return {count:els.length,missing:els.filter(e=>!samestateFeatureHelp.resolve(e)).map(e=>e.id||e.outerHTML.slice(0,100))}})()`;
async function main(){
 const server=await serve(),profile=mkdtempSync(join(tmpdir(),'samestate-feature-help-'));const {chrome,port}=await launch(profile);let page;const errors=[],results=[];
 const record=(name,ok,detail='')=>{results.push({name,ok});console.log(`${ok?'ok  ':'FAIL'} ${name}${detail?': '+detail:''}`)};
 try{
  const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();page=new Session(target.webSocketDebuggerUrl);await page.open();await page.send('Runtime.enable');await page.send('Page.enable');
  page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description||exceptionDetails.text));
  const evaluate=e=>page.evaluate(e);
  const until=async e=>{for(let i=0;i<300;i++){if(errors.length)throw Error(errors.join('; '));if(await evaluate(e).catch(()=>false))return;await sleep(100)}throw Error('Timed out: '+e+'; '+JSON.stringify(await evaluate('samestateFeatureHelp.get()')))};
  const click=async selector=>{const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await page.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});};
  const key=async k=>{await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:k,code:k,windowsVirtualKeyCode:k==='Escape'?27:k==='F1'?112:0});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k,windowsVirtualKeyCode:k==='Escape'?27:k==='F1'?112:0});};
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('samestate.tourMuted','true')"});
  await page.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?tour-pace=0.05`});
  await until('!!window.samestateFeatureHelp && !!window.samestateFeatureHelpNarration && active().length && active().every(d=>d.ready)');
  await evaluate('endTour(false)');await until('!samestateTourFeatures.active');
  let audit=await evaluate(AUDIT);record('Every initial app control and heading has descriptive help',audit.missing.length===0,`${audit.count} controls; ${audit.missing.join(', ')}`);
  record('Every help description has a matching finished voice clip',await evaluate(`samestateFeatureHelp.catalog().every(e=>samestateFeatureHelpNarration.clips.some(c=>c.key===e.key&&c.title===e.title&&c.caption===e.text))`));
  const clips=await evaluate('samestateFeatureHelpNarration.clips');const unique=[...new Set(clips.map(c=>c.file))];
  record('All tooltip audio files match between extension and web builds',unique.every(f=>{const a=readFileSync(join(ROOT,'help/narration',f)),b=readFileSync(join(ROOT,'../extension/help/narration',f));return a.length>3000&&a.equals(b)}),`${unique.length} audio files`);
  const decoded=await evaluate(`(async()=>{const ctx=new OfflineAudioContext(1,1,44100);let n=0;for(const file of new Set(samestateFeatureHelpNarration.clips.map(c=>c.file))){const response=await fetch('help/narration/'+file);if(!response.ok)throw Error(file);const b=await ctx.decodeAudioData(await response.arrayBuffer());const x=b.getChannelData(0);let peak=0;for(let i=0;i<x.length;i+=160)peak=Math.max(peak,Math.abs(x[i]));if(b.duration<.5||peak<.02)throw Error(file+' is silent');n++;}return n})()`);
  record('Every tooltip voice clip decodes to non-silent audio',decoded===unique.length,`${decoded} decoded clips`);
  const point=await evaluate(`(()=>{const r=$('#search-tools').getBoundingClientRect();return{x:r.x+10,y:r.y+10}})()`);await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await sleep(650);
  record('Hovering a control leaves help closed',await evaluate(`!samestateFeatureHelp.get().open && $('#feature-help-audio').paused`));
  await evaluate("$('#search-tools').focus()");await sleep(650);record('Focusing a control leaves help closed',await evaluate('!samestateFeatureHelp.get().open'));
  await click('#feature-help-open');await until('samestateFeatureHelp.get().browsing');
  record('Small top-bar icon opens searchable help without speech',await evaluate(`$('#feature-help-open').getAttribute('aria-expanded')==='true' && document.activeElement.id==='feature-help-search' && $('#feature-help-audio').paused && $('#feature-help-hear').disabled`));
  await evaluate(`$('#feature-help-search').value='no-such-feature-847';$('#feature-help-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  record('Empty help searches explain how to continue',await evaluate(`!$('#feature-help-results button') && $('#feature-help-count').textContent.includes('No explanations found')`));
  await evaluate(`$('#feature-help-search').value='Search tools';$('#feature-help-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  await click('#feature-help-results [data-help-key="#search-tools"]');
  record('Choosing an explanation does not run its tool',await evaluate(`!$('#command-bar').open && $('#feature-help-text').textContent.includes('Command K') && $('#feature-help-audio').paused && document.activeElement.id==='feature-help-hear'`));
  await click('#feature-help-hear');await until("!$('#feature-help-audio').paused && $('#feature-help-audio').currentTime>.1");
  record('Hear explanation plays real bundled audio',await evaluate(`samestateFeatureHelp.get().playing && $('#feature-help-hear').getAttribute('aria-pressed')==='true'`));
  await click('#feature-help-hear');record('Stop voice stops the explanation',await evaluate(`!samestateFeatureHelp.get().playing && $('#feature-help-audio').paused`));
  await key('Escape');await sleep(550);record('Escape dismisses help and restores the top-bar icon',await evaluate(`!samestateFeatureHelp.get().open && document.activeElement.id==='feature-help-open' && $('#feature-help-open').getAttribute('aria-expanded')==='false'`));
  await evaluate("$('#search-tools').focus()");
  await key('F1');record('F1 makes the voice control keyboard reachable',await evaluate(`samestateFeatureHelp.get().open && document.activeElement.id==='feature-help-hear'`));
  await key('Escape');await evaluate("$('#search-tools').click()");await until("$('#command-bar').open");
  await evaluate("samestateFeatureHelp.show($('#command-input'),true)");
  record('Interactive help remains usable in a native modal',await evaluate(`$('#feature-help').parentElement.id==='command-bar' && !$('#feature-help-hear').inert && $('#feature-help').matches(':popover-open')`));
  await click('#feature-help-hear');await until("!$('#feature-help-audio').paused");await key('Escape');
  record('First Escape closes the help before its parent modal',await evaluate(`!samestateFeatureHelp.get().open && $('#command-bar').open && document.activeElement.id==='command-input'`));
  await key('Escape');await until("!$('#command-bar').open");
  await evaluate(`openGridSettings();$('#grid-columns').value='9';samestateFeatureHelp.show($('#grid-columns'),true)`);
  const gridBefore=await evaluate("localStorage.getItem('samestate.grid')");await click('#feature-help-hear');await until("!$('#feature-help-audio').paused");await click('#feature-help-close');
  record('Help playback and closing leave dialog fields and preferences untouched',await evaluate(`$('#grid-dialog').open && $('#grid-columns').value==='9'`) && await evaluate("localStorage.getItem('samestate.grid')")===gridBefore);
  await evaluate("$('#grid-dialog').close();$('#tests-drawer').open=true;$('#test-ai').open=true;$('#ai-key').value='SECRET_HELP_KEY_847';$('#test-plan').value='PRIVATE_PLAN_847';samestateFeatureHelp.show($('#test-plan'),true)");
  record('Sensitive field values never enter tooltip text or narration metadata',await evaluate(`!JSON.stringify(samestateFeatureHelp.catalog()).includes('SECRET_HELP_KEY_847') && !$('#feature-help').textContent.includes('SECRET_HELP_KEY_847') && !JSON.stringify(samestateFeatureHelpNarration).includes('PRIVATE_PLAN_847') && samestateFeatureHelp.resolve($('#ai-key')).key==='#ai-key' && samestateFeatureHelp.get().key==='#test-plan'`));
  await evaluate(`samestateFeatureHelp.close();openDebugMenu('all',$('#debug-all'))`);
  audit=await evaluate(AUDIT);record('Every debug overlay, simulator and action has help',audit.missing.length===0,audit.missing.join(', '));
  await evaluate(`closeDebugMenu(false);$('#workspaces-drawer').open=true;$('#workspace-name').value='PRIVATE_WORKSPACE_847';$('#workspace-form').requestSubmit();samestateTest.load({samestate:'test',version:1,site:'demo:index.html',steps:[{do:'expect',text:'PRIVATE_ASSERTION_847'}]});dev('iphone').annotations.note({x:.1,y:.1},'PRIVATE_NOTE_847')`);
  await until("$('.workspace') && $('.test-step-remove') && $('.preview-note')");
  audit=await evaluate(AUDIT);record('Saved workspaces, test-step actions and annotations have help',audit.missing.length===0,audit.missing.join(', '));
  record('Dynamic private names use generic help descriptions',await evaluate(`['.workspace-delete','.test-step-remove','.preview-note'].every(s=>{const e=samestateFeatureHelp.resolve($(s));return e&&!JSON.stringify(e).includes('PRIVATE_')})`));
  await evaluate("detect(true)");await evaluate('saveBaseline();readMeta()');
  audit=await evaluate(AUDIT);record('Findings, fixes, baselines, exports and social previews have help',audit.missing.length===0,audit.missing.join(', '));
  await evaluate('samestateOutline.open()');await until('!!samestateOutline.get().data');await evaluate("$('#outline-list button').click()");await until('!!samestateOutline.get().measurement');
  audit=await evaluate(AUDIT);record('Outline items, measurements and guidance links have help',audit.missing.length===0,audit.missing.join(', '));
  await evaluate(`for(const el of $('#checks-groups').querySelectorAll('input'))el.checked=['meta','capture'].includes(el.value);$('#checks-groups').dispatchEvent(new Event('change',{bubbles:true}));$('#checks-run').click()`);await until('!samestateChecks.running && !!samestateChecks.get()?.finishedAt');
  audit=await evaluate(AUDIT);record('Combined results and all human review actions have help',audit.missing.length===0,audit.missing.join(', '));
  await evaluate('setSitesMode(true)');await until('sitePanels.length>0');audit=await evaluate(AUDIT);record('Comparison addresses, viewport selectors and column actions have help',audit.missing.length===0,audit.missing.join(', '));
  await evaluate(`setSitesMode(false);samestateFeatureHelp.show($('#search-tools'),true)`);
  let layouts=0;for(const theme of ['samestate','neutral','clay','teal','hive','clean'])for(const mode of ['dark','light']){
   await evaluate(`uiTheme.preview('${theme}','${mode}');document.fonts.ready`);
   for(const width of [320,480,800,1600]){
    await page.send('Emulation.setDeviceMetricsOverride',{width,height:920,deviceScaleFactor:1,mobile:false});await sleep(60);
    const fits=await evaluate(`(()=>{const r=$('#feature-help').getBoundingClientRect();return r.width>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&$('#feature-help').scrollWidth<=$('#feature-help').clientWidth})()`);if(!fits)throw Error('Tooltip overflow: '+theme+' '+mode+' '+width);layouts++;
   }
  }record('Tooltip text and voice controls fit across themes and window widths',layouts===48,`${layouts} layouts`);
  await evaluate('samestateFeatureHelp.open()');let browserLayouts=0;
  for(const width of [320,480,800,1600]){
   await page.send('Emulation.setDeviceMetricsOverride',{width,height:740,deviceScaleFactor:1,mobile:false});await sleep(80);
   record('Help browser fits '+width+'px',await evaluate(`(()=>{const p=$('#feature-help'),r=p.getBoundingClientRect();return samestateFeatureHelp.get().browsing&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&p.scrollWidth<=p.clientWidth})()`));browserLayouts++;
  }
  await evaluate(`uiTheme.preview('samestate','dark');samestateFeatureHelp.close()`);await page.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate('startTour();true');await until("tourRunning && tourPhase==='waiting'");await click('#tour-mute');await until("!$('#tour-audio').paused && $('#tour-audio').currentTime>.1");await evaluate("samestateFeatureHelp.show($('#search-tools'),true)");await click('#feature-help-hear');await until('samestateFeatureHelp.get().playing && tourPaused && Number.isFinite($("#feature-help-audio").duration) && !$("#feature-help-audio").paused');
  record('Help narration pauses the demo to avoid competing voices',await evaluate(`$('#tour-audio').paused && samestateFeatureHelp.get().pausedDemo`));
  await evaluate("$('#feature-help-audio').currentTime=$('#feature-help-audio').duration-.2");await until("!samestateFeatureHelp.get().playing && !tourPaused && !$('#tour-audio').paused");record('Finishing help resumes the previously running demo',true);
  await evaluate("samestateFeatureHelp.show($('#search-tools'),true)");await click('#feature-help-hear');await until('samestateFeatureHelp.get().playing && tourPaused');await click('#tourpause');
  record('The demo Resume button stops help and resumes only once',await evaluate('!samestateFeatureHelp.get().playing && !tourPaused'));
  await evaluate("setTourPaused(true);samestateFeatureHelp.show($('#tour-mute'),true)");await click('#feature-help-hear');await until('samestateFeatureHelp.get().playing');await click('#feature-help-close');record('A deliberately paused demo stays paused after help closes',await evaluate('tourPaused'));
  await evaluate("samestateFeatureHelp.show($('#search-tools'),true)");await click('#feature-help-hear');await until('samestateFeatureHelp.get().playing');await evaluate('endTour(false)');await until('!samestateTourFeatures.active');record('Ending the demo stops help without restarting it',await evaluate('!samestateFeatureHelp.get().playing && !tourRunning'));
  await evaluate("samestateFeatureHelp.show($('#search-tools'),true)");await click('#feature-help-hear');await until('samestateFeatureHelp.get().playing');await evaluate("$('#feature-help-audio').src='help/narration/missing.mp3';$('#feature-help-audio').load();true");await until('!samestateFeatureHelp.get().playing');
  record('A missing voice clip recovers to a usable Hear control',await evaluate("$('#feature-help-hear span').textContent==='Hear explanation' && !$('#feature-help-hear').disabled"));
  await click('#feature-help-hear');await until("!$('#feature-help-audio').paused && $('#feature-help-audio').currentTime>.1");record('Voice retry replays the correct explanation',true);await evaluate('samestateFeatureHelp.close()');
  await click('#feature-help-open');await until('samestateFeatureHelp.get().browsing');await click('#feature-help-open');
  record('Pressing the top-bar icon again closes help',await evaluate("!samestateFeatureHelp.get().open && $('#feature-help-open').getAttribute('aria-expanded')==='false'"));
  await click('#feature-help-open');await evaluate(`$('#feature-help-search').value='Feature help';$('#feature-help-search').dispatchEvent(new Event('input',{bubbles:true}))`);await click('#feature-help-results [data-help-key="#feature-help-open"]');await click('#feature-help-hear');await until('samestateFeatureHelp.get().playing');
  record('The new help icon has its own natural voice explanation',true);
  await evaluate(`$('#feature-help-search').value='metadata';$('#feature-help-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  record('A new help search stops the previous voice',await evaluate('!samestateFeatureHelp.get().playing && !samestateFeatureHelp.get().key && $("#feature-help-hear").disabled'));
  await key('Escape');await click('#search-tools');await until("$('#command-bar').open");record('Normal controls still run their usual action',true);await key('Escape');
  await evaluate('samestateFeatureHelp.close()');await sleep(750);
  if(process.env.HELP_SCREENSHOT){await evaluate(`samestateFeatureHelp.open();$('#feature-help-search').value='measure';$('#feature-help-search').dispatchEvent(new Event('input',{bubbles:true}));$('#feature-help-results [data-help-key="#open-outline"]').click()`);await sleep(150);const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(process.env.HELP_SCREENSHOT,Buffer.from(shot.data,'base64'));}
  record('No page errors',errors.length===0,errors.join('; '));
  const failed=results.filter(r=>!r.ok);console.log(`\n${results.length-failed.length}/${results.length} voiced help checks passed`);if(failed.length)process.exitCode=1;
 }finally{page?.ws.close();chrome.kill();server.closeAllConnections();server.close();await sleep(300);rmSync(profile,{recursive:true,force:true});}
}
main().then(()=>process.exit(process.exitCode||0)).catch(e=>{console.error(e);process.exit(1)});
