// Builds the Chrome Web Store images in store/images/ from the README media and the motion promo's end card.
// Run node tools/readme-media.mjs first (screenshots), then: node tools/store-assets.mjs. Needs ffmpeg and Chrome.
import {execFileSync} from 'node:child_process';
import {mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT,FFMPEG} from './media-browser.mjs';

const media=join(ROOT,'docs/media'),out=join(ROOT,'store/images');
mkdirSync(out,{recursive:true});
const ff=(...args)=>execFileSync(FFMPEG,['-y','-loglevel','error',...args]);

// Screenshots: the store takes 1280×800. The app screenshots are 16:9, so they are scaled to 1280 wide and centred on the app's background.
for(const [n,name] of [[1,'sync'],[2,'report'],[3,'checks'],[4,'measure'],[5,'tour']]){
 const source=join(media,`screenshot-${name}.png`);
 if(!existsSync(source))throw Error('Missing '+source+'. Run node tools/readme-media.mjs first.');
 ff('-i',source,'-vf','scale=1280:720:flags=lanczos,pad=1280:800:0:40:color=0x18181b','-frames:v','1',join(out,`screenshot-${n}-${name}.png`));
}

// Promo tiles from the motion promo's end card (frame 885 of 900).
execFileSync(process.execPath,[join(ROOT,'promo/record-motion.mjs'),'--frames','885'],{stdio:'ignore'});
const card=join(ROOT,'promo/out/motion-frames/still-0885.png');
ff('-i',card,'-vf','crop=1414:900:93:0,scale=440:280:flags=lanczos','-frames:v','1',join(out,'promo-small-440x280.png'));
ff('-i',card,'-vf','crop=1600:640:0:130,scale=1400:560:flags=lanczos','-frames:v','1',join(out,'promo-marquee-1400x560.png'));
console.log('Wrote 5 screenshots and 2 promo tiles to store/images/.');
