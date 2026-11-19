/* Explicit help from the top-bar icon or F1, with bundled natural voice explanations. */
(() => {
  'use strict';
  const catalog=window.samestateFeatureHelpCatalog;
  const panel=document.createElement('aside');
  panel.id='feature-help'; panel.hidden=true; panel.setAttribute('popover','manual');
  panel.setAttribute('role','dialog'); panel.setAttribute('aria-labelledby','feature-help-title');
  panel.setAttribute('aria-describedby','feature-help-text');
  panel.innerHTML='<div class="feature-help-heading"><b id="feature-help-title"></b><button type="button" id="feature-help-close" aria-label="Close feature help">×</button></div><div id="feature-help-browser" hidden><label for="feature-help-search">Find an explanation</label><input type="search" id="feature-help-search" autocomplete="off" spellcheck="false" placeholder="Search features, buttons or sections…"><p id="feature-help-count" role="status" aria-live="polite"></p><div id="feature-help-results" aria-label="Feature explanations"></div></div><p id="feature-help-text"></p><p id="feature-help-availability" hidden></p><div class="feature-help-footer"><button type="button" id="feature-help-hear"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg><span>Hear explanation</span></button><small>F1 for help · Esc to close</small></div><span id="feature-help-status" class="sr-only" role="status" aria-live="polite"></span>';
  document.body.append(panel);
  const hear=$('#feature-help-hear'), audio=document.createElement('audio');
  audio.id='feature-help-audio'; audio.hidden=true; audio.preload='none';document.body.append(audio);
  const opener=$('#feature-help-open'), browser=$('#feature-help-browser'), search=$('#feature-help-search');
  let anchor=null, entry=null, watch=0, sequence=0, playing=false, reservation=null, nativeTitles=[], oldDescription=null, browsing=false;
  const candidates='button,input:not([type=hidden]),select,textarea,summary,a[href],h1,h2,h3,legend,label,.dev-name,.viewport-size,.finding,.check-result,.outline-metrics dt,.debug-heading,.debug-group,[role=option]';
  const clipFor=key=>window.samestateFeatureHelpNarration?.clips.find(clip=>clip.key===key);
  function target(node) {
    if(!(node instanceof Element)||node.closest('#feature-help'))return null;
    const el=node.closest(candidates);
    return el&&catalog.resolve(el)?el:null;
  }
  function available(el) {
    if(!el?.isConnected||el.closest('[inert]')||!el.getClientRects().length)return false;
    const modal=document.querySelector('dialog[open]:modal');
    if(modal&&!modal.contains(el))return false;
    const style=getComputedStyle(el);return style.visibility!=='hidden'&&style.display!=='none';
  }
  function stopVoice(resume=true) {
    sequence++;audio.onended=audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();
    playing=false;hear.querySelector('span').textContent='Hear explanation';hear.setAttribute('aria-pressed','false');
    const previous=reservation;reservation=null;
    if(resume&&previous&&previous.tour===tour&&tourRunning&&tourPaused)setTourPaused(false);
  }
  function restoreAnchor() {
    if(!anchor)return;
    for(const [element,title] of nativeTitles)if(!element.hasAttribute('title'))element.setAttribute('title',title);
    const ids=(anchor.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='feature-help-text');
    if(ids.length)anchor.setAttribute('aria-describedby',ids.join(' '));else anchor.removeAttribute('aria-describedby');
    nativeTitles=[];oldDescription=null;
  }
  function close(resume=true,focus=false) {
    cancelAnimationFrame(watch);watch=0;
    const previous=anchor,returnFocus=focus||panel.contains(document.activeElement);
    stopVoice(resume);restoreAnchor();anchor=entry=null;
    browsing=false;opener.setAttribute('aria-expanded','false');
    if(typeof panel.hidePopover==='function'&&panel.matches(':popover-open'))panel.hidePopover();
    panel.hidden=true;
    if(returnFocus&&previous?.isConnected&&available(previous))previous.focus?.({preventScroll:true});
  }
  function place() {
    if(!anchor||!available(anchor)){close();return;}
    const r=anchor.getBoundingClientRect(),w=panel.offsetWidth,h=panel.offsetHeight,pad=10,gap=8;
    const group=anchor.closest('#tour')?.getBoundingClientRect()||r;
    let left=r.left,top=group.bottom+gap;
    if(top+h>innerHeight-pad)top=group.top-h-gap;
    if(top<pad){top=Math.max(pad,Math.min(r.top,innerHeight-h-pad));left=r.right+gap;if(left+w>innerWidth-pad)left=r.left-w-gap;}
    panel.style.left=Math.max(pad,Math.min(left,innerWidth-w-pad))+'px';
    panel.style.top=Math.max(pad,Math.min(top,innerHeight-h-pad))+'px';
  }
  function track() {if(panel.hidden)return;place();if(!panel.hidden)watch=requestAnimationFrame(track);}
  function show(el,focus=false) {
    if(!available(el))return;
    const help=catalog.resolve(el);if(!help)return;
    if(anchor===el&&entry?.key===help.key&&!panel.hidden){if(focus)hear.focus();return;}
    close();anchor=el;entry=help;browser.hidden=true;panel.classList.remove('help-browser');
    nativeTitles=[el,...el.querySelectorAll('[title]')].filter(node=>node.hasAttribute('title')).map(node=>[node,node.getAttribute('title')]);
    for(const [node] of nativeTitles)node.removeAttribute('title');
    oldDescription=el.getAttribute('aria-describedby');
    el.setAttribute('aria-describedby',[oldDescription,'feature-help-text'].filter(Boolean).join(' '));
    $('#feature-help-title').textContent=help.title;$('#feature-help-text').textContent=help.text;
    const reason=typeof toolAvailability==='function'&&(el.matches('button,input,select,textarea')||el.closest('[inert]'))?toolAvailability(el):'';
    const availability=$('#feature-help-availability');availability.textContent=reason;availability.hidden=!reason;
    $('#feature-help-status').textContent='';hear.disabled=!clipFor(help.key);
    const host=el.closest('dialog[open]')||document.body;if(panel.parentElement!==host)host.append(panel);
    panel.hidden=false;
    if(typeof panel.showPopover==='function'){try{panel.showPopover({source:el});}catch{panel.showPopover();}}
    place();watch=requestAnimationFrame(track);if(focus)hear.focus({preventScroll:true});
  }
  function renderBrowser() {
    const words=search.value.normalize('NFKD').toLowerCase().split(/\s+/).filter(Boolean);
    const matches=catalog.entries().filter(item=>{const text=(item.title+' '+item.text).normalize('NFKD').toLowerCase();return words.every(word=>text.includes(word));});
    $('#feature-help-count').textContent=matches.length ? `${matches.length} explanations${matches.length>30?' · showing the first 30':''}` : 'No explanations found. Try a feature name, such as metadata or capture.';
    $('#feature-help-results').innerHTML=matches.slice(0,30).map(item=>`<button type="button" data-help-key="${esc(item.key)}" aria-pressed="${entry?.key===item.key}">${esc(item.title)}</button>`).join('');
  }
  function openBrowser() {
    if(!available(opener))return;
    close();anchor=opener;browsing=true;browser.hidden=false;panel.classList.add('help-browser');
    $('#feature-help-title').textContent='Feature help';
    $('#feature-help-text').textContent='Choose an explanation above, then press Hear explanation to listen.';
    $('#feature-help-availability').hidden=true;$('#feature-help-status').textContent='';hear.disabled=true;
    search.value='';renderBrowser();opener.setAttribute('aria-expanded','true');
    if(panel.parentElement!==document.body)document.body.append(panel);
    panel.hidden=false;if(typeof panel.showPopover==='function')panel.showPopover({source:opener});
    place();watch=requestAnimationFrame(track);search.focus({preventScroll:true});
  }
  function speak() {
    if(playing){stopVoice();return;}
    const clip=entry&&clipFor(entry.key);if(!clip)return;
    stopVoice(false);
    if(tourRunning&&!tourPaused){reservation={tour};setTourPaused(true);}
    const token=sequence;
    audio.src=new URL(`help/narration/${clip.file}?v=${window.samestateFeatureHelpNarration.build}`,document.baseURI).href;
    audio.preload='auto';playing=true;hear.setAttribute('aria-pressed','true');hear.querySelector('span').textContent='Stop voice';
    $('#feature-help-status').textContent='Playing the feature explanation.';
    audio.onended=()=>{if(sequence===token&&audio.ended)stopVoice();};
    const fail=()=>{if(sequence!==token)return;stopVoice();$('#feature-help-status').textContent='The voice clip could not play. Press Hear explanation to retry.';};
    audio.onerror=()=>{if(audio.error)fail();};
    try{Promise.resolve(audio.play()).catch(fail);}catch{fail();}
  }
  hear.addEventListener('click',speak);
  opener.addEventListener('click',()=>browsing?close(true,true):openBrowser());
  search.addEventListener('input',()=>{stopVoice();entry=null;$('#feature-help-title').textContent='Feature help';$('#feature-help-text').textContent='Choose an explanation above, then press Hear explanation to listen.';hear.disabled=true;renderBrowser();});
  $('#feature-help-results').addEventListener('click',event=>{
    const button=event.target.closest('[data-help-key]'),help=button&&catalog.entry(button.dataset.helpKey);if(!help)return;
    stopVoice();entry=help;$('#feature-help-title').textContent=help.title;$('#feature-help-text').textContent=help.text;
    $('#feature-help-status').textContent='';hear.disabled=!clipFor(help.key);renderBrowser();place();hear.focus({preventScroll:true});
  });
  $('#feature-help-close').addEventListener('click',()=>close(true,true));
  // Keep tooltip actions out of enclosing settings forms and menu action handlers.
  for(const type of ['click','pointerdown','pointerup','input','change'])panel.addEventListener(type,event=>event.stopPropagation());
  document.addEventListener('change',event=>{if(anchor&&(event.target===anchor||anchor.contains(event.target)))show(anchor);});
  document.addEventListener('click',event=>{
    if(panel.contains(event.target)||opener.contains(event.target))return;
    if(!panel.hidden)close(!event.target.closest('#tourpause'));
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();close(true,true);return;}
    if(event.key==='F1'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();event.stopImmediatePropagation();const el=target(document.activeElement);if(el)show(el,true);else if(!browsing)openBrowser();}
  },true);
  addEventListener('pagehide',()=>close(false));
  window.samestateFeatureHelp={open:openBrowser,show,close,stopVoice,resolve:catalog.resolve,catalog:catalog.entries,get:()=>({key:entry?.key||null,open:!panel.hidden,browsing,playing,pausedDemo:!!reservation})};
})();
