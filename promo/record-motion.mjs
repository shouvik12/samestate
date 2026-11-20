// Render promo/motion.html frame by frame (30 fps) and mix it with the beat-timed soundtrack.
// Build promo/out/motion-soundtrack.wav first: python promo/voiceover.py --story promo/motion.json --model ... --voices ...
// node promo/record-motion.mjs [portrait] [--story promo/tutorial.json] [--frames 0,90,450] → promo/out/<output>.mp4 (or stills)
// The story names its page (default motion.html), soundtrack and output name (default samestate-motion).
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {openMediaBrowser,ROOT,FFMPEG,wait} from '../tools/media-browser.mjs';

const FPS=30,PORTRAIT=process.argv.includes('portrait'),[width,height]=PORTRAIT?[1080,1920]:[1600,900];
const arg=name=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:null;
const story=JSON.parse(readFileSync(join(ROOT,arg('--story')||'promo/motion.json'),'utf8'));
const name=story.output||'samestate-motion';
const out=join(ROOT,'promo/out'),dir=join(out,`${name}-frames${PORTRAIT?'-portrait':''}`),soundtrack=join(out,story.soundtrack);
const only=arg('--frames')?arg('--frames').split(',').map(Number):null;
if(!only&&!existsSync(soundtrack))throw Error('Build '+story.soundtrack+' with promo/voiceover.py --story <story file> first.');
rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});
const browser=await openMediaBrowser(width,height);
try{
 await browser.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await browser.send('Page.navigate',{url:browser.baseUrl+'/promo/'+(story.page||'motion.html')+(PORTRAIT?'?portrait':'')});
 await browser.until('!!window.render && !!window.ready');await browser.evaluate('window.ready');await wait(300);
 const frames=only||[...Array(Math.round(story.duration*FPS)).keys()];
 for(const f of frames){
  await browser.evaluate(`render(${f/FPS})`);
  const {data}=await browser.send('Page.captureScreenshot',{format:only?'png':'jpeg',quality:only?undefined:94});
  writeFileSync(join(dir,only?`still-${String(f).padStart(4,'0')}.png`:`f${String(f).padStart(5,'0')}.jpg`),Buffer.from(data,'base64'));
  if(f%150===0)console.log('frame',f);
 }
 if(browser.errors.length)throw Error(browser.errors.join('\n'));
 if(!only){
  const video=join(out,`${name}${PORTRAIT?'-portrait':''}.mp4`);
  execFileSync(FFMPEG,['-y','-loglevel','error','-framerate',String(FPS),'-i',join(dir,'f%05d.jpg'),'-i',soundtrack,'-c:v','libx264','-preset','slow','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-t',String(story.duration),'-movflags','+faststart',video]);
  rmSync(dir,{recursive:true,force:true});
  console.log('Wrote',video);
 }else console.log('Wrote stills to',dir);
}finally{await browser.close();}
