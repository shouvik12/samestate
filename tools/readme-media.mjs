// Refresh GitHub's native app screenshots, banner, card and animated showcase.
// Build the narrated promo with promo/record.mjs first, then node tools/readme-media.mjs.
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {openMediaBrowser,ROOT,FFMPEG,wait} from './media-browser.mjs';

const out=join(ROOT,'docs/media'),video=join(ROOT,'promo/out/samestate-promo-landscape.mp4');
if(!existsSync(video))throw Error('Run node promo/record.mjs landscape first.');
const browser=await openMediaBrowser();
try{
 if(!process.argv.includes('--banner-only')){
 await browser.load();
 for(const scene of ['sync','report','measure','meta','checks','help','tour','capture','theme']){
  const state=await browser.evaluate(`promo.prepare(${JSON.stringify(scene)})`);
  if(['sync','measure','checks','help','tour'].includes(scene))await browser.evaluate(`promo.act(${JSON.stringify(scene)})`);
  if(scene==='tour'){await wait(800);await browser.evaluate('setTourPaused(true)');}
  await wait(250);await browser.shot(join(out,`screenshot-${scene==='help'?'voice-help':scene}.png`));
  console.log(scene,JSON.stringify(state));
 }}
 // Compose brand text around the real app capture, then capture it directly in Chrome.
 const origin=browser.baseUrl;
 for(const [file,width,height] of [['samestate-banner.png',1280,640],['card.png',1200,675]]){
  await browser.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await browser.send('Page.navigate',{url:origin+'/promo/banner.html'});
  await browser.until('window.bannerReady===true');await wait(250);await browser.shot(join(out,file));
 }
 if(browser.errors.length)throw Error(browser.errors.join('\n'));
}finally{await browser.close();}
// The narrated app walkthrough stays as samestate-demo.mp4 (and the GIF). The README's 30s video is the motion promo
// from promo/record-motion.mjs, copied when it has been rendered.
copyFileSync(video,join(out,'samestate-demo.mp4'));
for(const [from,file] of [['samestate-motion.mp4','samestate-promo.mp4'],['samestate-motion-portrait.mp4','samestate-promo-mobile.mp4']])if(existsSync(join(ROOT,'promo/out',from)))copyFileSync(join(ROOT,'promo/out',from),join(out,file));
execFileSync(FFMPEG,['-y','-loglevel','error','-i',video,'-filter_complex','[0:v]setpts=0.5*PTS,fps=8,scale=960:540:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-an','-loop','0',join(out,'samestate-demo.gif')]);
console.log('Updated banner, link card, nine screenshots, 15s GIF, walkthrough video and the motion promo videos.');
