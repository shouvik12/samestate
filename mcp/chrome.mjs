// Drives the real Samestate extension in a hidden Chrome, so every report comes from the same code as the app.
// Chrome is started with a pipe for the DevTools protocol, the extension in ../extension is loaded unpacked
// (with access to http and https sites granted up front, since nobody is there to answer Chrome's prompt),
// and the app page is opened with ?open=<url>, the same path the toolbar button uses.
import {spawn} from 'node:child_process';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const EXTENSION=resolve(dirname(fileURLToPath(import.meta.url)),'../extension');
const sleep=ms=>new Promise(done=>setTimeout(done,ms));

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
 run(task){const next=this.queue.then(task,task);this.queue=next.catch(()=>{});return next;}

 async start(){
  if(this.session)return;
  this.temp=mkdtempSync(join(tmpdir(),'samestate-mcp-'));
  const ext=join(this.temp,'extension');cpSync(EXTENSION,ext,{recursive:true});
  const manifest=JSON.parse(readFileSync(join(ext,'manifest.json'),'utf8'));
  manifest.host_permissions=manifest.optional_host_permissions||['http://*/*','https://*/*'];delete manifest.optional_host_permissions;
  writeFileSync(join(ext,'manifest.json'),JSON.stringify(manifest));
  const chrome=this.chrome=spawn(findChrome(),['--headless=new','--remote-debugging-pipe','--enable-unsafe-extension-debugging',`--user-data-dir=${join(this.temp,'profile')}`,'--no-first-run','--no-default-browser-check','--mute-audio','--hide-scrollbars','--window-size=4000,2400','about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe']});
  chrome.stderr.on('data',()=>{});
  let buffer='',next=0;const pending=new Map();this.events=[];
  chrome.stdio[4].on('data',chunk=>{
   buffer+=chunk;let end;
   while((end=buffer.indexOf('\0'))>=0){
    const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);
    if(message.id&&pending.has(message.id)){const {done,fail}=pending.get(message.id);pending.delete(message.id);message.error?fail(Error(message.error.message)):done(message.result);}
    else if(message.method)for(const listener of this.events)listener(message);
   }
  });
  chrome.on('exit',()=>{for(const {fail} of pending.values())fail(Error('Chrome closed'));pending.clear();this.session=null;});
  this.send=(method,params={},sessionId)=>new Promise((done,fail)=>{const id=++next;pending.set(id,{done,fail});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});
  const {id}=await this.send('Extensions.loadUnpacked',{path:ext});
  this.base=`chrome-extension://${id}/app.html`;
  const {targetId}=await this.send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await this.send('Target.attachToTarget',{targetId,flatten:true});
  this.session=sessionId;
  await this.send('Emulation.setDeviceMetricsOverride',{width:4000,height:2400,deviceScaleFactor:1,mobile:false},sessionId);
  await this.send('Runtime.enable',{},sessionId);
  this.log('Chrome ready with the Samestate extension '+manifest.version);
 }

 async evaluate(expression){
  const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},this.session);
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
 }
 async until(expression,timeout,step=250){
  const end=Date.now()+timeout;
  while(Date.now()<end){if(await this.evaluate(expression).catch(()=>false))return true;await sleep(step);}
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
  await sleep(1200); // the page's own resize and font loading settle, as in the app's delayed first scan
  return this.evaluate(`({url:previewUrl,reference:document.querySelector('#ref').value,screens:active().map(d=>({id:d.id,name:screenName(d),width:d.w,height:d.h,ready:!!d.ready}))})`);
 }

 listDevices(){return this.run(async()=>{
  await this.start();
  if(!await this.evaluate("typeof DEVICES!=='undefined'").catch(()=>false)){await this.send('Page.navigate',{url:this.base},this.session);await this.until("typeof DEVICES!=='undefined'",15000);}
  return this.evaluate("DEVICES.map(d=>({id:d.id,name:d.name,width:d.w,height:d.h,kind:d.kind,group:DEVICE_GROUPS[d.group]||d.group,default:!!d.starter}))");
 });}

 differences(url,options={}){return this.run(async()=>{
  const opened=await this.open(url,options);
  if(options.links)await this.evaluate("document.querySelector('#check-links').checked=true");
  await this.evaluate('detect(true)');
  const report=await this.evaluate(`(()=>{
   const fixCss=k=>FIX_CSS[k]?Object.entries(FIX_CSS[k]).map(([p,v])=>p+': '+v+';').join(' '):null;
   const advice=k=>(FIX_ADVICE.find(([start])=>k.startsWith(start))||[])[1]||null;
   return {findings:findings.map(f=>({severity:{issue:'issue',warn:'warning',info:'adaptation'}[f.sev]||f.sev,category:f.cat,kind:f.kind,screen:screenName(f.dev),title:f.title,detail:f.detail,fixCss:fixCss(f.kind),advice:advice(f.kind)})),
    unmeasured:(lastScan?.missing||[]).map(screenName)};
  })()`);
  return {...opened,...report};
 });}

 checks(url,options={}){return this.run(async()=>{
  const opened=await this.open(url,options);
  const groups=options.groups?.length?options.groups:['layout','accessibility','meta','performance','links'];
  await this.evaluate(`(()=>{const want=new Set(${JSON.stringify(groups)});document.querySelectorAll('#checks-groups input').forEach(i=>{i.checked=want.has(i.value);i.dispatchEvent(new Event('change',{bubbles:true}));});document.querySelector('#checks-run').click();})()`);
  await sleep(500);
  if(!await this.until('!samestateChecks.running&&!!samestateChecks.get()?.finishedAt',(groups.includes('widths')?420:150)*1000,1000))throw Error('The checks did not finish in time.');
  const report=await this.evaluate('samestateChecks.get()');
  if(!opened.screens.some(s=>s.ready))throw Error(`${opened.url} did not load on any screen within 30 seconds. Check that the address is right and its server is running.`);
  return {...opened,report};
 });}

 screenshots(url,options={}){return this.run(async()=>{
  const opened=await this.open(url,options);
  if(!opened.screens.some(s=>s.ready))throw Error(`${opened.url} did not load on any screen within 30 seconds. Check that the address is right and its server is running.`);
  const shots=[];
  // The wall shows each screen scaled down (a desktop at about 30%), so each one is shown at 100% while it is captured.
  for(const screen of opened.screens){
   if(!screen.ready)continue;
   const pick=`active().find(x=>x.id===${JSON.stringify(screen.id)})`;
   await this.evaluate(`(()=>{const d=${pick};d.mcpScale=d.scaleOverride;d.scaleOverride=1;layout(d);})()`);
   try{
    await sleep(700); // the wall rearranges its screens around the larger one
    await this.evaluate(`${pick}.el.scrollIntoView({block:'start',inline:'start'})`);await sleep(150);
    const rect=await this.evaluate(`(()=>{const r=${pick}.iframe.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height};})()`);
    const width=Math.min(options.width||screen.width,screen.width,900);
    const {data}=await this.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...rect,scale:width/rect.width}},this.session);
    shots.push({...screen,png:data});
   }finally{await this.evaluate(`(()=>{const d=${pick};d.scaleOverride=d.mcpScale??null;delete d.mcpScale;layout(d);})()`);}
  }
  return {...opened,shots};
 });}

 async close(){try{this.chrome?.kill();}catch{}await sleep(200);if(this.temp)rmSync(this.temp,{recursive:true,force:true});}
}
