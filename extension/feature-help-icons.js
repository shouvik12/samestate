/* Small explicit help shortcuts. App controls and preview frames are never wrapped or moved. */
(() => {
  'use strict';
  const help=window.samestateFeatureHelp, catalog=window.samestateFeatureHelpCatalog;
  const selectors='button,input:not([type=hidden]),select,textarea,summary,a[href],h1,h2,h3,legend,.dev-name,.viewport-size,.finding,.check-result,.outline-metrics dt,.debug-heading,.debug-group,[role=option]';
  const own='#feature-help,.feature-help-layer';
  const layer=document.createElement('div');
  layer.className='feature-help-layer';layer.setAttribute('role','toolbar');layer.setAttribute('aria-label','Feature help shortcuts');
  document.body.append(layer);
  const icons=new Map(), sources=new WeakMap();let queued=0, current=null;
  const glyph='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.8-2.5 2-2.5 4M12 17h.01"/></svg>';
  const targetFor=node=>node instanceof Element?sources.get(node.closest('.feature-help-trigger'))||null:null;
  function visibleRect(el, clips) {
    if(!el.isConnected||el.closest('[hidden],[inert],.sr-only')||!el.getClientRects().length)return null;
    const style=getComputedStyle(el);if(style.visibility!=='visible'||style.display==='none')return null;
    const r=el.getBoundingClientRect();let left=Math.max(0,r.left),top=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom);
    for(let p=el.parentElement;p&&p!==document.documentElement;p=p.parentElement){
      let clip=clips.get(p);
      if(!clip){const s=getComputedStyle(p);clip={r:p.getBoundingClientRect(),x:/(auto|scroll|hidden|clip)/.test(s.overflowX),y:/(auto|scroll|hidden|clip)/.test(s.overflowY)};clips.set(p,clip);}
      if(clip.x){left=Math.max(left,clip.r.left);right=Math.min(right,clip.r.right);}
      if(clip.y){top=Math.max(top,clip.r.top);bottom=Math.min(bottom,clip.r.bottom);}
    }
    if(right-left<4||bottom-top<4)return null;
    const hit=document.elementsFromPoint((left+right)/2,(top+bottom)/2).find(node=>!node.closest('.feature-help-layer'));
    if(hit&&!el.contains(hit)&&!hit.closest('#feature-help'))return null;
    return {left,top,right,bottom,width:right-left,height:bottom-top};
  }
  function refresh() {
    queued=0;
    const host=document.querySelector('dialog[open]:modal')||document.body;
    if(layer.parentElement!==host)host.append(layer);
    const clips=new Map(),used=[],seen=new Set();
    for(const el of host.querySelectorAll(selectors)){
      if(el.id==='feature-help-open'||el.closest(own)||el.closest('iframe'))continue;
      const entry=catalog.resolve(el);if(!entry)continue;
      seen.add(el);let button=icons.get(el);
      if(!button){button=document.createElement('button');button.type='button';button.className='feature-help-trigger';button.tabIndex=-1;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','feature-help');button.innerHTML=glyph;sources.set(button,el);icons.set(el,button);layer.append(button);}
      button.dataset.helpKey=entry.key;button.setAttribute('aria-label','Help: '+entry.title);button.setAttribute('aria-expanded',String(help.isFor(el)));
      const r=visibleRect(el,clips);
      if(!r){button.hidden=true;continue;}
      let visual=el;
      if(el.matches('input,select,textarea'))visual=[...el.labels||[]].find(label=>label.getClientRects().length&&!label.classList.contains('sr-only'))||el;
      const label=visual.getBoundingClientRect(),info=el.querySelector('.debug-info');
      let x,y;
      if(info){const i=info.getBoundingClientRect();x=i.left;y=i.top;}
      else if(el.closest('.capture-folder')){const box=el.closest('.capture-folder').getBoundingClientRect();x=box.right-18;y=r.top+1;}
      else if(el.matches('.dev-name,.viewport-size')){x=r.right-12;y=r.top-14;}
      else if(el.matches('summary,h1,h2,h3,legend,.outline-metrics dt,.debug-heading,.debug-group')){
        const range=document.createRange(),first=[...el.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim());range.selectNodeContents(first||el);const text=range.getBoundingClientRect();x=Math.min(text.right+3,r.right-14);y=Math.max(r.top,(r.top+r.bottom-14)/2);
      }else if(el.matches('.finding,.check-result,[role=option]')){x=r.right-18;y=r.top+4;}
      else{x=Math.min(label.right,r.right)-8;y=Math.max(label.top,r.top)-14;}
      x=Math.max(2,Math.min(innerWidth-16,x));y=Math.max(2,Math.min(innerHeight-16,y));
      const variants=[[x,y],[x-15,y],[x,y-15],[x+15,y],[x,y+15]];
      const free=variants.find(([a,b])=>a>=2&&b>=2&&a<=innerWidth-16&&b<=innerHeight-16&&!used.some(u=>Math.abs(u.x-a)<15&&Math.abs(u.y-b)<15));
      if(free)[x,y]=free;
      used.push({x,y});button.hidden=false;button.style.left=Math.round(x)+'px';button.style.top=Math.round(y)+'px';
    }
    for(const [el,button] of icons)if(!seen.has(el)){if(!el.isConnected){button.remove();icons.delete(el);}else button.hidden=true;}
    const visible=[...icons.values()].filter(button=>!button.hidden).sort((a,b)=>parseFloat(a.style.top)-parseFloat(b.style.top)||parseFloat(a.style.left)-parseFloat(b.style.left));
    if(!visible.includes(current))current=visible[0]||null;
    for(const button of icons.values())button.tabIndex=button===current&&!button.hidden?0:-1;
  }
  function schedule(){if(!queued)queued=requestAnimationFrame(refresh);}
  function iconEvent(event){const button=event.target instanceof Element?event.target.closest('.feature-help-trigger'):null;return button&&sources.has(button)?button:null;}
  for(const type of ['pointerdown','pointerup','mousedown','mouseup'])window.addEventListener(type,event=>{if(iconEvent(event))event.stopImmediatePropagation();},true);
  window.addEventListener('click',event=>{
    const button=iconEvent(event);if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();current=button;
    const source=sources.get(button);if(help.isFor(source))help.close(true,true);else help.show(source,true,button);
    schedule();
  },true);
  window.addEventListener('keydown',event=>{
    const button=iconEvent(event);if(!button)return;
    if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)button.click();return;}
    if(!['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopImmediatePropagation();
    const visible=[...icons.values()].filter(b=>!b.hidden).sort((a,b)=>parseFloat(a.style.top)-parseFloat(b.style.top)||parseFloat(a.style.left)-parseFloat(b.style.left));
    const step=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1,index=event.key==='Home'?0:event.key==='End'?visible.length-1:(visible.indexOf(button)+step+visible.length)%visible.length;
    current=visible[index];for(const b of visible)b.tabIndex=b===current?0:-1;current?.focus({preventScroll:true});
  },true);
  window.addEventListener('keyup',event=>{if(iconEvent(event)&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopImmediatePropagation();}},true);
  const observer=new MutationObserver(records=>{
    if(records.some(record=>{
      if(record.target instanceof Element&&record.target.closest(own+',#tour-cursor,#tour-ring,#tour-callout'))return false;
      if(record.type==='childList'&&[...record.addedNodes,...record.removedNodes].every(node=>node instanceof Element&&node.matches(own)))return false;
      return true;
    }))schedule();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,characterData:true});
  for(const event of ['scroll','toggle','transitionend','input','change'])document.addEventListener(event,schedule,true);
  addEventListener('resize',schedule);document.fonts.ready.then(schedule);
  addEventListener('pagehide',()=>{observer.disconnect();cancelAnimationFrame(queued);});
  window.samestateFeatureHelpIcons={targetFor,forTarget:el=>icons.get(el)||null,refresh:schedule};
  schedule();
})();
