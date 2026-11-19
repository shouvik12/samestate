// Record the current app and its new features, with natural AI narration.
// Build promo/out/soundtrack.wav with voiceover.py first, then:
// node promo/record.mjs [landscape|portrait] → promo/out/samestate-promo-<format>.mp4
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {openMediaBrowser,ROOT,FFMPEG} from '../tools/media-browser.mjs';

const format=process.argv[2]||'landscape';
if(!['landscape','portrait'].includes(format))throw Error('Choose landscape or portrait.');
const [width,height]=format==='portrait'?[1080,1920]:[1600,900];
const story=JSON.parse(readFileSync(join(ROOT,'promo/showcase.json'),'utf8'));
const out=join(ROOT,'promo/out'),dir=join(out,`segments-${format}`),soundtrack=join(out,'soundtrack.wav');
if(!existsSync(soundtrack))throw Error('Build the narrated soundtrack with promo/voiceover.py first.');
mkdirSync(dir,{recursive:true});
const browser=await openMediaBrowser(width,height),evidence=[];
try{
 await browser.load();
 for(const scene of story.scenes){
  const ready=await browser.evaluate(`promo.prepare(${JSON.stringify(scene.id)},${JSON.stringify(scene.caption)},true)`);
  const clip=join(dir,`${scene.id}.mp4`);
  const result=await browser.record(scene.id,scene.duration,clip);
  if(scene.id==='measure')await browser.until('!!samestateOutline.get().measurement');
  if(scene.id==='checks')await browser.until('!!samestateChecks.get()?.finishedAt && samestateChecks.get().results.some(r=>r.manual && r.status==="review")');
  if(scene.id==='help')await browser.until('!document.querySelector("#feature-help").hidden');
  await browser.shot(join(out,`scene-${scene.id}.png`));
  evidence.push({...ready,...result});console.log(JSON.stringify(evidence.at(-1)));
 }
 if(browser.errors.length)throw Error(browser.errors.join('\n'));
 writeFileSync(join(dir,'clips.txt'),story.scenes.map(s=>`file '${s.id}.mp4'`).join('\n'));
 const silent=join(dir,'silent.mp4'),video=join(out,`samestate-promo-${format}.mp4`);
 execFileSync(FFMPEG,['-y','-loglevel','error','-f','concat','-safe','0','-i',join(dir,'clips.txt'),'-c','copy',silent]);
 execFileSync(FFMPEG,['-y','-loglevel','error','-i',silent,'-i',soundtrack,'-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t',String(story.duration),'-movflags','+faststart',video]);
 writeFileSync(join(out,`evidence-${format}.json`),JSON.stringify(evidence,null,2));
 console.log('Wrote',video);
}finally{await browser.close();rmSync(dir,{recursive:true,force:true});}
