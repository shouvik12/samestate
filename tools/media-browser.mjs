// Shared capture harness for real app screenshots and showcase recordings. Node 22, Chrome and ffmpeg only.
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,readFileSync,statSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
export const FFMPEG=process.env.FFMPEG||['/opt/homebrew/bin/ffmpeg','/usr/local/bin/ffmpeg'].find(existsSync)||'ffmpeg';
export const wait=ms=>new Promise(done=>setTimeout(done,ms));
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.gif':'image/gif','.mp3':'audio/mpeg','.webm':'video/webm','.mp4':'video/mp4','.json':'application/json','.woff2':'font/woff2'};

export async function openMediaBrowser(width=1600,height=900){
 const server=createServer((req,res)=>{
  let path=decodeURIComponent(new URL(req.url,'http://x').pathname);if(path.endsWith('/'))path+='index.html';
  const file=resolve(ROOT,'.'+path);
  if(!file.startsWith(ROOT+sep)){res.writeHead(403).end();return;}
  try{if(!statSync(file).isFile())throw Error();res.writeHead(200,{'content-type':TYPES[extname(file)]||'application/octet-stream'}).end(readFileSync(file));}catch{res.writeHead(404).end();}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const profile=mkdtempSync(join(tmpdir(),'samestate-media-'));
 const chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--mute-audio','--no-first-run','--no-default-browser-check',`--window-size=${width},${height}`,'--autoplay-policy=no-user-gesture-required','--hide-scrollbars','--force-device-scale-factor=1','about:blank'],{stdio:['ignore','ignore','pipe']});
 const port=await new Promise((done,fail)=>{let log='';const timer=setTimeout(()=>fail(Error('Chrome did not start: '+log)),30000);chrome.stderr.on('data',c=>{log+=c;const m=log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);if(m){clearTimeout(timer);done(m[1]);}});chrome.on('error',fail);});
 const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((done,fail)=>{ws.onopen=done;ws.onerror=fail;});
 let next=0,frames=null;const pending=new Map(),errors=[];
 const send=(method,params={})=>{const id=++next;ws.send(JSON.stringify({id,method,params}));return new Promise((done,fail)=>pending.set(id,{done,fail}));};
 ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.fail(Error(m.error.message)):p.done(m.result);return;}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Page.screencastFrame'){frames?.push({data:m.params.data,at:m.params.metadata.timestamp});send('Page.screencastFrameAck',{sessionId:m.params.sessionId});}};
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const until=async(expression,timeout=20000)=>{for(let t=0;t<timeout;t+=100){if(errors.length)throw Error(errors.join('; '));if(await evaluate(expression).catch(()=>false))return;await wait(100);}throw Error('Timed out: '+expression);};
 const close=async()=>{ws.close();chrome.kill();server.closeAllConnections();server.close();await wait(250);rmSync(profile,{recursive:true,force:true});};
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('samestate.tourMuted','true')}catch{}"});
 const load=async(w=width,h=height)=>{
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/docs/index.html?media=20261119`});
  await until('!!window.samestateFeatureHelp && tourRunning && active().length && active().every(d=>d.ready)');
  await evaluate('endTour(false)');await until('!samestateTourFeatures.active');
  await evaluate("uiTheme.preview('samestate','dark')");
  await evaluate(readFileSync(join(ROOT,'promo/stage.js'),'utf8'));
 };
 const shot=async path=>{mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));};
 const record=async(scene,seconds,path)=>{
  frames=[];await send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:width,maxHeight:height,everyNthFrame:1});await wait(100);
  const start=Date.now()/1000;const action=evaluate(`promo.act(${JSON.stringify(scene)})`);await wait(seconds*1000);await action;
  await send('Page.stopScreencast');const end=start+seconds;
  const before=frames.filter(f=>f.at<=start).at(-1);const shown=[...(before?[{...before,at:start}]:[]),...frames.filter(f=>f.at>start&&f.at<end)];frames=null;
  if(!shown.length)throw Error('No frames for '+scene);
  const dir=mkdtempSync(join(tmpdir(),'samestate-scene-'));let list='';
  for(let i=0;i<shown.length;i++){const name=`frame${String(i).padStart(5,'0')}.jpg`;writeFileSync(join(dir,name),Buffer.from(shown[i].data,'base64'));list+=`file '${name}'\nduration ${Math.max(.001,(shown[i+1]?.at??end)-shown[i].at).toFixed(5)}\n`;}
  list+=`file 'frame${String(shown.length-1).padStart(5,'0')}.jpg'\n`;writeFileSync(join(dir,'frames.txt'),list);
  execFileSync(FFMPEG,['-y','-loglevel','error','-f','concat','-safe','0','-i',join(dir,'frames.txt'),'-vf',`fps=30,scale=${width}:${height},format=yuv420p`,'-t',String(seconds),'-c:v','libx264','-preset','fast','-crf','19','-an',path]);
  rmSync(dir,{recursive:true,force:true});return {scene,frames:shown.length,seconds};
 };
 return {send,evaluate,until,close,load,shot,record,errors,baseUrl:`http://127.0.0.1:${server.address().port}`};
}
