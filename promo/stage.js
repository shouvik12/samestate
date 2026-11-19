/* Drives real app states for current README media. Presentation chrome is confined to capture sessions. */
(() => {
 'use strict';
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const device=id=>DEVICES.find(d=>d.id===id);
 const until=async(test,ms=20000)=>{for(let t=0;t<ms;t+=100){if(test())return;await wait(100);}throw Error('Media scene did not become ready.');};
 const style=document.createElement('style');
 style.textContent=`
  html{background:#18181b}.media-recording body{padding-top:64px}
  #media-caption{position:fixed;inset:0 0 auto;height:64px;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:0 28px;background:#111113;color:#fafafa;border-bottom:1px solid #3f3f46;z-index:4000;font:650 25px/1.2 system-ui;pointer-events:none}
  #media-caption[hidden],#media-card[hidden],#media-pointer[hidden]{display:none}
  .media-brand{display:inline-flex;align-items:center;gap:12px;font-weight:750;letter-spacing:-.04em}.media-logo{display:inline-flex;align-items:flex-end;gap:4px}.media-logo i{display:block;width:22px;height:27px;border:2px solid #6ea8ff;border-radius:4px}.media-logo i:nth-child(2){width:15px;height:37px;border-color:#5fe0a6}.media-logo i:nth-child(3){width:10px;height:23px;border-color:#ffc35a}
  #media-card{position:fixed;inset:0;z-index:5000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:radial-gradient(ellipse at 75% 20%,#27272a,transparent 65%),#09090b;color:#fafafa;text-align:center;font-family:system-ui;pointer-events:none}
  #media-card .media-brand{font-size:70px}#media-card h1{font-size:clamp(42px,5vw,78px);line-height:1.12;letter-spacing:-.045em;margin:10px 0}#media-card p{font-size:23px;color:#a1a1aa;margin:0}#media-card em{font-style:normal;color:#6ea8ff}#media-card .media-tags{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}#media-card .media-tags span{border:1px solid #3f3f46;background:#1c1c20;padding:9px 16px;border-radius:999px;font-size:17px;color:#d4d4d8}
  #media-pointer{position:fixed;left:0;top:0;width:24px;height:30px;z-index:4100;pointer-events:none;transition:transform .45s ease;filter:drop-shadow(0 3px 4px #0009)}
 `;
 document.head.append(style);
 const brand='<span class="media-brand"><span class="media-logo"><i></i><i></i><i></i></span>Samestate</span>';
 const caption=document.createElement('div');caption.id='media-caption';caption.hidden=true;caption.innerHTML=brand+'<span></span>';document.body.append(caption);
 const card=document.createElement('div');card.id='media-card';card.hidden=true;document.body.append(card);
 const pointer=document.createElement('div');pointer.id='media-pointer';pointer.hidden=true;pointer.innerHTML='<svg width="24" height="30" viewBox="0 0 24 30"><path d="M3 2 21 17H12L8 27z" fill="#fafafa" stroke="#18181b" stroke-width="2"/></svg>';document.body.append(pointer);
 function point(target){let r;if(Array.isArray(target)){const d=device(target[0]),f=d.iframe.getBoundingClientRect(),e=d.iframe.contentDocument.querySelector(target[1]).getBoundingClientRect(),k=f.width/d.iframe.offsetWidth;r={left:f.left+e.left*k,top:f.top+e.top*k,width:e.width*k,height:e.height*k};}else r=(typeof target==='string'?document.querySelector(target):target).getBoundingClientRect();pointer.hidden=false;pointer.style.transform=`translate(${r.left+r.width/2}px,${r.top+r.height/2}px)`;}
 async function fit(){for(let z=100;z>=24;z-=2){setZoom(z);await wait(15);if(cv.scrollWidth<=cv.clientWidth+1&&cv.scrollHeight<=cv.clientHeight+1)break;}cv.scrollTo(0,0);}
 async function base(ids=['iphone','ipad','desktop']){
  await endTour(false);window.samestateFeatureHelp.close(false);document.activeElement?.blur?.();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  setSitesMode(false);setPageSteps(false);undoAllFixes();wallDebug.tools.clear();wallDebug.sim='';clearThemePreset();
  for(const d of DEVICES){if(d.on!==ids.includes(d.id))selectDevice(d,ids.includes(d.id));d.scaleOverride=null;d.linked=true;d.design=null;d.outlineState=null;d.debug=new Set();d.sim='';}
  refreshDevicePicker();if(!$('#sidebar').hidden)$('#toggle-sidebar').click();$('#panel').hidden=true;catFilter=null;uiTheme.preview('samestate','dark');setMode(ids.length>3?'grid':'row');
  await open(DEMO_URL);await until(()=>active().length&&active().every(d=>d.ready&&d.iframe.contentDocument?.readyState==='complete'));
  for(const d of active())d.iframe.contentDocument.querySelector('#cookies')?.remove();
  await fit();await wait(200);
 }
 async function prepare(id,text='',recording=false){
  document.documentElement.classList.toggle('media-recording',recording);caption.hidden=!recording;caption.lastElementChild.textContent=text;card.hidden=true;pointer.hidden=true;
  if(id==='intro'||id==='outro'){
   await endTour(false);samestateFeatureHelp.close(false);for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
   card.innerHTML=brand+`<h1>${id==='intro'?'Every screen.<br><em>One shared state.</em>':'One interaction.<br><em>Every device.</em>'}</h1><div class="media-tags"><span>46 narrated steps</span><span>Measurements & checks</span><span>Voice help</span></div><p>shouvik12.github.io/samestate</p>`;card.hidden=false;return {id};
  }
  await base(['measure','meta','checks','report'].includes(id)?['iphone','desktop']:['iphone','ipad','desktop']);
  if(id==='measure'){
   await showTab('outline');await until(()=>!!samestateOutline.get().data);await fit();
  }else if(id==='meta'){
   showTab('meta');await readMeta();await fit();
  }else if(id==='checks'){
   $('#toggle-sidebar').click();for(const details of $('#sidebar').querySelectorAll(':scope>details'))details.open=details.id==='checks-drawer';
   for(const input of $('#checks-groups').querySelectorAll('input'))input.checked=['layout','accessibility','meta','performance','visual','capture'].includes(input.value);
   $('#checks-groups').dispatchEvent(new Event('change',{bubbles:true}));showTab('checks');$('#sidebar').scrollTop=0;await fit();
  }else if(id==='help'){
   await until(()=>!!samestateFeatureHelpIcons.forTarget($('#open-outline'))&&!samestateFeatureHelpIcons.forTarget($('#open-outline')).hidden);
  }else if(id==='tour'){
   startTour({index:0,manual:true});await until(()=>tourPhase==='waiting'&&tourPaused);if(!$('#sidebar').hidden)$('#toggle-sidebar').click();await fit();if(samestateTourVoice.get().muted)$('#tour-mute').click();
  }else if(id==='report'){
   for(const d of active())d.iframe.contentDocument.querySelector('#plans').scrollIntoView({block:'start'});
   await wait(500);await detect(true);showTab('diff');await fit();
  }else if(id==='capture'){
   $('#toggle-sidebar').click();for(const details of $('#sidebar').querySelectorAll(':scope>details'))details.open=details.querySelector('summary')?.textContent==='Capture';
   await wallCapture.useFolder(await(await navigator.storage.getDirectory()).getDirectoryHandle('samestate-captures',{create:true}));
   $('#shot-unit').value='apart';$('#shot-unit').dispatchEvent(new Event('change'));$('#shot-rate').value='0.5';$('#shot-rate').dispatchEvent(new Event('change'));$('#record-rate').value='15';$('#sidebar').scrollTop=0;await fit();
  }else if(id==='theme'){
   uiTheme.preview('clean','light');$('#toggle-sidebar').click();for(const details of $('#sidebar').querySelectorAll(':scope>details'))details.open=details.id==='theme-drawer';
   $('#theme-preset').value='clean-green';await changeTheme();await fit();
  }
  if(id!=='help')samestateFeatureHelp.close(false);await document.fonts.ready;await wait(250);
  return {id,theme:document.documentElement.dataset.uiTheme,background:getComputedStyle(document.body).backgroundColor,screens:active().length};
 }
 async function act(id){
  if(id==='sync'){point(['desktop','.dd-btn']);await wait(650);play('desktop',{do:'click',sel:'.dd-btn'});await wait(700);}
  else if(id==='measure'){point('#outline-list button');await wait(500);$('#outline-list button').click();await until(()=>!!samestateOutline.get().measurement);}
  else if(id==='checks'){point('#checks-run');await wait(500);$('#checks-run').click();await until(()=>!samestateChecks.running&&!!samestateChecks.get()?.finishedAt);await wait(650);const first=$('#pane-checks [data-status="review"]');if(first)$('#pane-checks').scrollTo({top:first.offsetTop-260,behavior:'smooth'});}
  else if(id==='help'){const source=$('#open-outline'),icon=samestateFeatureHelpIcons.forTarget(source);point(source);source.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));await wait(400);point(icon);await wait(250);icon.click();await wait(250);point('#feature-help-hear');$('#feature-help-hear').click();source.dispatchEvent(new PointerEvent('pointerout',{bubbles:true,relatedTarget:$('#feature-help-hear')}));}
  else if(id==='tour'){point('#tourpause');await wait(500);$('#tourpause').click();}
  else if(id==='meta'){point('#pane-meta');await wait(900);$('#pane-meta').scrollTo({top:220,behavior:'smooth'});}
 }
 window.promo={prepare,act,fit};
})();
