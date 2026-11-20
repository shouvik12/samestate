// Drives the real Samestate extension in a hidden Chrome, so every report comes from the same code as the app.
// Chrome is started with a pipe for the DevTools protocol, the extension in ../extension is loaded unpacked
// (with access to http and https sites granted up front, since nobody is there to answer Chrome's prompt),
// and the app page is opened with ?open=<url>, the same path the toolbar button uses.
import {spawn} from 'node:child_process';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

export const EXTENSION=resolve(dirname(fileURLToPath(import.meta.url)),'../extension');

// Runs inside a screen's page: turns Samestate's element paths (child positions from <body>, "2.1.3") into short CSS
// selectors that match one element, so an assistant can find the element in the source. Ids and class names that look
// generated (long digit runs, CSS-in-JS prefixes) are skipped.
const SELECTORS=`paths=>{
 const at=path=>{let el=document.body;if(!path)return el;for(const n of path.split('.')){el=el&&el.children[Number(n)-1];if(!el)return null;}return el;};
 const matchesOnly=(sel,el)=>{
  try{
   const matches=document.querySelectorAll(sel);
   return matches.length===1&&matches[0]===el;
  }catch{return false;}
 };
 const generated=name=>/\\d{3,}|^(css|sc|jsx|svelte|emotion|tw)-|^[a-z]{1,3}[A-Z0-9][a-zA-Z0-9]{4,}$/.test(name);
 const part=el=>{
  if(el.id&&!generated(el.id)&&matchesOnly('#'+CSS.escape(el.id),el))return '#'+CSS.escape(el.id);
  let sel=CSS.escape(el.localName)+[...el.classList].filter(c=>!generated(c)).slice(0,2).map(c=>'.'+CSS.escape(c)).join('');
  const parent=el.parentElement;
  if(parent){const same=[...parent.children].filter(x=>x.localName===el.localName&&x.namespaceURI===el.namespaceURI);if(same.length>1)sel+=':nth-of-type('+(same.indexOf(el)+1)+')';}
  return sel;
 };
 const selectorFor=(el,path)=>{
  let sel='';
  for(let node=el;node;node=node.parentElement){
   const p=part(node);sel=sel?p+' > '+sel:p;
   if(matchesOnly(sel,el))return sel;
   if(node===document.body)break;
  }
  // Fall back to exact child positions, independent of classes, namespaces and ids.
  const bodyIndex=[...document.documentElement.children].indexOf(document.body)+1;
  const positions=path?[bodyIndex,...path.split('.')]:[bodyIndex];
  const fallback=':root'+positions.map(position=>' > :nth-child('+position+')').join('');
  return matchesOnly(fallback,el)?fallback:null;
 };
 return Object.fromEntries(paths.map(path=>{
  const el=at(path);
  return [path,el?selectorFor(el,path):null];
 }));
}`;

const CHROME_PATHS={
 darwin:['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing','/Applications/Chromium.app/Contents/MacOS/Chromium'],
 linux:['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser','/snap/bin/chromium'],
 win32:[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean).map(base=>join(base,'Google/Chrome/Application/chrome.exe'))
};
export function findChrome(){
 const found=[process.env.CHROME_PATH,...(CHROME_PATHS[process.platform]||[])].find(path=>path&&existsSync(path));
 if(!found)throw Error('Chrome was not found. Install Google Chrome, or set CHROME_PATH to its executable.');
 return found;
}

export class Samestate{
 constructor({log=()=>{}}={}){this.log=log;this.queue=Promise.resolve();}
 // One tool call at a time: they share one app tab.
 run(task,signal){
  const next=this.queue.then(async()=>{
   signal?.throwIfAborted();
   this.signal=signal;
   let stopping;
   const abort=()=>{
    // Page-side checks can keep running after a DevTools request is abandoned.
    // Stop the private browser before letting another call use it.
    stopping=this.close().catch(error=>this.log('Chrome cleanup failed: '+error.message));
   };
   signal?.addEventListener('abort',abort,{once:true});
   try{
    const result=await task();
    signal?.throwIfAborted();
    return result;
   }finally{
    signal?.removeEventListener('abort',abort);
    this.signal=undefined;
    if(stopping)await stopping;
   }
  });
  this.queue=next.catch(()=>{});
  return next;
 }

 wait(ms){return delay(ms,undefined,{signal:this.signal});}

 async start(){
  if(this.session)return;
  await this.close();
  this.signal?.throwIfAborted();
  const executable=findChrome();
  this.temp=mkdtempSync(join(tmpdir(),'samestate-mcp-'));
  const ext=join(this.temp,'extension');cpSync(EXTENSION,ext,{recursive:true});
  const manifest=JSON.parse(readFileSync(join(ext,'manifest.json'),'utf8'));
  manifest.host_permissions=manifest.optional_host_permissions||['http://*/*','https://*/*'];delete manifest.optional_host_permissions;
  writeFileSync(join(ext,'manifest.json'),JSON.stringify(manifest));
  const chrome=this.chrome=spawn(executable,['--headless=new','--remote-debugging-pipe','--enable-unsafe-extension-debugging',`--user-data-dir=${join(this.temp,'profile')}`,'--no-first-run','--no-default-browser-check','--mute-audio','--hide-scrollbars','--window-size=4000,2400','about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe']});
  chrome.stderr.on('data',()=>{});
  let buffer='',next=0;const pending=new Map();this.events=[];
  let disconnected;
  const disconnect=error=>{
   disconnected=error;
   this.session=null;
   for(const {fail} of pending.values())fail(error);
   pending.clear();
  };
  chrome.on('error',disconnect);
  chrome.once('exit',()=>disconnect(disconnected||Error('Chrome closed')));
  chrome.stdio[3].on('error',disconnect);
  chrome.stdio[4].on('error',disconnect);
  this.chromeClosed=new Promise(done=>chrome.once('close',()=>{
   disconnect(disconnected||Error('Chrome closed'));
   this.chrome=null;
   done();
  }));
  chrome.stdio[4].on('data',chunk=>{
   buffer+=chunk;let end;
   while((end=buffer.indexOf('\0'))>=0){
    const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);
    if(message.id&&pending.has(message.id)){const {done,fail}=pending.get(message.id);pending.delete(message.id);message.error?fail(Error(message.error.message)):done(message.result);}
    else if(message.method)for(const listener of this.events)listener(message);
   }
  });
  this.send=async(method,params={},sessionId)=>{
   this.signal?.throwIfAborted();
   if(disconnected)throw disconnected;
   return new Promise((done,fail)=>{
    const id=++next;
    pending.set(id,{done,fail});
    chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');
   });
  };
  // Each screen's page runs in its own frame process; its DevTools session is kept by frame id to read element selectors.
  this.frames=new Map();
  this.events.push(message=>{
   if(message.method==='Target.attachedToTarget'&&message.params.targetInfo.type==='iframe')this.frames.set(message.params.targetInfo.targetId,message.params.sessionId);
   if(message.method==='Target.detachedFromTarget')for(const [frame,session] of this.frames)if(session===message.params.sessionId)this.frames.delete(frame);
  });
  const {id}=await this.send('Extensions.loadUnpacked',{path:ext});
  this.base=`chrome-extension://${id}/app.html`;
  const {targetId}=await this.send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await this.send('Target.attachToTarget',{targetId,flatten:true});
  await this.send('Emulation.setDeviceMetricsOverride',{width:4000,height:2400,deviceScaleFactor:1,mobile:false},sessionId);
  await this.send('Runtime.enable',{},sessionId);
  await this.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true},sessionId);
  this.session=sessionId;
  this.log('Chrome ready with the Samestate extension '+manifest.version);
 }

 async evaluate(expression){
  const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},this.session);
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
 }
 async until(expression,timeout,step=250){
  const end=Date.now()+timeout;
  while(Date.now()<end){
   try{if(await this.evaluate(expression))return true;}
   catch(error){if(this.signal?.aborted||!this.session)throw error;}
   await this.wait(step);
  }
  return false;
 }

 // Opens url on the chosen screens (ids from listDevices) and waits until each has loaded and connected.
 async open(url,{devices,reference}={}){
  await this.start();
  let parsed;try{parsed=new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(url)?url:(/^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url)?'http://':'https://')+url);}catch{throw Error('Not a valid address: '+url);}
  if(!/^https?:$/.test(parsed.protocol))throw Error('Only http and https addresses can be opened.');
  await this.send('Page.navigate',{url:this.base+'?open='+encodeURIComponent(parsed.href)},this.session);
  if(!await this.until("document.readyState==='complete'&&typeof active==='function'&&!!target",20000)){
   const why=await this.evaluate("document.querySelector('#joblog')?.textContent||''").catch(()=>'');
   throw Error('Samestate could not open '+parsed.href+(why?': '+why:''));
  }
  const known=await this.evaluate('DEVICES.map(d=>d.id)');
  if(devices?.length){
   const unknown=devices.filter(id=>!known.includes(id));
   if(unknown.length)throw Error(`Unknown device id: ${unknown.join(', ')}. Use list_devices to see the ids.`);
   await this.evaluate(`(()=>{const want=new Set(${JSON.stringify(devices)});for(const d of DEVICES)if(!!d.on!==want.has(d.id))selectDevice(d,want.has(d.id));})()`);
  }
  if(reference){
   if(!await this.evaluate(`active().some(d=>d.id===${JSON.stringify(reference)})`))throw Error(`The reference screen ${reference} is not one of the screens opened.`);
   await this.evaluate(`(()=>{const ref=document.querySelector('#ref');ref.value=${JSON.stringify(reference)};ref.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  await this.until('active().length&&active().every(d=>d.ready)',30000,400);
  await this.wait(1200); // the page's own resize and font loading settle, as in the app's delayed first scan
  return this.evaluate(`({url:previewUrl,reference:document.querySelector('#ref').value,screens:active().map(d=>({id:d.id,name:screenName(d),width:d.w,height:d.h,ready:!!d.ready}))})`);
 }

 // Element paths on one screen → CSS selectors, read inside that screen's frame. Empty when the frame can't be reached.
 async selectors(deviceId,paths){
  if(!paths.length)return {};
  try{
   const {result}=await this.send('Runtime.evaluate',{expression:`active().find(d=>d.id===${JSON.stringify(deviceId)})?.iframe`},this.session);
   if(!result?.objectId)return {};
   const {node}=await this.send('DOM.describeNode',{objectId:result.objectId},this.session);
   const frame=this.frames.get(node.frameId);
   if(!frame)return {};
   const reply=await this.send('Runtime.evaluate',{expression:`(${SELECTORS})(${JSON.stringify(paths)})`,returnByValue:true},frame);
   return reply.result?.value||{};
  }catch(error){
   if(this.signal?.aborted||!this.session)throw error;
   this.log('Selectors unavailable on '+deviceId+': '+error.message);
   return {};
  }
 }

 listDevices(signal){return this.run(async()=>{
  await this.start();
  if(!await this.evaluate("typeof DEVICES!=='undefined'").catch(()=>false)){await this.send('Page.navigate',{url:this.base},this.session);await this.until("typeof DEVICES!=='undefined'",15000);}
  return this.evaluate("DEVICES.map(d=>({id:d.id,name:d.name,width:d.w,height:d.h,kind:d.kind,group:DEVICE_GROUPS[d.group]||d.group,default:!!d.starter}))");
 },signal);}

 differences(url,options={}){return this.run(async()=>{
  const opened=await this.open(url,options);
  if(options.links)await this.evaluate("document.querySelector('#check-links').checked=true");
  // detect() is the app's own report; its snapshots are kept on the way through, for the element paths they carry.
  await this.evaluate(`(()=>{if(!window.mcpAnalyze){window.mcpAnalyze=analyze;analyze=(snaps,ref)=>{window.mcpSnaps=snaps;return mcpAnalyze(snaps,ref);};}window.mcpSnaps=[];})()`);
  await this.evaluate('detect(true)');
  const report=await this.evaluate(`(()=>{
   const fixCss=k=>FIX_CSS[k]?Object.entries(FIX_CSS[k]).map(([p,v])=>p+': '+v+';').join(' '):null;
   const advice=k=>(FIX_ADVICE.find(([start])=>k.startsWith(start))||[])[1]||null;
   return {keyPaths:Object.fromEntries((window.mcpSnaps||[]).map(s=>[s.dev.id,s.data.keyPaths||{}])),findings:findings.map(f=>({severity:{issue:'issue',warn:'warning',info:'adaptation'}[f.sev]||f.sev,category:f.cat,kind:f.kind,screen:screenName(f.dev),device:f.dev.id,keys:f.keys||[],title:f.title,detail:f.detail,fixCss:fixCss(f.kind),advice:advice(f.kind)})),
    unmeasured:(lastScan?.missing||[]).map(screenName)};
  })()`);
  // Keys are "category|path", or numbered ("ov|0") with the path in that screen's keyPaths.
  const pathOf=(device,key)=>{const known=report.keyPaths[device]?.[key];if(known!==undefined)return known;const path=String(key).slice(String(key).indexOf('|')+1);return /^(\d+(\.\d+)*)?$/.test(path)?path:null;};
  const byDevice=new Map();
  for(const f of report.findings)for(const key of f.keys){const path=pathOf(f.device,key);if(path!==null){if(!byDevice.has(f.device))byDevice.set(f.device,new Set());byDevice.get(f.device).add(path);}}
  const resolved=new Map();
  for(const [device,paths] of byDevice)resolved.set(device,await this.selectors(device,[...paths]));
  for(const f of report.findings){
   const map=resolved.get(f.device)||{};
   f.elements=[...new Set(f.keys.map(key=>pathOf(f.device,key)).filter(p=>p!==null).map(p=>map[p]).filter(Boolean))];
   delete f.keys;
  }
  delete report.keyPaths;
  return {...opened,...report};
 },options.signal);}

 checks(url,options={}){return this.run(async()=>{
  const opened=await this.open(url,options);
  const groups=options.groups?.length?options.groups:['layout','accessibility','meta','performance','links'];
  await this.evaluate(`(()=>{const want=new Set(${JSON.stringify(groups)});document.querySelectorAll('#checks-groups input').forEach(i=>{i.checked=want.has(i.value);i.dispatchEvent(new Event('change',{bubbles:true}));});document.querySelector('#checks-run').click();})()`);
  await this.wait(500);
  if(!await this.until('!samestateChecks.running&&!!samestateChecks.get()?.finishedAt',(groups.includes('widths')?420:150)*1000,1000))throw Error('The checks did not finish in time.');
  const report=await this.evaluate('samestateChecks.get()');
  if(!opened.screens.some(s=>s.ready))throw Error(`${opened.url} did not load on any screen within 30 seconds. Check that the address is right and its server is running.`);
  return {...opened,report};
 },options.signal);}

 screenshots(url,options={}){return this.run(async()=>{
  const opened=await this.open(url,options);
  if(!opened.screens.some(s=>s.ready))throw Error(`${opened.url} did not load on any screen within 30 seconds. Check that the address is right and its server is running.`);
  const shots=[];
  // The wall shows each screen scaled down (a desktop at about 30%), so each one is shown at 100% while it is captured.
  const order=options.devices||[];
  const screens=[...opened.screens].sort((a,b)=>(order.indexOf(a.id)+1||99)-(order.indexOf(b.id)+1||99));
  for(const screen of screens){
   if(!screen.ready)continue;
   const pick=`active().find(x=>x.id===${JSON.stringify(screen.id)})`;
   await this.evaluate(`(()=>{const d=${pick};d.mcpScale=d.scaleOverride;d.scaleOverride=1;layout(d);})()`);
   try{
    await this.wait(700); // the wall rearranges its screens around the larger one
    await this.evaluate(`${pick}.el.scrollIntoView({block:'start',inline:'start'})`);await this.wait(150);
    const rect=await this.evaluate(`(()=>{const r=${pick}.iframe.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height};})()`);
    const width=Math.min(options.width||screen.width,screen.width,900);
    const {data}=await this.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...rect,scale:width/rect.width}},this.session);
    shots.push({...screen,png:data});
   }finally{
    if(!this.signal?.aborted&&this.session)await this.evaluate(`(()=>{const d=${pick};d.scaleOverride=d.mcpScale??null;delete d.mcpScale;layout(d);})()`);
   }
  }
  return {...opened,shots};
 },options.signal);}

 close(){
  this.closing??=this.stopChrome().finally(()=>{this.closing=null;});
  return this.closing;
 }

 async stopChrome(){
  const chrome=this.chrome;
  if(chrome){
   chrome.kill();
   const force=setTimeout(()=>chrome.kill('SIGKILL'),2000);
   try{await this.chromeClosed;}finally{clearTimeout(force);}
  }
  if(this.temp){
   rmSync(this.temp,{recursive:true,force:true});
   this.temp=null;
  }
 }
}
