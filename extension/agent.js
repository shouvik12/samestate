/* Mirrors controls and measures layout using element structure and geometry. */
(() => {
  'use strict';
  const tag = document.currentScript, ext = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  const demo = !!tag?.matches('script[data-samestate="demo"]');
  const EXT = demo ? location.origin : ext ? 'chrome-extension://' + ext : null;
  if (!EXT || window.__samestate || window.parent === window || window.parent !== window.top) return;
  if (!location.ancestorOrigins || location.ancestorOrigins[0] !== EXT) return; // only inside a Samestate device frame
  window.__samestate = true;
  try { performance.setResourceTimingBufferSize(1500); } catch {} // the default 250 entries fill up on busy pages
  const cfg = { touch: false, inspect: false };
  for (const type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','mousemove','mouseover','mouseout','click','touchstart','touchend','contextmenu']) addEventListener(type, interceptInspection, { capture: true, passive: false });
  const privateContent = 'form,input,textarea,select,option,[contenteditable],[hidden],[aria-hidden=true],[data-samestate-private],script,style,noscript,template';
  const encoder = new TextEncoder();
  let port;
  function send(type, data) {
    const message = { __samestate: 1, type, ...data };
    if (demo) parent.postMessage(message, EXT);
    else port?.postMessage(message);
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const now = () => Date.now();

  // With phone and tablet identity on, the extension sends the device's user-agent to the server for page loads
  // whose address carries samestate-ua (emulate.js removes it from the address before the page's scripts run).
  // Pages this screen opens itself keep the mark, so the server keeps sending the phone or tablet page.
  const UA_MARK = 'samestate-ua';
  function uaMark() {
    if (demo || !window.name.startsWith('samestate-device:')) return null;
    try { const d = JSON.parse(window.name.slice(17)); return d.ios ? (d.mobile ? 'iphone' : 'ipad') : (d.mobile ? 'android' : 'android-tablet'); } catch { return null; }
  }
  function withUa(href) {
    const mark = uaMark();
    if (!mark) return href;
    try { const u = new URL(href, location.href); if (u.origin !== location.origin) return href; u.searchParams.set(UA_MARK, mark); return u.href; } catch { return href; }
  }
  const reloadPage = () => { const href = withUa(location.href); if (href === location.href) location.reload(); else location.replace(href); };

  const ACTIONABLE = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=switch],[role=checkbox],[role=option],[onclick],[data-toggle],[data-bs-toggle],[aria-controls],[aria-expanded],[tabindex]:not([tabindex="-1"])';

  /* ------------------------------ semantics ------------------------------ */
  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.checkVisibility) { if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; }
    else { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; }
    const de = document.documentElement, vw = de.clientWidth, vh = window.innerHeight;
    if (r.right + window.scrollX <= 0 || r.left + window.scrollX >= Math.max(de.scrollWidth, vw)) return false;
    for (let a = el; a && a !== de; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.position === 'fixed') {
        // An off-canvas drawer is a fixed element pushed outside the viewport. An item further down
        // an open drawer that scrolls is still reachable, so only the drawer's own position counts.
        const fr = a.getBoundingClientRect();
        if (fr.left >= vw || fr.right <= 0 || fr.top >= vh || fr.bottom <= 0) return false;
        if (a === el && (r.left >= vw || r.right <= 0 || r.top >= vh || r.bottom <= 0)) return false;
      }
      if (a !== el && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible')) {
        const ar = a.getBoundingClientRect();
        if (cs.overflowY !== 'visible' && (r.bottom <= ar.top + 1 || r.top >= ar.bottom - 1) && cs.overflowY === 'hidden') return false; // collapsed panel
        if (cs.overflowX === 'hidden' && (r.right <= ar.left + 1 || r.left >= ar.right - 1)) return false;
      }
    }
    return true;
  }

  const demoControls = [
    ['Products', '.dd-btn,.acc'],
    ['Sign in', '.signin'],
    ['Close', '#signin .close'],
    ['Open navigation', '.hamburger'],
  ];

  function kindOf(el) {
    if (el.matches('a[href],[role=link]')) return 'link';
    if (el.matches('select')) return 'select';
    if (el.matches('input[type=checkbox],input[type=radio],[role=checkbox],[role=switch]')) return 'check';
    if (el.matches('textarea,input:not([type=button],[type=submit],[type=reset],[type=image])')) return 'field';
    if (el.matches('[role=tab]')) return 'tab';
    if (el.matches('summary,[aria-expanded]')) return 'disclosure';
    return 'button';
  }

  async function textFingerprint(el) {
    const key = cfg.textKey;
    if (!key || !visible(el) || el.closest(privateContent)) return '';

    let text = '';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        if (node.matches(privateContent)) return NodeFilter.FILTER_REJECT;
        // display:contents has no box but its children can still render.
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      }
    });
    const range = document.createRange();
    for (let node = walker.nextNode(); node && text.length < 160; node = walker.nextNode()) {
      range.selectNodeContents(node);
      if (Array.from(range.getClientRects()).some(rect => rect.width > 0 && rect.height > 0)) {
        text += ' ' + node.substringData(0, 160 - text.length);
      }
    }
    text = text.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!text) return '';

    const fingerprint = await crypto.subtle.sign('HMAC', await key, encoder.encode(text));
    if (key !== cfg.textKey) return '';
    return Array.from(new Uint8Array(fingerprint, 0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function elementPath(el) {
    const indices = [];
    while (el && el !== document.body) {
      if (!el.parentElement) return '';
      let index = 1;
      for (let sibling = el.previousElementSibling; sibling; sibling = sibling.previousElementSibling) index++;
      indices.unshift(index);
      el = el.parentElement;
    }
    return indices.join('.');
  }

  // Responsive sites often render one control twice (desktop bar and mobile bar) and hide one copy.
  // The copies sit at different places in the page, but share their attributes. Only hashes leave the frame.
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  function signature(el) {
    const attr = name => el.getAttribute(name) || '';
    const classes = Array.from(el.classList).sort().join(' ');
    const shape = [el.tagName, attr('type'), attr('role'), classes].join('|');
    const id = attr('data-testid') || attr('data-test') || attr('data-cy');
    const label = [attr('aria-label'), attr('title'), attr('aria-controls')].join('|');
    return {
      id: id ? hash('i|' + el.tagName + '|' + id) : '',
      label: label !== '||' ? hash('l|' + shape + '|' + label) : '',
      shape: classes ? hash('s|' + shape) : ''
    };
  }

  function describe(el) {
    const control = demo && demoControls.find(([, selector]) => el.matches(selector));
    // Whether the control is part of the site's navigation, the only place another screen size may
    // have tucked it behind a menu button.
    const nav = !!el.closest('nav,header,[role=navigation],[role=menubar],[role=menu]');
    return { kind: kindOf(el), path: elementPath(el), sig: signature(el), ...(nav && { nav: true }), ...(control && { demoControl: control[0] }) };
  }

  // The one visible control here with the same attributes as the control used on the leading screen.
  function findTwin(description) {
    const sig = description.sig;
    if (!sig || typeof sig !== 'object') return null;
    const pool = Array.from(document.querySelectorAll(ACTIONABLE))
      .filter(el => canMirrorClick(el, description.link) && kindOf(el) === description.kind && visible(el)).slice(0, 400)
      .map(el => [el, signature(el)]);
    for (const tier of ['id', 'label', 'shape']) {
      if (!sig[tier] || typeof sig[tier] !== 'string') continue;
      const hits = pool.filter(([, own]) => own[tier] === sig[tier]);
      if (hits.length === 1) return hits[0][0];
      if (hits.length > 1) return null; // several look-alikes: guessing would click the wrong one
    }
    return null;
  }

  function locate(path) {
    if (!path || !/^\d+(?:\.\d+)*$/.test(path)) return null;
    let el = document.body;
    for (const index of path.split('.')) el = el?.children[Number(index) - 1];
    return el || null;
  }

  function actionable(target) {
    return target instanceof Element ? target.closest(ACTIONABLE) : null;
  }

  // links: also a link that works as a button. Such a click is only shared when the page cancelled its navigation.
  function canMirrorClick(el, links = false) {
    if (demo && el.matches('#signin .close')) return true;
    if (el.closest(playerControl)) return false;
    if (links && el.matches('a[href],[role=link]') && !el.closest('form,[contenteditable]')) return true;
    if (el.closest('form,[contenteditable]') || el.matches('a, input, textarea, select, [role=link], [role=checkbox], [role=switch]')) return false;
    return el.matches('button,summary,[role=button],[role=tab],[aria-expanded]');
  }

  function matchingControls(description) {
    const control = demo && demoControls.find(([name]) => name === description.demoControl);
    if (control) return Array.from(document.querySelectorAll(control[1]));
    const el = locate(description.path);
    return el?.matches(ACTIONABLE) && kindOf(el) === description.kind ? [el] : [];
  }

  async function findTarget(description) {
    const candidates = matchingControls(description).filter(el => canMirrorClick(el, description.link));
    if (description.textKey && cfg.textKey && !description.demoControl) {
      const structural = candidates.find(visible);
      if (structural && await textFingerprint(structural) === description.textKey) return { el: structural, status: 'direct' };
      const eligible = Array.from(document.querySelectorAll(ACTIONABLE))
        .filter(el => el !== structural && canMirrorClick(el, description.link) && kindOf(el) === description.kind && visible(el)).slice(0, 300);
      const keys = await Promise.all(eligible.map(textFingerprint));
      const first = keys.indexOf(description.textKey);
      if (first !== -1 && first === keys.lastIndexOf(description.textKey)) return { el: eligible[first], status: 'semantic' };
      const twin = structural ? null : findTwin(description);
      return twin ? { el: twin, status: 'semantic' } : { el: null, status: 'none' };
    }
    let el = candidates.find(visible);
    if (el) return { el, status: description.demoControl ? 'semantic' : 'direct' };
    if (!description.demoControl && (el = findTwin(description))) return { el, status: 'semantic' };

    if (demo && candidates.length && ['Products', 'Sign in'].includes(description.demoControl)) {
      const menu = document.querySelector('.hamburger[aria-expanded="false"]');
      if (visible(menu)) {
        press(menu);
        await sleep(420);
        // Background frames may not advance drawer animations.
        for (const animation of menu.ownerDocument.getAnimations()) {
          const timing = animation.effect?.getComputedTiming();
          if (timing && Number.isFinite(timing.endTime)) animation.finish();
        }
        el = candidates.find(visible);
        if (el) return { el, status: 'revealed' };
      }
    }

    return { el: null, status: candidates.length ? 'hidden' : 'none' };
  }

  function finishAnimations() {
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getComputedTiming();
      if (timing && Number.isFinite(timing.endTime) && animation.playState === 'running') animation.finish();
    }
  }

  // Closes a menu the agent opened itself: its own button when still reachable, else a close button
  // that has appeared (the drawer usually covers the hamburger), else Escape.
  function closeMenu(toggle) {
    if (toggle.isConnected && visible(toggle)) return press(toggle);
    const close = Array.from(document.querySelectorAll('button,[role=button]'))
      .find(el => visible(el) && /\bclose\b/i.test([el.getAttribute('aria-label'), el.getAttribute('title'), typeof el.className === 'string' ? el.className.replace(/[-_]/g, ' ') : '', el.textContent.trim().length < 12 ? el.textContent : ''].join(' ')));
    if (close) return press(close);
    for (const type of ['keydown', 'keyup']) document.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  }

  // The page's closed navigation menu button (hamburger), if it shows one.
  function menuToggle() {
    const words = /\b(menu|nav|navigation|hamburger|burger)\b/i;
    const pool = Array.from(document.querySelectorAll('button,[role=button],a[aria-controls],[aria-expanded]'))
      .filter(el => visible(el) && el.getAttribute('aria-expanded') !== 'true').slice(0, 300);
    const text = el => [el.getAttribute('aria-label'), el.getAttribute('title'), el.id, typeof el.className === 'string' ? el.className.replace(/[-_]/g, ' ') : '', el.getAttribute('aria-controls'), el.textContent.trim().length < 20 ? el.textContent : ''].join(' ');
    return pool.find(el => el.getAttribute('aria-haspopup') && words.test(text(el)))
      || pool.find(el => words.test(text(el)) && el.getAttribute('aria-expanded') === 'false')
      || pool.find(el => words.test(text(el)))
      || null;
  }

  let replaying = 0;
  function press(el) {
    replaying++; setTimeout(() => replaying--, 0);
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 };
    try { el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new MouseEvent('mousedown', o)); } catch (e) {}
    try { if (el.focus) el.focus({ preventScroll: true }); } catch (e) {}
    try { el.dispatchEvent(new PointerEvent('pointerup', o)); el.dispatchEvent(new MouseEvent('mouseup', o)); } catch (e) {}
    el.click();
  }
  /* ------------------------------- overlays ------------------------------- */
  let layer = null, hoverRing = null;
  function getLayer() {
    if (!layer || !layer.isConnected) { layer = document.createElement('samestate-layer'); layer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647'; document.documentElement.appendChild(layer); }
    return layer;
  }
  function ring(el, color, ms) {
    const r = el.getBoundingClientRect(), d = document.createElement('div');
    d.style.cssText = `position:absolute;box-sizing:border-box;left:${r.left + scrollX - 3}px;top:${r.top + scrollY - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;border:2px solid ${color};border-radius:6px;box-shadow:0 0 0 4px ${color}33,0 0 18px ${color}88;transition:opacity .4s;pointer-events:none`;
    getLayer().appendChild(d);
    if (ms) setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 400); }, ms);
    return d;
  }
  const flash = el => ring(el, '#ff4d8d', 700);

  /* ------------------------- capturing user actions ------------------------- */
  let hovering = false, lastInput = 0, lastActive = 0, suppressUntil = 0, swallowClick = false;
  let playbackGesture = -Infinity, playbackVersion = 0, lastVideo = null;
  let pageGesture = -Infinity;
  const playbackCommands = new WeakMap();
  const playerControl = 'video,.ytp-play-button,.ytp-large-play-button,.ytp-cued-thumbnail-overlay';
  const act = (kind, data) => send('act', Object.assign({ kind }, data));
  function mark() { if (!cfg.inspect) return; lastInput = now(); if (lastInput - lastActive > 400) { lastActive = lastInput; send('active'); } }
  const leading = () => cfg.inspect && now() > suppressUntil && (hovering || now() - lastInput < 1500);
  for (const ev of ['pointerdown', 'wheel', 'touchstart']) addEventListener(ev, e => e.isTrusted && mark(), { capture: true, passive: true });
  for (const ev of ['pointerdown', 'click', 'keydown']) {
    addEventListener(ev, event => { if (event.isTrusted) playbackGesture = now(); }, { capture: true, passive: true });
  }
  document.addEventListener('mouseenter', () => { hovering = true; mark(); });
  document.addEventListener('mouseleave', () => { hovering = false; if (lastHover) { lastHover = null; act('unhover', {}); } });

  function mirrorClick(el, link = false) {
    const description = { ...describe(el), ...(link && { link: true }) };
    const version = playbackVersion;
    setTimeout(async () => {
      if (!el.isConnected || version !== playbackVersion) return;
      const expanded = el.matches('[aria-expanded=true]') ? true : el.matches('[aria-expanded=false]') ? false : null;
      const open = el.matches('details > summary') ? el.parentElement.open : null;
      const pressed = el.getAttribute('aria-pressed');
      const textKey = description.demoControl ? '' : await textFingerprint(el).catch(() => '');
      if (el.isConnected && version === playbackVersion) act('click', { d: { ...description, textKey }, expanded, open, pressed });
    }, 90);
  }

  function journeyControl(el) {
    if (!(el instanceof HTMLElement) || el.form || el.closest(privateContent) || el.matches(':disabled,[aria-disabled=true]')) return false;
    if (el.matches('details > summary')) return true;
    if (el instanceof HTMLAnchorElement) {
      if (!el.hasAttribute('href') || el.hasAttribute('download') || el.origin !== location.origin || el.pathname !== location.pathname || el.search !== location.search || /^#!?\//.test(el.hash)) return false;
    } else if (!el.matches('button,[role=button],[role=tab]')) return false;
    if (el.matches('[aria-expanded],[aria-haspopup=dialog],[aria-haspopup=menu],[aria-haspopup=true],[popovertarget],[command=show-modal],[role=tab]')) return true;
    if (el.querySelector('[data-samestate-private]')) return false;
    const label = (el.getAttribute('aria-label') || el.innerText || '').trim();
    return /^(?:sign|log)\s*in$/i.test(label);
  }

  function sendPageStep(type, data) {
    if (!cfg.pageSteps || (!demo && !port)) return false;
    try { send(type, data); } catch { return false; }
    return true;
  }

  function openPageInWall(address) {
    let url;
    try { url = new URL(address, location.href); } catch { return false; }
    if (url.origin !== location.origin || url.username || url.password || url.href === location.href) return false;
    const samePage = url.pathname === location.pathname && url.search === location.search;
    if (samePage && !/^#!?\//.test(url.hash)) return false;
    return sendPageStep('open-page', { url: url.href });
  }

  function stepTarget(action) {
    return matchingControls(action).find(el => {
      if (!visible(el) || !journeyControl(el)) return false;
      if (action.demoControl) return true;
      const saved = action.sig || {};
      const current = signature(el);
      const tier = ['id', 'label', 'shape'].find(key => saved[key]);
      return !tier || saved[tier] === current[tier];
    });
  }

  async function replayStep(actions) {
    for (const [index, action] of actions.entries()) {
      let control;
      const deadline = now() + 2400;
      do {
        control = stepTarget(action);
        if (control || now() >= deadline) break;
        await sleep(80);
      } while (true);
      if (!control) { send('step-incomplete', { applied: index }); return; }
      control.click();
    }
  }

  addEventListener('click', e => {
    if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); return; }
    if (own(e.target)) return; // rulers, measuring and other Samestate overlays
    if (!cfg.inspect || !e.isTrusted || replaying) return;
    if (cfg.pageSteps) {
      if (e.defaultPrevented || e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const link = e.target.closest?.('a[href],area[href]');
      const control = actionable(e.target);
      const openLink = link && !link.hasAttribute('download') && openPageInWall(link.href);
      const openState = !openLink && journeyControl(control) && sendPageStep('open-state', { url: location.href, action: describe(control) });
      if (openLink || openState) {
        e.preventDefault();
        e.stopImmediatePropagation();
      } else {
        const button = e.target.closest?.('button,[role=button],[role=link]');
        if (button && !button.form && !button.closest('form,[contenteditable]')) pageGesture = now();
      }
      return;
    }
    if (e.target.closest?.(playerControl)) return;
    const el = actionable(e.target);
    if (el && canMirrorClick(el)) mirrorClick(el);
    // A link the page handles itself (it cancels the click, then opens a menu, a tab or a dialog) acts as a button.
    // Links that open a page are left to link sync. The page's own handlers have all run by the next task.
    else if (el && canMirrorClick(el, true)) setTimeout(() => { if (e.defaultPrevented) mirrorClick(el, true); }, 0);
  }, true);

  // A link followed on this screen, or a page change a click here started (single-page apps change pages
  // without loading one), opens the same address on the other screens. Form submissions, downloads, other
  // sites and back/forward stay on this screen.
  let following = null; // the address this screen was told to open, so it is not sent back
  window.navigation?.addEventListener('navigate', event => {
    if (cfg.pageSteps || !cfg.inspect || replaying || event.navigationType !== 'push') return;
    if (event.downloadRequest != null || event.formData || event.sourceElement?.closest?.('form,[contenteditable]')) return;
    if (!event.userInitiated && now() - playbackGesture > 1000) return; // playbackGesture is the last trusted click or key
    let url;
    try { url = new URL(event.destination.url); } catch { return; }
    // Only this screen adds samestate-ua, when it loads a page it already sent; the address is never passed on.
    if (url.searchParams.has(UA_MARK) || url.origin !== location.origin || url.href === following) return;
    act('navigate', { url: url.href });
    // Loading a new page ends this document before the message above reaches Samestate, which then
    // drops it, so this screen goes there itself once the message is on its way.
    if (!event.destination.sameDocument && event.cancelable) {
      event.preventDefault();
      following = url.href;
      setTimeout(() => location.assign(withUa(url.href)), 120);
    }
  });
  // A link followed with link sync off keeps the server user-agent too.
  window.navigation?.addEventListener('navigate', event => {
    if (!uaMark() || !event.isTrusted || !event.cancelable || event.defaultPrevented || event.hashChange || event.downloadRequest != null || event.formData) return;
    if (!event.sourceElement?.closest?.('a[href]')) return; // link clicks only; scripts and routers navigate on their own
    const href = withUa(event.destination.url);
    if (href === event.destination.url) return;
    event.preventDefault();
    location.assign(href);
  });
  function followAddress(address) {
    let url;
    try { url = new URL(address); } catch { return { status: 'none' }; }
    if (url.origin !== location.origin || url.username || url.password) return { status: 'none' };
    url.searchParams.delete(UA_MARK); // another screen's device type never reaches this one
    if (url.href === location.href) return { status: 'skip' };
    following = url.href;
    const samePage = url.pathname === location.pathname && url.search === location.search;
    // After the result has been sent: a full page load ends this script.
    setTimeout(() => { if (samePage && url.hash) location.hash = url.hash; else location.assign(withUa(url.href)); }, 0);
    return { status: 'navigated' };
  }

  window.navigation?.addEventListener('navigate', event => {
    if (!cfg.pageSteps || !event.isTrusted || !event.cancelable || !event.canIntercept || event.defaultPrevented) return;
    const source = event.sourceElement;
    if (event.navigationType !== 'push' || event.downloadRequest != null || event.formData || source?.form || source?.closest?.('form,[contenteditable]')) return;
    if (now() - pageGesture < 700 && openPageInWall(event.destination.url)) {
      pageGesture = -Infinity;
      event.preventDefault();
    }
  });

  function playbackChanged(event) {
    if (!cfg.inspect) return;
    const video = event.target;
    if (!(video instanceof HTMLVideoElement)) return;
    const playing = event.type === 'play';
    if (playing === video.paused) return;

    const command = playbackCommands.get(video);
    if (command?.playing === playing && !command.observed) {
      command.observed = true;
      return;
    }
    if (replaying || now() - playbackGesture > 1500) return;
    lastVideo = video;
    playbackVersion++;
    act('media', { playing, path: elementPath(video) });
  }

  document.addEventListener('play', playbackChanged, true);
  document.addEventListener('pause', playbackChanged, true);

  function mainVideo(path, playing) {
    const match = locate(path);
    if (match instanceof HTMLVideoElement && (visible(match) || !match.paused)) return match;
    if (lastVideo?.isConnected && (playing ? visible(lastVideo) : !lastVideo.paused)) return lastVideo;

    let main = null, largest = -1;
    for (const video of document.querySelectorAll('video')) {
      if (playing ? !visible(video) : video.paused && !visible(video)) continue;
      const bounds = video.getBoundingClientRect();
      const area = bounds.width * bounds.height;
      if (!playing && main && main.paused !== video.paused) {
        if (video.paused) continue;
      } else if (area <= largest) continue;
      largest = area;
      main = video;
    }
    return main;
  }

  async function applyPlayback({ path, playing }) {
    const video = mainVideo(path, playing);
    if (!video) return { status: 'no-video' };
    const command = { playing, observed: video.paused !== playing };
    playbackCommands.set(video, command);
    lastVideo = video;

    if (!playing) {
      video.pause();
      return { status: 'paused' };
    }
    if (!video.paused) return { status: 'playing' };

    try {
      await video.play();
      return { status: playbackCommands.get(video) === command ? 'playing' : 'skip' };
    } catch (error) {
      if (playbackCommands.get(video) !== command) return { status: 'skip' };
      if (error.name !== 'NotAllowedError' || video.muted) {
        playbackCommands.delete(video);
        return { status: error.name === 'NotAllowedError' ? 'blocked' : 'unavailable' };
      }
    }

    video.muted = true;
    try {
      await video.play();
      return { status: playbackCommands.get(video) === command ? 'muted' : 'skip' };
    } catch (error) {
      if (playbackCommands.get(video) !== command) return { status: 'skip' };
      video.muted = false;
      playbackCommands.delete(video);
      return { status: error.name === 'NotAllowedError' ? 'blocked' : 'unavailable' };
    }
  }

  let lastHover = null, hoverT = 0;
  addEventListener('mouseover', e => {
    if (!cfg.inspect || !e.isTrusted || cfg.touch || own(e.target)) return;
    const el = actionable(e.target);
    if (el === lastHover) return; lastHover = el;
    clearTimeout(hoverT); hoverT = setTimeout(() => el && el.isConnected ? act('hover', { d: describe(el) }) : act('unhover', {}), 50);
  }, true);

  /* -------------------------------- scrolling -------------------------------- */
  let anchorCache = null, anchorAt = 0;
  function anchors() {
    if (anchorCache && now() - anchorAt < 800) return anchorCache;
    const out = [];
    for (const el of document.querySelectorAll('h1,h2,h3,h4,section,article,footer')) {
      if (!visible(el)) continue;
      out.push({ key: elementPath(el), top: el.getBoundingClientRect().top + scrollY });
    }
    out.sort((a, b) => a.top - b.top); anchorCache = out; anchorAt = now(); return out;
  }
  const PROBE = 0.25;
  function scrollState() {
    const se = document.scrollingElement || document.documentElement, max = Math.max(1, se.scrollHeight - innerHeight);
    const p = scrollY + innerHeight * PROBE, list = anchors();
    let i = -1; while (i + 1 < list.length && list[i + 1].top <= p) i++;
    const A = i >= 0 ? list[i].top : 0, B = i + 1 < list.length ? list[i + 1].top : se.scrollHeight;
    return { pct: scrollY / max, top: scrollY < 2, bottom: scrollY >= max - 2, a: i >= 0 ? list[i].key : null, b: i + 1 < list.length ? list[i + 1].key : null, frac: Math.min(1, Math.max(0, (p - A) / Math.max(1, B - A))) };
  }
  function applyScroll(m) {
    const se = document.scrollingElement || document.documentElement, max = Math.max(0, se.scrollHeight - innerHeight);
    anchorCache = null; const list = anchors(); let y;
    const ia = m.a ? list.findIndex(x => x.key === m.a) : -1;
    if (m.top) y = 0; else if (m.bottom) y = max;
    else if (m.a && ia < 0 && !(m.b && list.some(x => x.key === m.b))) y = m.pct * max; // section doesn't exist here
    else {
      let A = ia >= 0 ? list[ia].top : 0, ib = m.b ? list.findIndex(x => x.key === m.b) : -1, B;
      if (m.a && ia < 0) { A = ib > 0 ? list[ib - 1].top : 0; }
      if (ib >= 0 && list[ib].top > A) B = list[ib].top; else { const nx = list.find(x => x.top > A + 1); B = nx ? nx.top : se.scrollHeight; }
      y = A + m.frac * (B - A) - innerHeight * PROBE;
    }
    suppressUntil = now() + 350;
    window.scrollTo({ top: Math.max(0, Math.min(max, y)), behavior: 'instant' });
  }
  let scrollRaf = 0; const elRaf = new Map();
  document.addEventListener('scroll', e => {
    if (!leading()) return;
    const t = e.target;
    if (t === document || t === document.documentElement || t === document.body) {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; if (leading()) act('scroll', scrollState()); });
    } else if (t.nodeType === 1 && !t.closest('form,input,textarea,select,[contenteditable]') && !elRaf.has(t)) {
      elRaf.set(t, requestAnimationFrame(() => {
        elRaf.delete(t); if (!leading()) return;
        act('escroll', { d: { path: elementPath(t) }, px: t.scrollLeft / Math.max(1, t.scrollWidth - t.clientWidth), py: t.scrollTop / Math.max(1, t.scrollHeight - t.clientHeight) });
      }));
    }
  }, true);

  /* ------------------------------ touch emulation ------------------------------ */
  function fireTouch(type, target, x, y) {
    try {
      const t = new Touch({ identifier: 1, target, clientX: x, clientY: y, pageX: x + scrollX, pageY: y + scrollY, screenX: x, screenY: y });
      const live = type === 'touchend' ? [] : [t];
      target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches: live, targetTouches: live, changedTouches: [t] }));
    } catch (e) {}
  }
  function scrollerFor(el, axis) {
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e), o = axis === 'x' ? cs.overflowX : cs.overflowY;
      if (/auto|scroll/.test(o) && (axis === 'x' ? e.scrollWidth > e.clientWidth + 2 : e.scrollHeight > e.clientHeight + 2)) return e;
    }
    return axis === 'y' ? (document.scrollingElement || document.documentElement) : null;
  }
  let drag = null;
  addEventListener('pointerdown', e => {
    if (!cfg.touch || !e.isTrusted || own(e.target) || e.target.closest?.('form,input,textarea,select,[contenteditable]') || e.pointerType !== 'mouse' || e.button !== 0) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    drag = { x: e.clientX, y: e.clientY, target: e.target, axis: null, sc: null, moved: false };
    fireTouch('touchstart', e.target, e.clientX, e.clientY);
  }, true);
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; drag.moved = true;
      drag.sc = scrollerFor(drag.target, drag.axis); if (drag.sc) { drag.sl = drag.sc.scrollLeft; drag.st = drag.sc.scrollTop; }
      getSelection() && getSelection().removeAllRanges();
    }
    mark();
    if (drag.sc) { if (drag.axis === 'x') drag.sc.scrollLeft = drag.sl - dx; else drag.sc.scrollTop = drag.st - dy; }
    fireTouch('touchmove', drag.target, e.clientX, e.clientY);
  }, true);
  const endDrag = e => {
    if (!drag) return; const g = drag; drag = null;
    fireTouch('touchend', g.target, e.clientX, e.clientY);
    if (g.moved) {
      swallowClick = true; setTimeout(() => { swallowClick = false; }, 60);
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.sc && g.axis === 'x' && Math.abs(dx) > 40) act('swipe', { d: { path: elementPath(g.target) }, dx, dy });
    }
  };
  addEventListener('pointerup', endDrag, true); addEventListener('pointercancel', endDrag, true);
  addEventListener('dragstart', e => { if (cfg.touch) e.preventDefault(); }, true);
  // Each screen shows the pointer its device would: a fingertip-sized circle on phones and tablets (as browser
  // device modes do), and a white arrow on desktops and laptops.
  const FINGER = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='14' cy='14' r='12.5' fill='none' stroke='%23000' stroke-opacity='.35'/%3E%3Ccircle cx='14' cy='14' r='11' fill='%23808080' fill-opacity='.45' stroke='%23fff' stroke-opacity='.85' stroke-width='1.5'/%3E%3C/svg%3E\") 14 14, default";
  const ARROW = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M4 2v17.5l4.6-4.3 3.1 7 2.8-1.2-3.1-6.9H18z' fill='%23fff' stroke='%23000' stroke-width='1.3' stroke-linejoin='round'/%3E%3C/svg%3E\") 4 2, default";
  function applyTouchMode() {
    let st = document.getElementById('__samestate_touch');
    if (!st) { st = document.createElement('style'); st.id = '__samestate_touch'; document.documentElement.appendChild(st); }
    // Touch: the circle everywhere, as a finger has no hover states. Mouse: only the plain arrow is replaced,
    // so links keep the hand and form fields keep the I-beam.
    st.textContent = cfg.touch
      ? 'html{-webkit-user-select:none;user-select:none}input,textarea{-webkit-user-select:text;user-select:text}html,html *,html *::before,html *::after{cursor:' + FINGER + ' !important}'
      : 'html{cursor:' + ARROW + '}';
  }

  /* --------------------------- replaying remote acts --------------------------- */
  let hoverEl = null;
  const handlers = {
    media: applyPlayback,
    field: m => applyField(m),
    navigate: m => followAddress(m.url),
    async click(m) {
      let { el, status } = await findTarget(m.d);
      // A control inside a menu or drawer that is still opening (for example, the previous mirrored
      // click just opened it) is not visible yet. Wait for it instead of giving up, and finish
      // running animations, since background frames may not advance them.
      for (let tries = 0; !el && tries < 8; tries++) {
        await sleep(150);
        finishAnimations();
        ({ el, status } = await findTarget(m.d));
      }
      // The control may live behind a closed menu on this screen size (a desktop nav item that sits
      // in the hamburger menu on tablets and phones). Open the menu and look again; close it if the
      // control still is not there.
      let opened = null;
      if (!el && !demo && m.d.nav && (opened = menuToggle())) {
        press(opened);
        for (let tries = 0; !el && tries < 6; tries++) {
          await sleep(150);
          finishAnimations();
          ({ el, status } = await findTarget(m.d));
        }
        if (el) status = 'revealed';
        else closeMenu(opened);
      }
      if (!el) return { status };
      if (m.expanded !== null && el.matches(m.expanded ? '[aria-expanded=true]' : '[aria-expanded=false]')) return { status: 'skip' };
      if (m.open !== null && el.matches('details > summary') && el.parentElement.open === m.open) return { status: 'skip' };
      if (typeof m.pressed === 'string' && el.getAttribute('aria-pressed') === m.pressed) return { status: 'skip' }; // toggle is already in that state
      try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
      flash(el);
      // A link that acted as a button on the leading screen must not open a page here, even if this page lets it.
      if (m.d.link) addEventListener('click', event => { if (event.target === el || el.contains(event.target)) event.preventDefault(); }, { once: true });
      press(el);
      return { status };
    },
    scroll(m) { applyScroll(m); return null; },
    escroll(m) {
      const el = locate(m.d.path); if (!el) return null; suppressUntil = now() + 350;
      el.scrollLeft = m.px * (el.scrollWidth - el.clientWidth); el.scrollTop = m.py * (el.scrollHeight - el.clientHeight); return null;
    },
    swipe(m) {
      if (!cfg.touch) return { status: 'skip', note: 'swipe has no mouse equivalent here' };
      const el = locate(m.d.path); if (!el || !visible(el)) return { status: 'none', note: 'swipe target not found' };
      const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      fireTouch('touchstart', el, x, y); for (let i = 1; i <= 4; i++) fireTouch('touchmove', el, x + m.dx * i / 4, y + m.dy * i / 4); fireTouch('touchend', el, x + m.dx, y + m.dy);
      return { status: 'direct', note: 'swiped ' + (m.dx < 0 ? 'left' : 'right') };
    },
    hover(m) {
      handlers.unhover();
      const el = matchingControls(m.d).find(visible); if (!el) return null;
      hoverEl = el; hoverRing = ring(hoverEl, '#4da3ff', 0);
      hoverEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); hoverEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      return null;
    },
    unhover() {
      if (hoverRing) { hoverRing.remove(); hoverRing = null; }
      if (hoverEl) { hoverEl.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); hoverEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false })); hoverEl = null; }
      return null;
    }
  };

  function hiddenReason(el, vw, vh) {
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a), r = a.getBoundingClientRect();
      if (+cs.opacity === 0 && a !== el) return 'transparent'; // a see-through control over its own styled box (custom selects, checkboxes) is fine
      if (cs.position === 'fixed' && (r.right <= 0 || r.left >= vw || r.bottom <= 0 || r.top >= vh)) return 'off-screen panel';
      if (a !== el && /hidden|clip/.test(cs.overflowY) && r.height < 2) return 'collapsed panel';
    }
    return null;
  }

  /* --------------------------- test modes and fix previews --------------------------- */
  // Long text: every visible text node grows by about a third, with accented vowels, as translations often do.
  let longText = null; // text node → its original text
  const ACCENTS = { a: 'á', e: 'é', i: 'î', o: 'ö', u: 'ü', A: 'Á', E: 'É', I: 'Î', O: 'Ö', U: 'Ü' };
  const FILLER = 'lörem ipsüm dölor sit amét cönsectetür adipiscing élit ';
  function setLongText(on) {
    if (on === !!longText) return;
    if (!on) { for (const [node, text] of longText) if (node.isConnected) node.data = text; longText = null; return; }
    longText = new Map();
    const skip = privateContent + ',samestate-layer';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: node => !node.data.trim() || node.parentElement?.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    for (let node, n = 0; (node = walker.nextNode()) && n < 5000; n++) {
      const text = node.data, extra = Math.max(2, Math.round(text.trim().length * .35));
      longText.set(node, text);
      node.data = text.replace(/[aeiouAEIOU]/g, c => ACCENTS[c]).replace(/(\S)(\s*)$/, '$1 ' + FILLER.repeat(Math.ceil(extra / FILLER.length)).slice(0, extra).trim() + '$2');
    }
  }

  // Screen settings: a forced media setting (dark or light, reduced motion, more contrast, print) or 200% text.
  // The page's media rules are rewritten in the stylesheets it can read (its own and inline ones); scripts that
  // ask matchMedia() still get the computer's answer.
  let variant = '', mediaEdits = [], textEdit = null;
  const SCHEME = /\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi;
  const feature = (pattern, on) => text => text.replace(pattern, (match, value) => on((value || '').toLowerCase()) ? '(min-width: 0px)' : '(max-width: 0px)');
  // A query that names a media type: print and "not screen" now match, screen and "not print" don't.
  function printQuery(query) {
    const m = /^\s*(not\s+|only\s+)?(print|screen|speech)\b/i.exec(query);
    if (!m) return query; // no type, or "all": it applies to print as well
    const negated = /^not/i.test(m[1] || ''), isPrint = m[2].toLowerCase() === 'print', rest = query.slice(m[0].length);
    if (negated) return isPrint ? 'not all' + rest : 'all';
    return isPrint ? 'all' + rest : 'not all';
  }
  const REWRITES = {
    dark: feature(SCHEME, value => value === 'dark'),
    light: feature(SCHEME, value => value === 'light'),
    motion: feature(/\(\s*prefers-reduced-motion\s*(?::\s*([a-z-]+)\s*)?\)/gi, value => value !== 'no-preference'),
    contrast: feature(/\(\s*prefers-contrast\s*(?::\s*([a-z-]+)\s*)?\)/gi, value => value === '' || value === 'more'),
    print: text => text.split(',').map(printQuery).join(','),
    forced: feature(/\(\s*forced-colors\s*(?::\s*([a-z-]+)\s*)?\)/gi, value => value !== 'none'),
    reduceddata: feature(/\(\s*prefers-reduced-data\s*(?::\s*([a-z-]+)\s*)?\)/gi, value => value !== 'no-preference'),
    transparency: feature(/\(\s*prefers-reduced-transparency\s*(?::\s*([a-z-]+)\s*)?\)/gi, value => value !== 'no-preference'),
    gamut: feature(/\(\s*color-gamut\s*:\s*([a-z0-9-]+)\s*\)/gi, value => value === 'srgb' || value === 'p3'),
  };
  let screenLang = '', docEdit = null; // the language for the "lang" setting; the html element's dir and lang before a change
  const VARIANTS = [...Object.keys(REWRITES), 'text200', 'rtl', 'lang'];
  function editMedia(rewrite) {
    const visit = rules => {
      for (const rule of rules) {
        if (rule.media && (rule.cssRules || rule.styleSheet)) {
          const text = rule.media.mediaText, next = rewrite(text);
          if (next !== text) { mediaEdits.push([rule.media, text]); rule.media.mediaText = next; }
        }
        if (rule.cssRules) visit(rule.cssRules);
        if (rule.styleSheet) { try { visit(rule.styleSheet.cssRules); } catch {} }
      }
    };
    for (const sheet of document.styleSheets) { try { visit(sheet.cssRules); } catch {} } // other sites' stylesheets can't be read
    for (const el of document.querySelectorAll('link[media],source[media],style[media]')) {
      const media = el.getAttribute('media'), next = rewrite(media);
      if (next !== media) { mediaEdits.push([el, media]); el.setAttribute('media', next); }
    }
  }
  function setVariant(next) {
    if (next === variant) return;
    for (const [target, text] of mediaEdits.reverse()) { try { if (target instanceof Element) target.setAttribute('media', text); else target.mediaText = text; } catch {} }
    mediaEdits = [];
    if (textEdit) { const de = document.documentElement; if (textEdit.value) de.style.setProperty('font-size', textEdit.value, textEdit.priority); else de.style.removeProperty('font-size'); textEdit = null; }
    document.documentElement.style.removeProperty('color-scheme');
    if (docEdit) { const de = document.documentElement; for (const [name, value] of Object.entries(docEdit)) { if (value === null) de.removeAttribute(name); else de.setAttribute(name, value); } docEdit = null; }
    variant = next;
    if (variant === 'rtl' || (variant === 'lang' && screenLang)) {
      const de = document.documentElement, name = variant === 'rtl' ? 'dir' : 'lang';
      docEdit = { [name]: de.getAttribute(name) };
      de.setAttribute(name, variant === 'rtl' ? 'rtl' : screenLang);
    }
    if (REWRITES[variant]) editMedia(REWRITES[variant]);
    if (variant === 'dark' || variant === 'light') document.documentElement.style.setProperty('color-scheme', variant);
    if (variant === 'text200') {
      const de = document.documentElement;
      textEdit = { value: de.style.getPropertyValue('font-size'), priority: de.style.getPropertyPriority('font-size') };
      de.style.setProperty('font-size', parseFloat(getComputedStyle(de).fontSize) * 2 + 'px', 'important'); // what a 200% browser text size does to rem and em
    }
  }

  // Fix previews: the suggested CSS is set on the elements of one finding, and taken off again with Undo.
  const fixes = new Map(); // fix id → [{ el, style }]
  function applyFix(id, keys, declarations) {
    if (fixes.has(id) || !declarations || typeof declarations !== 'object') return 0;
    const changed = [];
    for (const key of keys || []) for (const el of snapMap.get(key) || []) {
      if (!el.isConnected || changed.some(c => c.el === el)) continue;
      changed.push({ el, style: el.getAttribute('style') });
      for (const [property, value] of Object.entries(declarations)) if (typeof value === 'string') el.style.setProperty(property, value, 'important');
    }
    fixes.set(id, changed);
    return changed.length;
  }
  function removeFix(id) {
    for (const { el, style } of (fixes.get(id) || []).reverse()) { if (style === null) el.removeAttribute('style'); else el.setAttribute('style', style); }
    fixes.delete(id);
  }

  /* ------------------------------ page weight ------------------------------ */
  // Reads only the browser's resource timing: each request's address, its type and its size.
  // Query strings and fragments are dropped, and path segments that look like IDs become ":id".
  // Request and response contents are never read.
  const ownScript = tag?.src ? tag.src.split(/[?#]/)[0] : '';
  function requestAddress(url) {
    try {
      const u = new URL(url, location.href);
      if (!/^https?:$/.test(u.protocol)) return null;
      const path = u.pathname.split('/').map(part => /^\d{3,}$|^[0-9a-f-]{16,}$|@|^[A-Za-z0-9_-]{24,}$/i.test(part) ? ':id' : part).join('/');
      return u.origin + path;
    } catch { return null; }
  }
  function requests() {
    const out = [];
    const add = (entry, type) => {
      const url = requestAddress(entry.name);
      if (!url || url === ownScript || (demo && /\/(agent|emulate)\.js$/.test(url))) return;
      // encodedBodySize counts a body served from cache too; both are 0 for other sites without Timing-Allow-Origin.
      out.push({ url, type, bytes: entry.encodedBodySize || entry.transferSize || 0 });
    };
    const page = performance.getEntriesByType('navigation')[0];
    if (page) add(page, 'document');
    for (const entry of performance.getEntriesByType('resource')) { if (out.length >= 800) break; add(entry, entry.initiatorType || 'other'); }
    return out;
  }

  /* --------------------------- accessibility facts --------------------------- */
  // Colors are painted on a 1px canvas, so any CSS color (oklch, color-mix…) reads back as sRGB.
  const colorCache = new Map(); let colorCtx = null;
  function rgba(color) {
    if (colorCache.has(color)) return colorCache.get(color);
    let out = null;
    try {
      colorCtx ??= new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true });
      colorCtx.clearRect(0, 0, 1, 1); colorCtx.fillStyle = '#000'; colorCtx.fillStyle = color; colorCtx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = colorCtx.getImageData(0, 0, 1, 1).data; out = [r, g, b, a / 255];
    } catch {}
    if (colorCache.size < 500) colorCache.set(color, out);
    return out;
  }
  const over = (top, under) => [0, 1, 2].map(c => top[c] * top[3] + under[c] * (1 - top[3]));
  const luminance = rgb => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const MEDIA = 'img,picture,video,canvas,svg,iframe';
  // The text's color against the backgrounds painted under it. Unknown (null) over images, gradients and video.
  function contrastOf(el, cs, mediaUnder) {
    const fg = rgba(cs.color); if (!fg || fg[3] === 0) return null;
    const layers = []; let base = null;
    for (let a = el; a; a = a.parentElement) {
      const acs = a === el ? cs : getComputedStyle(a);
      if (acs.backgroundImage !== 'none') return null;
      const bg = rgba(acs.backgroundColor);
      if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= .99) { base = a; break; } }
    }
    const scope = base || document.body;
    if (scope) {
      if (!mediaUnder.has(scope)) mediaUnder.set(scope, Array.from(scope.querySelectorAll(MEDIA)).slice(0, 200).filter(m => !m.closest('samestate-layer')).map(m => m.getBoundingClientRect()).filter(r => r.width > 1 && r.height > 1));
      const r = el.getBoundingClientRect();
      if (mediaUnder.get(scope).some(m => m.left < r.right && m.right > r.left && m.top < r.bottom && m.bottom > r.top)) return null;
    }
    let bg = getComputedStyle(document.documentElement).colorScheme.trim() === 'dark' ? [18, 18, 18] : [255, 255, 255]; // the browser's canvas
    for (const layer of layers.reverse()) bg = over(layer, bg);
    const text = over(fg, bg), [hi, lo] = [luminance(text), luminance(bg)].sort((x, y) => y - x);
    return Math.round((hi + .05) / (lo + .05) * 10) / 10;
  }
  function hasName(el) {
    if (el.closest('[data-samestate-private]')) return true; // its text is not read, so it is not judged
    if (clean(el.getAttribute('aria-label')) || clean(el.getAttribute('title'))) return true;
    const by = el.getAttribute('aria-labelledby');
    if (by && by.split(/\s+/).some(id => clean(document.getElementById(id)?.textContent))) return true;
    if (el.labels?.length && [...el.labels].some(l => clean(l.textContent))) return true;
    if (el.matches('input[type=button],input[type=submit],input[type=reset]')) return !!clean(el.value) || el.type !== 'button';
    if (el.matches('input[type=image]')) return !!clean(el.getAttribute('alt'));
    if (el.matches(FIELD)) return !!clean(el.getAttribute('placeholder'));
    if (clean(el.textContent)) return true;
    return [...el.querySelectorAll('img[alt],svg title,[aria-label]')].some(x => clean(x.getAttribute('alt') || x.getAttribute('aria-label') || x.textContent));
  }
  function zoomBlocked() {
    const content = document.querySelector('meta[name=viewport]')?.getAttribute('content') || '';
    const max = /maximum-scale\s*=\s*([\d.]+)/i.exec(content);
    return /user-scalable\s*=\s*(no|0)\b/i.test(content) || (!!max && parseFloat(max[1]) < 2);
  }

  /* ------------------------------ Web Vitals ------------------------------ */
  // Largest contentful paint, cumulative layout shift (largest 5 s session window) and the slowest interaction.
  // Shifts right after Samestate changes a preview (a mirrored click, a setting) are left out.
  const vitals = { lcp: 0, cls: 0, inp: 0 }, shiftNodes = [];
  let quietUntil = 0, shiftSession = { value: 0, first: 0, last: 0 };
  function observe(type, fn, extra) { try { new PerformanceObserver(list => list.getEntries().forEach(fn)).observe({ type, buffered: true, ...extra }); } catch {} }
  observe('largest-contentful-paint', e => { vitals.lcp = e.renderTime || e.loadTime || e.startTime; });
  observe('layout-shift', e => {
    if (e.hadRecentInput || e.startTime < quietUntil) return;
    if (e.startTime - shiftSession.last > 1000 || e.startTime - shiftSession.first > 5000) shiftSession = { value: 0, first: e.startTime, last: e.startTime };
    shiftSession.value += e.value; shiftSession.last = e.startTime;
    vitals.cls = Math.max(vitals.cls, shiftSession.value);
    for (const source of e.sources || []) if (source.node?.nodeType === 1 && !shiftNodes.some(r => r.deref() === source.node) && shiftNodes.length < 6) shiftNodes.push(new WeakRef(source.node));
  });
  observe('event', e => { if (e.interactionId && e.startTime >= quietUntil) vitals.inp = Math.max(vitals.inp, e.duration); }, { durationThreshold: 40 });

  /* ------------------------------ link check ------------------------------ */
  // Asks this site for each same-origin link with a HEAD request, without cookies, so a link cannot act on the
  // tester's account. Links that look like actions (sign out, delete…) are skipped. Answers are kept per page.
  const linkStatus = new Map();
  const ACTION_PATH = /log-?out|sign-?out|delete|remove|destroy|unsubscribe|cancel/i;
  async function checkLinks(reg, limit = 60, ms = 5000) {
    const anchors = new Map();
    for (const a of document.querySelectorAll('a[href]')) {
      if (anchors.size >= limit) break;
      if (a.closest('samestate-layer') || a.hasAttribute('download')) continue;
      let u; try { u = new URL(a.href); } catch { continue; }
      if (u.origin !== location.origin || !/^https?:$/.test(u.protocol) || ACTION_PATH.test(u.pathname)) continue;
      u.hash = '';
      if (u.href === location.href.split('#')[0]) continue;
      if (!anchors.has(u.href)) anchors.set(u.href, []);
      anchors.get(u.href).push(a);
    }
    const urls = [...anchors.keys()], deadline = now() + ms;
    const ask = async url => {
      if (linkStatus.has(url)) return;
      try {
        const r = await fetch(url, { method: 'HEAD', credentials: 'omit', redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(Math.max(500, deadline - now())) });
        linkStatus.set(url, r.status);
      } catch { /* timed out or blocked: not judged */ }
    };
    let next = 0;
    await Promise.all(Array.from({ length: 6 }, async () => { while (next < urls.length && now() < deadline) await ask(urls[next++]); }));
    const broken = [];
    for (const url of urls) {
      const status = linkStatus.get(url);
      if (!(status === 404 || status === 410 || status >= 500 && status !== 501)) continue; // 401, 403 and 405 can be right without cookies or for HEAD
      const address = requestAddress(url); // links that differ only in their query string read the same, so they are listed once
      let entry = broken.find(b => b.url === address && b.status === status);
      if (!entry) { entry = { key: 'bl|' + broken.length, url: address, status }; broken.push(entry); }
      anchors.get(url).forEach(a => reg(entry.key, a));
    }
    return { checked: urls.filter(url => linkStatus.has(url)).length, total: urls.length, broken };
  }

  /* ------------------------------ debug tools ------------------------------ */
  // Chosen per screen from the Debug menu. Style tools inject CSS; overlay tools draw boxes and labels in a
  // host inside samestate-layer, which snapshots skip. Cursor simulators are an overlay that follows the pointer.
  const DEBUG_TOOLS = new Set(['layout', 'zindex', 'reach-right', 'reach-left', 'contrast', 'focus', 'target', 'smalltext', 'spacing', 'roles', 'aria', 'hover', 'focusvisible', 'edit', 'hostile', 'audible', 'nocss', 'noimages', 'nocursor', 'rulers', 'columns', 'baseline', 'measure', 'peek', 'readability', 'textlen']);
  const CURSOR_SIMS = new Set(['glaucoma', 'tunnel', 'macular', 'cmv']);
  const OVERLAY_TOOLS = ['layout', 'zindex', 'contrast', 'focus', 'target', 'smalltext', 'roles', 'aria'];
  const DEBUG_CSS = {
    layout: '*{outline:1px solid rgba(236,72,153,.55)!important;outline-offset:-1px!important}samestate-layer,samestate-layer *{outline:none!important}',
    spacing: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}',
    hostile: ':where(p,li,span,a,label,td,th,dt,dd,blockquote,figcaption){color:#c026d3;font-family:"Comic Sans MS","Comic Neue",cursive;text-decoration:underline wavy #f59e0b}'
      + ':where(div,section,article,aside,nav,header,footer,main,form,ul,ol){margin:4px;padding:4px;border:1px dashed #f97316;background:#fef9c3}'
      + ':where(button,input,select,textarea){border:3px double #16a34a;border-radius:0;font:italic 15px Georgia,serif;background:#dcfce7;color:#14532d}'
      + ':where(h1,h2,h3,h4,h5,h6){font-family:Impact,fantasy;letter-spacing:.2em;text-transform:uppercase;color:#dc2626}:where(img,video,svg){border:4px solid #ef4444}',
    noimages: 'img,picture,video,canvas,svg:not(samestate-layer svg),object,embed{visibility:hidden!important}*:not(samestate-layer):not(samestate-layer *){background-image:none!important}',
    nocursor: '*,*::before,*::after{cursor:none!important}',
  };
  const debug = { tools: new Set(), sim: '' };
  let debugStyle = null, forcedStyle = null, debugHost = null, simLayer = null, cssOff = null, debugObserver = null;
  let drawQueued = false, drawTimer = 0, lastChange = 0, pointer = null;
  const own = node => { const el = node?.nodeType === 1 ? node : node?.parentElement; return !!el && (el.tagName === 'SAMESTATE-LAYER' || el.tagName === 'SAMESTATE-DESIGN' || !!el.closest?.('samestate-layer') || !!el.getRootNode?.().host?.closest?.('samestate-layer') || el === debugStyle || el === forcedStyle); };

  function hostEl() {
    if (!debugHost || !debugHost.isConnected) { debugHost = document.createElement('div'); debugHost.dataset.samestateDebug = ''; getLayer().appendChild(debugHost); }
    return debugHost;
  }
  // A box around an element with a small label above it, in page coordinates.
  function markBox(host, r, color, label) {
    const box = document.createElement('div');
    box.style.cssText = `position:absolute;box-sizing:border-box;left:${r.left + scrollX}px;top:${r.top + scrollY}px;width:${Math.max(2, r.width)}px;height:${Math.max(2, r.height)}px;border:1.5px solid ${color};background:${color}14;pointer-events:none`;
    if (label) {
      const tag = document.createElement('span');
      tag.textContent = label;
      tag.style.cssText = `position:absolute;left:-1.5px;${r.top > 16 ? 'bottom:100%' : 'top:100%'};max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:1px 4px;background:${color};color:#fff;font:600 10px/14px ui-monospace,SFMono-Regular,Menlo,monospace;border-radius:2px;letter-spacing:0;text-transform:none`;
      box.appendChild(tag);
    }
    host.appendChild(box);
  }
  const hasOwnText = el => Array.from(el.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.data.trim());
  const TEXT_SEL = 'p,li,h1,h2,h3,h4,h5,h6,a,button,label,span,td,th,dt,dd,figcaption,blockquote,summary,strong,em,small,b,i,div';
  const TARGETS = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=checkbox],[role=radio],[role=switch],[role=tab],[role=menuitem]';

  function drawDebug() {
    const host = hostEl(); host.replaceChildren();
    const t = debug.tools;
    if (!OVERLAY_TOOLS.some(id => t.has(id)) || !document.body) return;
    const vw = document.documentElement.clientWidth, vh = innerHeight, mediaUnder = new Map();
    let marks = 0;
    const inView = r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < Math.max(vw, innerWidth);
    const each = (selector, fn, limit = 2500) => {
      let n = 0;
      for (const el of document.body.querySelectorAll(selector)) {
        if (++n > limit || marks >= 400) break;
        if (own(el)) continue;
        const r = el.getBoundingClientRect();
        if (inView(r)) fn(el, r);
      }
    };
    const mark = (r, color, label) => { if (marks++ < 400) markBox(host, r, color, label); };
    if (t.has('layout')) each('*', (el, r) => {
      if (r.right <= vw + 1 || !visible(el)) return;
      const parent = el.parentElement;
      if (parent && parent !== document.body && parent.getBoundingClientRect().right > vw + 1) return; // the outermost one is the cause
      mark(r, '#ef4444', '+' + Math.round(r.right - vw) + 'px');
    }, 4000);
    if (t.has('zindex')) each('*', (el, r) => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'static' && cs.zIndex !== 'auto' && visible(el)) mark(r, '#7c3aed', 'z ' + cs.zIndex);
    }, 4000);
    if (t.has('contrast')) each(TEXT_SEL, (el, r) => {
      if (!hasOwnText(el) || el.disabled || !visible(el)) return;
      const cs = getComputedStyle(el), size = parseFloat(cs.fontSize);
      const ratio = contrastOf(el, cs, mediaUnder), large = size >= 24 || (size >= 18.6 && Number(cs.fontWeight) >= 700);
      if (ratio && ratio < (large ? 3 : 4.5)) mark(r, '#dc2626', `${ratio}:1 needs ${large ? 3 : 4.5}:1`);
    });
    if (t.has('smalltext')) each(TEXT_SEL + ',input,select,textarea', (el, r) => {
      const field = el.matches('input,select,textarea');
      if ((!field && !hasOwnText(el)) || !visible(el)) return;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < (field ? 16 : 12)) mark(r, '#ea580c', Math.round(size * 10) / 10 + 'px');
    });
    if (t.has('target')) each(TARGETS, (el, r) => {
      if (!visible(el)) return;
      const inline = el.matches('a') && getComputedStyle(el).display === 'inline' && hasOwnText(el.parentElement); // links in a sentence are exempt in WCAG 2.5.8
      const side = Math.min(r.width, r.height);
      if (inline || side >= 44) return;
      mark(r, side < 24 ? '#dc2626' : '#d97706', `${Math.round(r.width)}×${Math.round(r.height)}`);
    });
    if (t.has('roles')) each('[role]', (el, r) => { if (visible(el)) mark(r, '#0d9488', 'role=' + el.getAttribute('role')); });
    if (t.has('aria')) each('*', (el, r) => {
      const names = el.getAttributeNames().filter(name => name.startsWith('aria-'));
      if (names.length && visible(el)) mark(r, '#2563eb', names.map(name => `${name}="${clean(el.getAttribute(name), 30)}"`).join(' '));
    }, 4000);
    if (t.has('focus')) {
      let a = document.activeElement;
      while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
      if (a && a !== document.body && a !== document.documentElement) {
        const r = a.getBoundingClientRect();
        if (r.width || r.height) mark(r, '#0ea5e9', `${roleOf(a)}: ${nameOf(a) || 'no name'}`);
      }
    }
  }
  function queueDraw() {
    if (drawQueued || !OVERLAY_TOOLS.some(id => debug.tools.has(id))) return;
    drawQueued = true;
    const run = () => { if (!drawQueued) return; drawQueued = false; drawDebug(); };
    requestAnimationFrame(run); setTimeout(run, 120); // frames pause in a hidden tab; the timer still redraws
  }
  addEventListener('scroll', queueDraw, { capture: true, passive: true });
  addEventListener('resize', queueDraw);
  addEventListener('focusin', () => { if (debug.tools.has('focus')) queueDraw(); });
  addEventListener('focusout', () => { if (debug.tools.has('focus')) setTimeout(queueDraw, 0); });
  // Focus can also move without focus events reaching this frame (a script, or a frame without window focus).
  let focusSeen = null, focusTimer = 0;
  function watchFocus() {
    clearInterval(focusTimer);
    if (debug.tools.has('focus')) focusTimer = setInterval(() => { if (document.activeElement !== focusSeen) { focusSeen = document.activeElement; queueDraw(); } }, 250);
  }

  function watchChanges() {
    const need = debug.tools.has('audible') || OVERLAY_TOOLS.some(id => debug.tools.has(id));
    if (!need) { debugObserver?.disconnect(); debugObserver = null; return; }
    if (debugObserver) return;
    debugObserver = new MutationObserver(records => {
      if (records.every(record => own(record.target))) return;
      if (debug.tools.has('audible') && now() - lastChange > 120) { lastChange = now(); send('changed'); }
      clearTimeout(drawTimer); drawTimer = setTimeout(queueDraw, 200);
    });
    debugObserver.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
  }

  // Apply all hover / focus-visible styling: copies of the page's rules with the pseudo-class taken out.
  function forcedRules(pattern) {
    const out = [];
    const strip = selector => selector.replace(new RegExp('(^|[\\s>+~,(])(?:' + pattern + ')(?![\\w-])', 'g'), '$1*').replace(new RegExp('(?:' + pattern + ')(?![\\w-])', 'g'), '');
    const visit = (rules, wrap) => {
      for (const rule of rules) {
        if (out.length > 3000) return;
        if (rule instanceof CSSStyleRule && new RegExp('(?:' + pattern + ')(?![\\w-])').test(rule.selectorText)) out.push(wrap(`${strip(rule.selectorText)}{${rule.style.cssText}}`));
        else if (rule instanceof CSSMediaRule) visit(rule.cssRules, text => wrap(`@media ${rule.conditionText}{${text}}`));
        else if (rule instanceof CSSSupportsRule) visit(rule.cssRules, text => wrap(`@supports ${rule.conditionText}{${text}}`));
        else if (rule.cssRules && rule instanceof CSSLayerBlockRule) visit(rule.cssRules, wrap);
      }
    };
    for (const sheet of document.styleSheets) { if (sheet.ownerNode === forcedStyle || sheet.ownerNode === debugStyle) continue; try { visit(sheet.cssRules, text => text); } catch {} } // other sites' stylesheets can't be read
    return out.join('\n');
  }

  function disableCss(on) {
    if (on && !cssOff) {
      cssOff = { sheets: [], styles: [], adopted: document.adoptedStyleSheets };
      for (const sheet of document.styleSheets) {
        const owner = sheet.ownerNode;
        if (sheet.disabled || owner === debugStyle || owner === forcedStyle || own(owner)) continue;
        sheet.disabled = true; cssOff.sheets.push(sheet);
      }
      for (const el of document.querySelectorAll('body [style]')) { if (own(el)) continue; cssOff.styles.push([el, el.getAttribute('style')]); el.removeAttribute('style'); }
      try { document.adoptedStyleSheets = []; } catch {}
    } else if (!on && cssOff) {
      for (const sheet of cssOff.sheets) sheet.disabled = false;
      for (const [el, style] of cssOff.styles) if (el.isConnected && !el.hasAttribute('style')) el.setAttribute('style', style);
      try { document.adoptedStyleSheets = cssOff.adopted; } catch {}
      cssOff = null;
    }
  }

  // Simulators that follow the pointer: glaucoma, tunnel vision, macular degeneration; CMV retinitis is static.
  const SPECKS = Array.from({ length: 14 }, (_, i) => {
    const x = (i * 37 + 11) % 100, y = (i * 53 + 23) % 100, s = 18 + (i * 29) % 46;
    return `radial-gradient(circle at ${x}% ${y}%, rgba(20,20,20,.88) 0, rgba(20,20,20,.65) ${s * .45}px, transparent ${s}px)`;
  }).join(',');
  let reachLayer = null;
  function overlayDiv(current) {
    if (current?.isConnected) return current;
    const div = document.createElement('div'); getLayer().appendChild(div); return div;
  }
  function drawSim() {
    const reach = debug.tools.has('reach-right') ? '85%' : debug.tools.has('reach-left') ? '15%' : '';
    if (reach) {
      reachLayer = overlayDiv(reachLayer);
      reachLayer.style.cssText = `position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse 125% 80% at ${reach} 100%, rgba(34,197,94,.32) 0 45%, rgba(234,179,8,.32) 45% 68%, rgba(239,68,68,.32) 68%)`;
    } else { reachLayer?.remove(); reachLayer = null; }
    if (!CURSOR_SIMS.has(debug.sim)) { simLayer?.remove(); simLayer = null; return; }
    simLayer = overlayDiv(simLayer);
    const x = pointer ? pointer.x + 'px' : '50%', y = pointer ? pointer.y + 'px' : '50%';
    let css = 'position:fixed;inset:0;pointer-events:none;';
    if (debug.sim === 'tunnel') css += `background:radial-gradient(circle at ${x} ${y}, transparent 0, transparent 70px, rgba(0,0,0,.97) 150px)`;
    else if (debug.sim === 'glaucoma') { const m = `radial-gradient(circle at ${x} ${y}, transparent 0, transparent 90px, #000 230px)`; css += `backdrop-filter:blur(7px) brightness(.55);-webkit-mask-image:${m};mask-image:${m}`; }
    else if (debug.sim === 'macular') { const m = `radial-gradient(circle at ${x} ${y}, #000 0, #000 45px, transparent 120px)`; css += `backdrop-filter:blur(14px) brightness(.6) saturate(.4);background:rgba(70,70,70,.35);-webkit-mask-image:${m};mask-image:${m}`; }
    else if (debug.sim === 'cmv') css += `backdrop-filter:blur(.8px);background:${SPECKS}`;
    simLayer.style.cssText = css;
  }
  addEventListener('pointermove', e => { if (!simLayer) return; pointer = { x: e.clientX, y: e.clientY }; drawSim(); }, { passive: true });

  function setDebug(tools, sim) {
    const next = new Set(tools.filter(id => DEBUG_TOOLS.has(id)));
    if (next.has('reach-right')) next.delete('reach-left');
    const forcedBefore = ['hover', 'focusvisible'].filter(id => debug.tools.has(id)).join();
    debug.tools = next;
    debug.sim = CURSOR_SIMS.has(sim) ? sim : '';
    const css = Object.entries(DEBUG_CSS).filter(([id]) => next.has(id)).map(([, text]) => text).join('\n');
    if (css) { debugStyle ??= document.createElement('style'); debugStyle.textContent = css; if (!debugStyle.isConnected) document.documentElement.append(debugStyle); }
    else debugStyle?.remove();
    const forced = ['hover', 'focusvisible'].filter(id => next.has(id)).join();
    if (forced !== forcedBefore || (forced && !forcedStyle?.isConnected)) {
      forcedStyle?.remove();
      const pattern = [next.has('hover') && ':hover', next.has('focusvisible') && ':focus-visible|:focus'].filter(Boolean).join('|');
      if (pattern) { forcedStyle ??= document.createElement('style'); forcedStyle.textContent = ''; forcedStyle.textContent = forcedRules(pattern); document.documentElement.append(forcedStyle); }
    }
    disableCss(next.has('nocss'));
    const editing = next.has('edit') ? 'on' : 'off';
    if (document.designMode !== editing && (editing === 'on' || debug.wasEditing)) document.designMode = editing;
    debug.wasEditing = editing === 'on';
    watchChanges(); watchFocus(); drawSim(); drawDebug();
    drawRulers(); drawGrids(); drawMeasure(); drawReadability();
    if (!next.has('peek')) { peekTip?.remove(); peekTip = null; }
    if (!next.has('textlen')) { selectionTip?.remove(); selectionTip = null; }
  }

  /* ------------------------- page facts: meta, outline, errors ------------------------- */
  // Read locally. Meta values are shown in Samestate's Meta panel; the report itself only carries counts, lengths,
  // tag names and fixed phrases, never the page's text.
  function pageMeta() {
    const q = (sel, attr = 'content') => (document.querySelector(sel)?.getAttribute(attr) || '').trim();
    const abs = value => { try { return value ? new URL(value, location.href).href : ''; } catch { return ''; } };
    const counts = new Map();
    for (const m of document.querySelectorAll('meta[name],meta[property]')) {
      const key = (m.getAttribute('property') || m.getAttribute('name')).toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const jsonld = [];
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { const data = JSON.parse(s.textContent); for (const item of [].concat(data?.['@graph'] || data)) if (item?.['@type']) jsonld.push([].concat(item['@type']).join(', ')); }
      catch { jsonld.push('invalid JSON'); }
    }
    const ogImage = q('meta[property="og:image"]') || q('meta[name="og:image"]');
    return {
      url: location.href, title: clean(document.title, 300), description: clean(q('meta[name=description]'), 400),
      og: { title: clean(q('meta[property="og:title"]'), 300), description: clean(q('meta[property="og:description"]'), 400), image: abs(ogImage), imageRelative: !!ogImage && !/^https?:\/\//i.test(ogImage), url: q('meta[property="og:url"]'), type: q('meta[property="og:type"]'), siteName: clean(q('meta[property="og:site_name"]'), 100), imageAlt: !!q('meta[property="og:image:alt"]') },
      twitter: { card: q('meta[name="twitter:card"]'), title: clean(q('meta[name="twitter:title"]'), 300), description: clean(q('meta[name="twitter:description"]'), 400), image: abs(q('meta[name="twitter:image"]')), site: q('meta[name="twitter:site"]') },
      canonical: q('link[rel=canonical]', 'href'), icon: abs(q('link[rel~=icon]', 'href')) || abs('/favicon.ico'), hasIcon: !!document.querySelector('link[rel~=icon]'),
      appleIcon: !!document.querySelector('link[rel=apple-touch-icon]'), manifest: !!document.querySelector('link[rel=manifest]'), themeColor: q('meta[name=theme-color]'),
      robots: q('meta[name=robots]'), charset: !!document.querySelector('meta[charset]') || /charset/i.test(q('meta[http-equiv="Content-Type" i]')),
      lang: document.documentElement.getAttribute('lang') || '',
      duplicates: [...counts].filter(([key, n]) => n > 1 && !/^(og:image|og:locale:alternate|article:tag|og:video|og:audio)/.test(key)).map(([key]) => key),
      jsonld,
    };
  }

  const VAGUE = /^(click here|here|read more|more|learn more|link|this|go|details|continue|more info|see more|this link|click)$/i;
  const AUTOCOMPLETE = new Set(('on off name honorific-prefix given-name additional-name family-name honorific-suffix nickname email username new-password current-password one-time-code '
    + 'organization-title organization street-address address-line1 address-line2 address-line3 address-level4 address-level3 address-level2 address-level1 country country-name postal-code '
    + 'cc-name cc-given-name cc-additional-name cc-family-name cc-number cc-exp cc-exp-month cc-exp-year cc-csc cc-type transaction-currency transaction-amount language bday bday-day bday-month '
    + 'bday-year sex tel tel-country-code tel-national tel-area-code tel-local tel-extension impp url photo webauthn shipping billing home work mobile fax pager').split(' '));
  function outlineFacts(reg) {
    const out = { landmarks: { main: 0, banner: 0, contentinfo: 0, navigation: 0 }, unlabeledNav: 0, vague: [], sameText: [], placeholderOnly: [], autocomplete: [], positiveTabindex: [] };
    const sectioning = 'article,aside,main,nav,section';
    const roleOfLandmark = el => el.getAttribute('role') || (el.tagName === 'MAIN' ? 'main' : el.tagName === 'NAV' ? 'navigation'
      : el.tagName === 'HEADER' && !el.parentElement?.closest(sectioning) ? 'banner' : el.tagName === 'FOOTER' && !el.parentElement?.closest(sectioning) ? 'contentinfo' : '');
    for (const el of document.querySelectorAll('main,nav,header,footer,[role=main],[role=navigation],[role=banner],[role=contentinfo]')) {
      if (own(el) || !el.getClientRects().length) continue;
      const role = roleOfLandmark(el);
      if (!(role in out.landmarks)) continue;
      out.landmarks[role]++;
      if (role === 'navigation' && !clean(el.getAttribute('aria-label')) && !el.getAttribute('aria-labelledby')) out.unlabeledNav++;
    }
    const byName = new Map(); let n = 0;
    for (const a of document.querySelectorAll('a[href]')) {
      if (++n > 2000 || own(a) || !visible(a) || a.closest('[data-samestate-private]')) continue;
      const name = nameOf(a).toLowerCase();
      if (VAGUE.test(name)) { const key = 'ol|vague|' + out.vague.length; reg(key, a); out.vague.push({ key, phrase: name }); }
      let href; try { const u = new URL(a.href); u.hash = ''; href = u.href; } catch { continue; }
      if (!name) continue;
      if (!byName.has(name)) byName.set(name, new Map());
      const hrefs = byName.get(name); if (!hrefs.has(href)) hrefs.set(href, []); hrefs.get(href).push(a);
    }
    for (const hrefs of byName.values()) {
      if (hrefs.size < 2) continue;
      const key = 'ol|same|' + out.sameText.length; for (const list of hrefs.values()) list.forEach(a => reg(key, a));
      out.sameText.push({ key, urls: hrefs.size });
    }
    for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]),textarea,select')) {
      if (own(el) || !visible(el)) continue;
      const labelled = (el.labels?.length && [...el.labels].some(l => clean(l.textContent))) || clean(el.getAttribute('aria-label')) || el.getAttribute('aria-labelledby') || clean(el.getAttribute('title'));
      if (!labelled && clean(el.getAttribute('placeholder'))) { const key = 'ol|ph|' + out.placeholderOnly.length; reg(key, el); out.placeholderOnly.push(key); }
      const ac = (el.getAttribute('autocomplete') || '').trim().toLowerCase();
      if (ac) { const bad = ac.split(/\s+/).find(token => !AUTOCOMPLETE.has(token) && !token.startsWith('section-')); if (bad) { const key = 'ol|ac|' + out.autocomplete.length; reg(key, el); out.autocomplete.push({ key, token: bad.slice(0, 40) }); } }
    }
    for (const el of document.querySelectorAll('[tabindex]')) {
      if (own(el) || el.tabIndex <= 0) continue;
      const key = 'ol|ti|' + out.positiveTabindex.length; reg(key, el); out.positiveTabindex.push(key);
      if (out.positiveTabindex.length >= 40) break;
    }
    return out;
  }
  // Characters per line of a paragraph, from its text length and its rendered line count. Lines over 80 characters
  // are hard to read (WCAG 1.4.8).
  function charsPerLine(el, cs, height) {
    const length = el.textContent.replace(/\s+/g, ' ').trim().length;
    const lineHeight = cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight);
    const lines = lineHeight > 0 ? Math.round(height / lineHeight) : 0;
    return lines >= 2 && length >= 120 ? Math.round(length / lines) : 0;
  }

  // Files that answered with an error status, from resource timing (Chrome reports responseStatus), so failures from
  // before this script started count too. Other sites report 0 unless they allow timing, so they are not judged.
  function errorsNow() {
    const out = pageErrors.map(({ kind, message, count }) => ({ kind, message, count }));
    const seen = new Set(out.filter(e => e.kind === 'resource').map(e => e.message.replace(/^\w+ failed to load: /, '')));
    for (const entry of performance.getEntriesByType('resource')) {
      if (!(entry.responseStatus >= 400)) continue;
      const address = requestAddress(entry.name);
      if (!address || seen.has(address)) continue;
      seen.add(address);
      out.push({ kind: 'resource', message: `${entry.initiatorType || 'file'} failed to load (${entry.responseStatus}): ${address}`, count: 1 });
      if (out.length >= 80) break;
    }
    return out;
  }
  // Errors and console messages. In the extension, console.js forwards them from the page's own world; in the
  // web demo this script is in the page's world and installs the same forwarding itself.
  const pageErrors = [];
  function noteConsole(entry) {
    if (!entry.message) return;
    if (entry.level === 'error') {
      const key = entry.kind + '|' + entry.message;
      const same = pageErrors.find(e => e.key === key);
      if (same) same.count++; else if (pageErrors.length < 60) pageErrors.push({ key, count: 1, ...entry });
    }
    send('console', entry);
  }
  document.addEventListener('samestate-console', event => {
    try { const m = JSON.parse(event.detail); if (['log', 'info', 'warn', 'error', 'debug'].includes(m.level) && typeof m.text === 'string') noteConsole({ level: m.level, kind: m.kind === 'error' ? 'error' : 'console', message: clean(m.text, 500) }); } catch {}
  });
  addEventListener('error', event => {
    const el = event.target;
    if (!el || el === window || el.nodeType !== 1 || own(el) || !/^(SCRIPT|LINK|IMG|SOURCE|VIDEO|AUDIO|IFRAME|EMBED|OBJECT)$/.test(el.tagName)) return;
    noteConsole({ level: 'error', kind: 'resource', message: `${el.tagName.toLowerCase()} failed to load: ${requestAddress(el.src || el.href || el.currentSrc || '') || 'unknown address'}` });
  }, true);
  if (demo && !window.__samestateConsole) {
    window.__samestateConsole = true;
    const emit = (level, args, kind) => {
      let text; try { text = args.map(a => typeof a === 'string' ? a : a instanceof Error ? (a.stack || a.message) : JSON.stringify(a)).join(' '); } catch { text = String(args[0]); }
      document.dispatchEvent(new CustomEvent('samestate-console', { detail: JSON.stringify({ level, kind, text: String(text).slice(0, 500) }) }));
    };
    for (const level of ['log', 'info', 'warn', 'error', 'debug']) { const original = console[level]; console[level] = function (...args) { try { emit(level, args); } catch {} return original.apply(this, args); }; }
    addEventListener('error', e => { if (e.target === window) emit('error', [e.message + (e.filename ? ` (${e.filename.split(/[?#]/)[0].split('/').pop()}:${e.lineno})` : '')], 'error'); });
    addEventListener('unhandledrejection', e => emit('error', ['Unhandled rejection: ' + (e.reason?.message || e.reason)], 'error'));
  }

  /* ---------------------------- more debug overlays ---------------------------- */
  // Rulers and guides, a column grid, a baseline grid, area measuring, Peek, readability and text measuring.
  let rulerLayer = null, gridLayer = null, measureLayer = null, peekTip = null, readLayer = null, selectionTip = null;
  const guides = []; // { axis: 'x'|'y', at } in viewport px (x) or page px (y)
  let gridConfig = { columns: 12, gutter: 24, maxWidth: 1200, margin: 16, baseline: 8 };
  const TIP = 'position:fixed;z-index:2;pointer-events:none;max-width:280px;padding:6px 8px;border-radius:6px;background:#111827;color:#f9fafb;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 6px 18px rgba(0,0,0,.35);white-space:pre-wrap';
  function drawRulers() {
    if (!debug.tools.has('rulers')) { rulerLayer?.remove(); rulerLayer = null; return; }
    if (!rulerLayer?.isConnected) {
      rulerLayer = document.createElement('div'); getLayer().appendChild(rulerLayer);
      rulerLayer.addEventListener('mousemove', e => { const bar = e.target.closest?.('[data-ruler]'); if (bar) showGuidePreview(bar.dataset.ruler, e); });
      rulerLayer.addEventListener('mouseleave', () => rulerLayer?.querySelector('[data-preview]')?.remove());
      rulerLayer.addEventListener('click', e => {
        const bar = e.target.closest?.('[data-ruler]'); if (!bar) return;
        const axis = bar.dataset.ruler, at = axis === 'x' ? Math.round(e.clientX) : Math.round(e.clientY + scrollY);
        const near = guides.findIndex(g => g.axis === axis && Math.abs(g.at - at) <= 3);
        if (near >= 0) guides.splice(near, 1); else guides.push({ axis, at });
        drawRulers();
      });
    }
    const vw = document.documentElement.clientWidth, vh = innerHeight, top = Math.round(scrollY);
    const tick = 'repeating-linear-gradient(to right, transparent 0 9px, #94a3b8 9px 10px)';
    let html = `<div data-ruler="x" style="position:fixed;left:0;top:0;width:${vw}px;height:18px;background:#f8fafc ${''};background-image:${tick};background-size:100% 6px;background-repeat:no-repeat;background-position:0 12px;border-bottom:1px solid #94a3b8;pointer-events:auto;cursor:crosshair;z-index:3"></div>`;
    html += `<div data-ruler="y" style="position:fixed;left:0;top:18px;width:18px;height:${vh - 18}px;background:#f8fafc;background-image:repeating-linear-gradient(to bottom, transparent 0 9px, #94a3b8 9px 10px);background-size:6px 100%;background-repeat:no-repeat;background-position:12px ${-((top + 18) % 10)}px;border-right:1px solid #94a3b8;pointer-events:auto;cursor:crosshair;z-index:3"></div>`;
    const label = (style, text) => `<span style="position:fixed;${style};font:9px/10px ui-monospace,monospace;color:#334155;pointer-events:none;z-index:4">${text}</span>`;
    for (let x = 100; x < vw; x += 100) html += label(`left:${x + 2}px;top:1px`, x);
    for (let y = Math.ceil((top + 18) / 100) * 100; y < top + vh; y += 100) html += label(`left:1px;top:${y - top + 2}px;writing-mode:vertical-rl`, y);
    for (const g of guides) {
      if (g.axis === 'x') html += `<div style="position:fixed;left:${g.at}px;top:0;width:1px;height:${vh}px;background:#06b6d4;pointer-events:none;z-index:2"></div>` + label(`left:${g.at + 3}px;top:20px;background:#06b6d4;color:#fff;padding:0 2px`, g.at + 'px');
      else if (g.at >= top && g.at <= top + vh) html += `<div style="position:fixed;left:0;top:${g.at - top}px;width:${vw}px;height:1px;background:#06b6d4;pointer-events:none;z-index:2"></div>` + label(`left:20px;top:${g.at - top + 2}px;background:#06b6d4;color:#fff;padding:0 2px`, g.at + 'px');
    }
    rulerLayer.innerHTML = html; // built from numbers only
  }
  function showGuidePreview(axis, e) {
    rulerLayer.querySelector('[data-preview]')?.remove();
    const p = document.createElement('div'); p.dataset.preview = '';
    const at = axis === 'x' ? Math.round(e.clientX) : Math.round(e.clientY + scrollY);
    p.style.cssText = axis === 'x' ? `position:fixed;left:${e.clientX}px;top:0;width:1px;height:${innerHeight}px;background:rgba(6,182,212,.5);pointer-events:none;z-index:2` : `position:fixed;left:0;top:${e.clientY}px;width:${innerWidth}px;height:1px;background:rgba(6,182,212,.5);pointer-events:none;z-index:2`;
    const t = document.createElement('span'); t.textContent = at + 'px'; t.style.cssText = 'position:absolute;left:4px;top:4px;padding:0 3px;background:#06b6d4;color:#fff;font:10px ui-monospace,monospace';
    p.appendChild(t); rulerLayer.appendChild(p);
  }
  function drawGrids() {
    const columns = debug.tools.has('columns'), baseline = debug.tools.has('baseline');
    if (!columns && !baseline) { gridLayer?.remove(); gridLayer = null; return; }
    if (!gridLayer?.isConnected) { gridLayer = document.createElement('div'); getLayer().appendChild(gridLayer); }
    const docH = Math.max(document.documentElement.scrollHeight, innerHeight), vw = document.documentElement.clientWidth;
    const c = gridConfig, width = Math.min(vw - 2 * c.margin, c.maxWidth || Infinity), left = (vw - width) / 2;
    const col = Math.max(1, (width - c.gutter * (c.columns - 1)) / c.columns);
    let html = '';
    if (columns) html += `<div style="position:absolute;left:${left}px;top:0;width:${width}px;height:${docH}px;pointer-events:none;background:repeating-linear-gradient(to right, rgba(239,68,68,.12) 0 ${col}px, transparent ${col}px ${col + c.gutter}px)"></div>`;
    if (baseline) html += `<div style="position:absolute;left:0;top:0;width:${vw}px;height:${docH}px;pointer-events:none;background:repeating-linear-gradient(to bottom, transparent 0 ${c.baseline - 1}px, rgba(59,130,246,.35) ${c.baseline - 1}px ${c.baseline}px)"></div>`;
    gridLayer.innerHTML = html; // numbers only
  }
  let measuring = null; const boxes = [];
  function drawMeasure() {
    if (!debug.tools.has('measure')) { measureLayer?.remove(); measureLayer = null; boxes.length = 0; return; }
    if (!measureLayer?.isConnected) {
      measureLayer = document.createElement('div'); getLayer().appendChild(measureLayer);
      measureLayer.style.cssText = 'position:fixed;inset:0;pointer-events:auto;cursor:crosshair;z-index:1';
      measureLayer.addEventListener('pointerdown', e => {
        if (e.target.dataset?.remove !== undefined) { boxes.splice(Number(e.target.dataset.remove), 1); renderBoxes(); return; }
        measuring = { x: e.clientX, y: e.clientY + scrollY }; boxes.push({ x: measuring.x, y: measuring.y, w: 0, h: 0 }); e.preventDefault();
      });
      measureLayer.addEventListener('pointermove', e => {
        if (!measuring) return; const b = boxes[boxes.length - 1], y = e.clientY + scrollY;
        b.x = Math.min(measuring.x, e.clientX); b.y = Math.min(measuring.y, y); b.w = Math.abs(e.clientX - measuring.x); b.h = Math.abs(y - measuring.y); renderBoxes();
      });
      addEventListener('pointerup', () => { if (!measuring) return; measuring = null; if (boxes.length && boxes[boxes.length - 1].w < 3) boxes.pop(); renderBoxes(); });
    }
    renderBoxes();
  }
  function renderBoxes() {
    if (!measureLayer) return;
    const vw = document.documentElement.clientWidth, top = scrollY;
    measureLayer.innerHTML = boxes.map((b, i) => {
      const y = b.y - top, size = `${Math.round(b.w)} × ${Math.round(b.h)}`;
      const dist = `← ${Math.round(b.x)}  → ${Math.round(vw - b.x - b.w)}  ↑ ${Math.round(b.y)}`;
      return `<div style="position:fixed;left:${b.x}px;top:${y}px;width:${b.w}px;height:${b.h}px;border:1px solid #f43f5e;background:rgba(244,63,94,.12);pointer-events:none"></div>`
        + `<div style="position:fixed;left:${b.x}px;top:${Math.max(0, y - 34)}px;padding:2px 5px;background:#f43f5e;color:#fff;font:10px/14px ui-monospace,monospace;white-space:nowrap;pointer-events:none">${size}<br>${dist}</div>`
        + `<button data-remove="${i}" style="position:fixed;left:${b.x + b.w - 8}px;top:${y - 8}px;width:16px;height:16px;border-radius:8px;border:0;background:#111827;color:#fff;font:10px/16px system-ui;padding:0;cursor:pointer;pointer-events:auto">×</button>`;
    }).join(''); // numbers only
  }
  // Peek: hold Alt (Option) and hover to see an element's size, type, colors and accessibility facts.
  let peekAt = 0;
  addEventListener('pointermove', e => {
    if (!debug.tools.has('peek')) return;
    if (!e.altKey) { peekTip?.remove(); peekTip = null; return; }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || own(el)) return;
    if (!peekTip?.isConnected) { peekTip = document.createElement('div'); getLayer().appendChild(peekTip); }
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el), contrast = hasOwnText(el) ? contrastOf(el, cs, new Map()) : null;
    const tag = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].slice(0, 3).map(c => '.' + c).join('');
    const lines = [tag, `${Math.round(r.width)} × ${Math.round(r.height)}  ·  ${(r.width / (r.height || 1)).toFixed(2)}:1`,
      `font ${cs.fontFamily.split(',')[0].replace(/["']/g, '')} ${cs.fontSize} / ${cs.lineHeight} · ${cs.fontWeight}`,
      `color ${cs.color}`, `background ${cs.backgroundColor}` + (contrast ? `  ·  contrast ${contrast}:1 ${contrast >= 7 ? 'AAA' : contrast >= 4.5 ? 'AA' : contrast >= 3 ? 'AA large' : 'fail'}` : ''),
      `margin ${cs.margin}  padding ${cs.padding}`,
      `role ${roleOf(el)}${nameOf(el) ? ': ' + nameOf(el) : ''}  ·  ${el.tabIndex >= 0 || el.matches(TARGETS) ? 'focusable' : 'not focusable'}`];
    if (el.matches('img')) lines.push(`alt ${el.hasAttribute('alt') ? '"' + clean(el.alt, 60) + '"' : 'missing'}  ·  ${el.naturalWidth}×${el.naturalHeight}`);
    if (el.matches('a[href]')) lines.push('href ' + clean(el.getAttribute('href'), 80));
    if (/flex|grid/.test(cs.display)) lines.push(`${cs.display}  ·  gap ${cs.gap}`);
    peekTip.textContent = lines.join('\n');
    peekTip.style.cssText = TIP + `;left:${Math.min(e.clientX + 14, innerWidth - 290)}px;top:${Math.min(e.clientY + 14, innerHeight - 150)}px`;
    ring(el, '#22d3ee', 400);
    if (now() - peekAt > 200 && cfg.inspect) { peekAt = now(); send('peek', { d: describe(el) }); } // the same element on the other screens
  }, { passive: true });
  addEventListener('keyup', e => { if (e.key === 'Alt') { peekTip?.remove(); peekTip = null; } });
  // Readability: Automated Readability Index per paragraph; green is easy, red is hard.
  function drawReadability() {
    if (!debug.tools.has('readability')) { readLayer?.remove(); readLayer = null; return; }
    if (!readLayer?.isConnected) { readLayer = document.createElement('div'); getLayer().appendChild(readLayer); }
    readLayer.replaceChildren();
    let n = 0;
    for (const el of document.querySelectorAll('p,li,blockquote,dd,figcaption')) {
      if (++n > 1500 || own(el) || !visible(el) || el.closest('[data-samestate-private]')) continue;
      const text = el.textContent.replace(/\s+/g, ' ').trim(); if (text.length < 40) continue;
      const words = text.split(' ').filter(Boolean).length, sentences = Math.max(1, (text.match(/[.!?…。！？]+(\s|$)/g) || []).length), chars = text.replace(/[^\p{L}\p{N}]/gu, '').length;
      const ari = Math.max(1, Math.round(4.71 * (chars / words) + 0.5 * (words / sentences) - 21.43));
      markBox(readLayer, el.getBoundingClientRect(), ari <= 8 ? '#16a34a' : ari <= 12 ? '#d97706' : '#dc2626', `grade ${ari}`);
    }
  }
  // Measure text: the selected text's characters, words and sentences.
  document.addEventListener('selectionchange', () => {
    if (!debug.tools.has('textlen')) { selectionTip?.remove(); selectionTip = null; return; }
    const sel = getSelection(), text = sel && !sel.isCollapsed ? sel.toString().replace(/\s+/g, ' ').trim() : '';
    if (!text) { selectionTip?.remove(); selectionTip = null; return; }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!selectionTip?.isConnected) { selectionTip = document.createElement('div'); getLayer().appendChild(selectionTip); }
    const words = text.split(' ').filter(Boolean).length, sentences = (text.match(/[.!?…。！？]+(\s|$)/g) || []).length || 1;
    let emoji = 0; try { emoji = (text.match(/\p{Extended_Pictographic}/gu) || []).length; } catch {}
    selectionTip.textContent = `${[...text].length} characters · ${words} words · ${sentences} sentence${sentences > 1 ? 's' : ''}` + (emoji ? ` · ${emoji} emoji` : '');
    selectionTip.style.cssText = TIP + `;left:${Math.max(4, Math.min(r.left, innerWidth - 290))}px;top:${r.top > 40 ? r.top - 30 : r.bottom + 6}px`;
  });
  addEventListener('scroll', () => { if (rulerLayer) drawRulers(); if (measureLayer) renderBoxes(); if (readLayer) { clearTimeout(readLayer.t); readLayer.t = setTimeout(drawReadability, 150); } }, { capture: true, passive: true });
  addEventListener('resize', () => { drawRulers(); drawGrids(); drawReadability(); });

  /* ------------------------------ design overlay ------------------------------ */
  // An image (a design export) over the page, scrolling with it. Outside samestate-layer so mix-blend-mode can
  // blend with the page; a div with a background image, so snapshots don't count it as an image.
  let designEl = null;
  function setDesign(m) {
    if (!m || typeof m.src !== 'string' || !/^data:image\/(png|jpe?g|webp|gif|svg\+xml);/.test(m.src) || m.visible === false) { designEl?.remove(); designEl = null; return; }
    if (!designEl?.isConnected) { designEl = document.createElement('samestate-design'); document.documentElement.appendChild(designEl); }
    const scale = [1, 2, 3].includes(m.scale) ? m.scale : 1, w = Math.max(1, (Number(m.w) || 1) / scale), h = Math.max(1, (Number(m.h) || 1) / scale);
    const mode = m.mode === 'difference' ? 'mix-blend-mode:difference;' : m.mode === 'invert' ? 'filter:invert(1);' : '';
    const split = Math.min(100, Math.max(0, Number(m.split) || 0));
    designEl.style.cssText = `position:absolute;left:${Number(m.x) || 0}px;top:${Number(m.y) || 0}px;width:${w}px;height:${h}px;display:block;pointer-events:none;z-index:2147483646;`
      + `background:url("${m.src}") 0 0 / 100% 100% no-repeat;opacity:${Math.min(1, Math.max(0, Number(m.opacity) || 0))};${mode}` + (split ? `clip-path:inset(0 0 0 ${split}%);` : '');
  }

  /* ------------------------------ find elements ------------------------------ */
  let found = [];
  function findElements(selector, index) {
    try { found = selector ? [...document.querySelectorAll(selector)].filter(el => !own(el)) : []; } catch { return { count: 0, error: 'Not a valid CSS selector' }; }
    const shown = found.filter(el => el.getClientRects().length);
    if (shown.length) {
      const el = shown[((index % shown.length) + shown.length) % shown.length];
      suppressUntil = now() + 800;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      setTimeout(() => { shown.slice(0, 60).forEach(x => ring(x, '#a855f7', 1800)); ring(el, '#f43f5e', 2400); }, 60);
    }
    return { count: found.length, shown: shown.length };
  }

  /* ------------------------------ form autofill ------------------------------ */
  const FILL = {
    valid: { email: 'test@example.com', tel: '+1 555 0100', url: 'https://example.com', number: '42', date: '2026-06-15', time: '09:30', 'datetime-local': '2026-06-15T09:30', month: '2026-06', week: '2026-W24', color: '#3366ff', search: 'test', password: 'Test-password-123!', text: 'Test text', textarea: 'This is test text, filled in by Samestate.' },
    edge: { email: 'not-an-email', tel: 'abc', url: 'not a url', number: '-1', date: '1900-01-01', time: '23:59', 'datetime-local': '1900-01-01T00:00', month: '1900-01', week: '1900-W01', color: '#000000', search: '"><img src=x onerror=alert(1)>', password: ' ', text: 'Zoë Ångström-Łukasiewicz 李小龍 ' + 'W'.repeat(120), textarea: 'Ünïcödé, emoji 🙂, RTL مرحبا, and a very long line: ' + 'lorem ipsum '.repeat(40) }
  };
  // Checked in order, so "username" is a user name and "name" alone is a full name.
  const NAMED = [[/user.?name|login/i, 'ada', ' '], [/organi[sz]ation|company/i, 'Example Inc.', 'Example & Co. <b>'], [/given|first/i, 'Ada', 'Zoë'], [/family|last|surname/i, 'Lovelace', 'Ångström-Łukasiewicz'], [/(^|[^a-z])((full|your|cc)[-_ ]?)?name([^a-z]|$)/i, 'Ada Lovelace', 'Zoë Ångström-Łukasiewicz 李小龍'],
    [/postal|zip/i, '12345', 'ABC-!!'], [/city|address-level2|town/i, 'Springfield', 'Llanfairpwllgwyngyll'], [/street|address/i, '1 Main Street', '1 Main Street ' + 'Apt '.repeat(30)],
    [/bday|birth/i, '1990-12-10', '2999-01-01']];
  function fillForms(mode) {
    let filled = 0;
    const set = (el, value) => { if (setFieldValue(el, value)) filled++; };
    for (const el of document.querySelectorAll('input,textarea,select')) {
      if (own(el) || el.disabled || el.readOnly || !visible(el) || el.closest('[data-samestate-private]')) continue;
      const type = (el.getAttribute('type') || (el.tagName === 'TEXTAREA' ? 'textarea' : el.tagName === 'SELECT' ? 'select' : 'text')).toLowerCase();
      if (['hidden', 'file', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
      if (mode === 'clear') { if (type === 'checkbox' || type === 'radio') { if (el.checked) { el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); filled++; } } else if (type === 'select') { el.selectedIndex = 0; el.dispatchEvent(new Event('change', { bubbles: true })); filled++; } else set(el, ''); continue; }
      if (type === 'checkbox') { if (!el.checked) { el.checked = true; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); filled++; } continue; }
      if (type === 'radio') { const group = el.name ? [...document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`)] : [el]; if (group[0] === el && !group.some(r => r.checked)) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); filled++; } continue; }
      if (type === 'select') { const option = [...el.options].find((o, i) => !o.disabled && o.value && (i > 0 || el.options.length === 1)); if (option) { el.value = option.value; el.dispatchEvent(new Event('change', { bubbles: true })); filled++; } continue; }
      if (type === 'range') { set(el, mode === 'edge' ? el.max || '100' : String(((+el.min || 0) + (+el.max || 100)) / 2)); continue; }
      const hint = [el.getAttribute('autocomplete'), el.name, el.id, el.getAttribute('aria-label'), el.getAttribute('placeholder')].filter(Boolean).join(' ');
      const named = NAMED.find(([pattern]) => pattern.test(hint));
      let value = named && ['text', 'search', 'textarea', 'date'].includes(type) ? named[mode === 'edge' ? 2 : 1] : FILL[mode][type] ?? FILL[mode].text;
      if (type === 'number' && mode === 'valid') value = el.min ? el.min : value;
      set(el, value);
    }
    return filled;
  }
  // Sets a field's value as typing would (input and change events), without moving focus to it.
  function setFieldValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    try { if (setter) setter.call(el, value); else el.value = value; } catch { return false; }
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  /* ------------------------------ typing and form sync ------------------------------ */
  // Off by default (Sync → Typing & form fields). Passwords, file fields and data-samestate-private are never sent.
  const fieldTimers = new WeakMap();
  const syncableField = el => el?.matches?.('input,textarea,select') && !el.matches('[type=password],[type=file],[type=hidden]') && !el.closest('[data-samestate-private]') && !own(el);
  for (const type of ['input', 'change']) addEventListener(type, e => {
    if (!e.isTrusted || !cfg.inspect || replaying || !syncableField(e.target)) return;
    const el = e.target;
    clearTimeout(fieldTimers.get(el));
    fieldTimers.set(el, setTimeout(() => {
      const check = el.matches('[type=checkbox],[type=radio]');
      act('field', { d: describe(el), name: el.getAttribute('name') || '', tag: el.tagName.toLowerCase(), value: check ? String(el.checked) : el.value, check });
    }, type === 'change' ? 0 : 150));
  }, true);
  // The same field here: by its place in the page, or else by its name. Fields are not clickable targets, so the
  // click matching (findTarget) does not apply.
  function fieldTarget(m) {
    const fields = el => el?.matches?.('input,textarea,select') && syncableField(el);
    let el = m.d ? matchingControls(m.d).filter(fields).find(visible) : null, status = 'direct';
    if (!el && typeof m.name === 'string' && m.name && /^(input|textarea|select)$/.test(m.tag)) {
      const named = [...document.querySelectorAll(`${m.tag}[name="${CSS.escape(m.name)}"]`)].filter(fields);
      el = named.find(visible) || named[0] || null; status = 'semantic';
    }
    return { el, status: el ? status : 'none' };
  }
  async function applyField(m) {
    const { el, status } = fieldTarget(m);
    if (!el) return { status };
    if (m.check) { const on = m.value === 'true'; if (el.checked !== on) { el.checked = on; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } }
    else if (el.value !== m.value) setFieldValue(el, String(m.value ?? ''));
    return { status };
  }

  /* ------------------------------ CSS breakpoints ------------------------------ */
  // Width breakpoints from the stylesheets this page can read: min-width/max-width and range syntax, px, em and rem.
  function cssBreakpoints() {
    const values = new Map(); // px → 'min' | 'max'
    const px = (n, unit) => unit === 'px' ? n : n * 16;
    const read = text => {
      for (const m of text.matchAll(/\(\s*(min|max)-width\s*:\s*([\d.]+)(px|em|rem)\s*\)/gi)) values.set(Math.round(px(+m[2], m[3].toLowerCase())) + (m[1].toLowerCase() === 'max' ? 1 : 0), 'start');
      for (const m of text.matchAll(/width\s*(>=|>|<=|<)\s*([\d.]+)(px|em|rem)/gi)) { const v = px(+m[2], m[3].toLowerCase()); values.set(Math.round(m[1] === '>' || m[1] === '<=' ? v + 1 : v), 'start'); }
      for (const m of text.matchAll(/([\d.]+)(px|em|rem)\s*(<=|<)\s*width/gi)) { const v = px(+m[1], m[2].toLowerCase()); values.set(Math.round(m[3] === '<' ? v + 1 : v), 'start'); }
    };
    const visit = rules => { for (const rule of rules) { if (rule.media) read(rule.media.mediaText); if (rule instanceof CSSContainerRule) continue; if (rule.cssRules) visit(rule.cssRules); if (rule.styleSheet) { try { visit(rule.styleSheet.cssRules); } catch {} } } };
    for (const sheet of document.styleSheets) { try { if (sheet.media?.mediaText) read(sheet.media.mediaText); visit(sheet.cssRules); } catch {} }
    for (const el of document.querySelectorAll('link[media],source[media]')) read(el.getAttribute('media') || '');
    return [...values.keys()].filter(v => v > 1 && v < 4000).sort((a, b) => a - b); // each is the first width of a range
  }

  /* ------------------------------ live reload ------------------------------ */
  // Fingerprints of this page and its same-origin stylesheets and scripts, so Samestate can tell a CSS-only change
  // (swap stylesheets in place) from any other change (reload).
  async function siteFingerprint() {
    const digest = async url => { try { const r = await fetch(url, { cache: 'no-store', credentials: 'same-origin' }); return r.ok ? hash(await r.text()) : 'status ' + r.status; } catch { return 'unreachable'; } };
    const sameOrigin = url => { try { return new URL(url, location.href).origin === location.origin; } catch { return false; } };
    const css = [...document.querySelectorAll('link[rel~=stylesheet][href]')].map(l => l.href).filter(sameOrigin).slice(0, 20);
    const js = [...document.querySelectorAll('script[src]')].map(s => s.src).filter(sameOrigin).slice(0, 20);
    const [html, ...rest] = await Promise.all([digest(location.href), ...css.map(digest), ...js.map(digest)]);
    return { url: location.href, html, css: rest.slice(0, css.length).join('|'), js: rest.slice(css.length).join('|') };
  }
  function reloadCss() {
    for (const link of document.querySelectorAll('link[rel~=stylesheet][href]')) {
      try { const u = new URL(link.href); if (u.origin !== location.origin) continue; u.searchParams.set('samestate-reload', Date.now()); link.href = u.href; } catch {}
    }
  }

  /* ------------------------------ full-page capture ------------------------------ */
  let hiddenFixed = [];
  function pageSize() { const de = document.documentElement; return { w: de.clientWidth, h: Math.max(de.scrollHeight, document.body?.scrollHeight || 0), vh: innerHeight, y: scrollY }; }
  function hideFixed(on) {
    for (const [el, value] of hiddenFixed) el.style.visibility = value;
    hiddenFixed = [];
    if (!on) return;
    let n = 0;
    for (const el of document.body.querySelectorAll('*')) {
      if (++n > 5000) break; if (own(el)) continue;
      const position = getComputedStyle(el).position;
      if (position === 'fixed' || position === 'sticky') { hiddenFixed.push([el, el.style.visibility]); el.style.visibility = 'hidden'; }
    }
  }

  /* --------------------------- snapshot for diffing --------------------------- */
  let snapMap = new Map();
  const TEXTY = new Set(['heading', 'text', 'link', 'button']);
  async function snapshot(options = {}) {
    snapMap = new Map();
    const mediaUnder = new Map();
    const de = document.documentElement, vw = de.clientWidth, items = [], textTasks = [];
    // Numbered keys (ov|0, fx|1 …) also get the element's path, so tools outside the page can find the element.
    const keyPaths = {};
    const reg = (key, el) => {
      if (!snapMap.has(key)) { snapMap.set(key, []); const path = elementPath(el); if (path && key.slice(key.indexOf('|') + 1) !== path) keyPaths[key] = path; }
      snapMap.get(key).push(el);
    };
    const push = (cat, el, extra) => {
      if (items.length >= 1800) return;
      const key = cat + '|' + elementPath(el);
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el), vis = visible(el);
      reg(key, el);
      const item = {
        cat, key, name: cat, visible: vis,
        x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height),
        size: Math.round(parseFloat(cs.fontSize) * 10) / 10,
        truncated: vis && (cat === 'text' || cat === 'heading') && ((cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1)),
        inNav: !!el.closest('nav,[role=navigation],header'),
        ...extra
      };
      if (vis && cat === 'text') { const cpl = charsPerLine(el, cs, r.height); if (cpl) item.cpl = cpl; }
      if (vis && TEXTY.has(cat) && !el.disabled && (cat === 'text' || cat === 'heading' || clean(el.textContent))) {
        const contrast = contrastOf(el, cs, mediaUnder);
        if (contrast) { item.contrast = contrast; item.large = item.size >= 24 || (item.size >= 18.6 && Number(cs.fontWeight) >= 700); }
      }
      items.push(item);
      if (cfg.textKey && vis && ['heading', 'text', 'button', 'link'].includes(cat)) {
        textTasks.push(textFingerprint(el).then(key => { if (key) item.textKey = key; }));
      }
    };
    const hasTextNode = el => Array.from(el.childNodes).some(node => node.nodeType === Node.TEXT_NODE);
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role~="heading"]').forEach(el => { const level = inspectHeadingLevel(el); if (level !== null) push('heading', el, { level }); });
    document.querySelectorAll('p,li,blockquote,figcaption,dd,dt').forEach(el => {
      if (hasTextNode(el)) push('text', el);
    });
    let dom = 0; // document order, which is the Tab order for controls without a positive tabindex
    document.querySelectorAll('a[href],button,[role=button],input:not([type=hidden]),select,textarea,summary,[role=tab]').forEach(el => {
      const kind = kindOf(el);
      const field = ['field', 'select', 'check'].includes(kind);
      const inline = kind === 'link' && getComputedStyle(el).display === 'inline' && hasTextNode(el.parentElement);
      let pinned = false; // inside a fixed or sticky bar, which shows out of document order on purpose
      for (let a = el; a && a !== document.body && !pinned; a = a.parentElement) pinned = /fixed|sticky/.test(getComputedStyle(a).position);
      push(field ? 'input' : kind === 'link' ? 'link' : 'button', el, { kind, inline, dom: dom++, pinned, unnamed: !hasName(el) });
    });
    document.querySelectorAll('img').forEach(el => {
      push('image', el, { natW: el.naturalWidth, src: el.currentSrc ? requestAddress(el.currentSrc) : null, loaded: el.complete && el.naturalWidth > 0, boxed: el.getClientRects().length > 0, broken: el.complete && el.naturalWidth === 0 && el.matches('img[src],img[srcset],picture img'), noAlt: !el.hasAttribute('alt') && !el.closest('[aria-hidden=true]') && !/^(presentation|none)$/.test(el.getAttribute('role') || '') && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') });
    });
    document.querySelectorAll('table').forEach(el => {
      let scroller = null;
      for (let a = el; a && a !== document.body; a = a.parentElement) { // a table set to display: block can scroll itself
        if (/auto|scroll/.test(getComputedStyle(a).overflowX)) { scroller = a; break; }
      }
      const box = scroller || el.parentElement;
      const cells = el.rows[0] ? Array.from(el.rows[0].cells) : [];
      push('table', el, {
        display: getComputedStyle(el).display,
        cols: cells.filter(visible).length,
        wide: el.scrollWidth > box.clientWidth + 2 || el.getBoundingClientRect().width > box.clientWidth + 2,
        scrollable: !!scroller
      });
    });
    document.querySelectorAll('nav,[role=navigation]').forEach(el => push('nav', el, { name: 'navigation' }));

    // page-level facts
    const overflow = [], scrollers = [], fixed = []; let n = 0;
    const vh = innerHeight;
    for (const el of document.body.querySelectorAll('*')) {
      if (++n > 5000) break; if (el.tagName === 'SAMESTATE-LAYER' || el.closest('samestate-layer')) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none') continue;
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      if (/auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 4) { const key = 'sc|' + scrollers.length; reg(key, el); scrollers.push({ key, name: 'scroll area', snap: cs.scrollSnapType && cs.scrollSnapType !== 'none', table: el.matches('table') || !!el.querySelector('table') }); }
      if ((cs.position === 'fixed' || cs.position === 'sticky') && visible(el) && r.width * Math.min(r.height, vh) / (vw * vh) > 0.25 && r.top < vh && r.bottom > 0) { const key = 'fx|' + fixed.length; reg(key, el); fixed.push({ key, name: 'fixed element', cover: Math.round(r.width * Math.min(r.height, vh) / (vw * vh) * 100) }); }
      if (r.right + scrollX > vw + 2 && overflow.length < 6 && visible(el)) {
        let clipped = false, parentOver = false;
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') { clipped = true; break; } }
        if (el.parentElement && el.parentElement !== document.body) parentOver = el.parentElement.getBoundingClientRect().right + scrollX > vw + 2;
        if (!clipped && !parentOver) { const key = 'ov|' + overflow.length; reg(key, el); overflow.push({ key, name: 'element', by: Math.round(r.right + scrollX - vw) }); }
      }
    }
    // controls sitting underneath a fixed overlay (cookie banners, chat bubbles, sticky bars)
    const covers = new Map();
    for (const el of document.querySelectorAll('a[href],button,[role=button],input:not([type=hidden]),select,textarea')) {
      const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || r.bottom > vh || r.top < 0 || r.right > vw || r.left < 0 || !visible(el)) continue;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!top || el.contains(top) || top.contains(el)) continue;
      let fx = null; for (let a = top; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') fx = a;
      if (!fx || fx.contains(el) || fx.matches('dialog[open],[aria-modal=true]')) continue;
      if (!covers.has(fx)) covers.set(fx, []); covers.get(fx).push(el);
    }
    for (const [fx, els] of covers) {
      const r = fx.getBoundingClientRect(), key = 'cv|' + fixed.length; reg(key, fx); els.forEach(e => reg(key, e));
      fixed.push({ key, name: 'overlay', cover: Math.round(r.width * Math.min(r.height, vh) / (vw * vh) * 100), hides: els.slice(0, 6).map(kindOf) });
    }
    // controls the Tab key reaches although nobody can see them (a closed drawer or accordion, a transparent layer)
    const hiddenFocus = []; let seen = 0;
    for (const el of document.querySelectorAll('a[href]:not([href^="#"]),button,input:not([type=hidden]),select,textarea,summary,[tabindex]')) {
      if (++seen > 3000 || hiddenFocus.length >= 40) break;
      if (el.tabIndex < 0 || el.disabled || el.closest('[inert],[aria-hidden=true],samestate-layer') || !el.getClientRects().length || visible(el)) continue;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue; // visibility: hidden is skipped by Tab
      const reason = hiddenReason(el, vw, vh);
      if (!reason) continue;
      const key = 'hf|' + hiddenFocus.length; reg(key, el); hiddenFocus.push({ key, kind: kindOf(el), reason });
    }
    await Promise.all(textTasks);
    const shifted = [];
    for (const ref of shiftNodes) { const el = ref.deref(); if (el?.isConnected) { const key = 'ls|' + shifted.length; reg(key, el); shifted.push(key); } }
    const links = options.links ? await checkLinks(reg) : null;
    // Chrome stops drawing some previews that are out of view, and records no paints or shifts for them meanwhile.
    const drawn = await new Promise(done => { const timer = setTimeout(() => done(false), 300); requestAnimationFrame(() => { clearTimeout(timer); done(true); }); });
    return {
      vw, docW: de.scrollWidth, keyPaths, metaViewport: !!document.querySelector('meta[name=viewport]'),
      lang: !!de.getAttribute('lang')?.trim(), zoomBlocked: zoomBlocked(), links,
      meta: pageMeta(), outline: outlineFacts(reg), errors: errorsNow(),
      documentStatus: performance.getEntriesByType('navigation')[0]?.responseStatus,
      vitals: { lcp: Math.round(vitals.lcp), cls: Math.round(vitals.cls * 1000) / 1000, inp: Math.round(vitals.inp), shifted, drawn },
      dpr: devicePixelRatio, requests: requests(),
      vh, items, overflow, scrollers, fixed, hiddenFocus,
      menuToggle: Array.from(document.querySelectorAll('[aria-haspopup=menu],[aria-controls][aria-expanded]')).some(visible)
    };
  }

  async function runDemo(m) {
    const el = m.sel && document.querySelector(m.sel); if (!el) return; send('active');
    if (m.do === 'console') { console.info('Samestate demo: this message came from the preview.'); return; }
    if (m.do === 'click' && canMirrorClick(el)) { flash(el); press(el); mirrorClick(el); }
    else if (m.do === 'scroll') { const y0 = scrollY, y = el.getBoundingClientRect().top + scrollY - 90; for (let i = 1; i <= 28; i++) { window.scrollTo({ top: y0 + (y - y0) * i / 28, behavior: 'instant' }); act('scroll', scrollState()); await sleep(28); } }
    else if (m.do === 'link' && el.matches('a[href]')) { // a synthetic click is not user-initiated, so the tour shares the address itself
      flash(el);
      act('navigate', { url: el.href });
      following = el.href;
      setTimeout(() => location.assign(el.href), 250);
    }
    else if (m.do === 'step' && cfg.pageSteps) { // the tour's clicks are synthetic, so Page steps is told directly what a real click would open
      flash(el);
      const link = el.closest('a[href]');
      if (!(link && openPageInWall(link.href)) && journeyControl(el)) sendPageStep('open-state', { url: location.href, action: describe(el) });
    }
  }

  /* -------------------------------- test steps -------------------------------- */
  // A test step names a control the way a person reading the test would: its role and its visible name.
  // Every screen finds its own copy, so one step works across layouts. Only "look" sends page text out of
  // this frame, and Samestate asks for it only while an AI is writing a test the tester started.
  const FIELD = 'input:not([type=hidden]),textarea,select,[contenteditable=""],[contenteditable=true],[role=textbox],[role=searchbox],[role=combobox]';
  const STEP_POOL = ACTIONABLE + ',' + FIELD;
  const clean = (text, n = 80) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, n);
  function roleOf(el) {
    const role = el.getAttribute('role');
    if (role) return role.split(' ')[0];
    const tag = el.tagName.toLowerCase(), type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea' || el.isContentEditable) return 'textbox';
    if (tag === 'input') {
      if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
      return { checkbox: 'checkbox', radio: 'radio', search: 'searchbox', range: 'slider' }[type] || 'textbox';
    }
    return 'button';
  }
  // The accessible name, simplified. A field's typed value is never part of it.
  function nameOf(el) {
    if (el.closest('[data-samestate-private]')) return '';
    const by = el.getAttribute('aria-labelledby');
    if (by) { const text = clean(by.split(/\s+/).map(id => document.getElementById(id)?.innerText || '').join(' ')); if (text) return text; }
    const label = clean(el.getAttribute('aria-label'));
    if (label) return label;
    if (el.labels?.length) { const text = clean([...el.labels].map(l => l.innerText).join(' ')); if (text) return text; }
    if (el.matches('input[type=button],input[type=submit],input[type=reset]')) return clean(el.value);
    if (!el.matches(FIELD)) {
      const text = clean(el.innerText);
      if (text) return text;
      const img = el.querySelector('img[alt]');
      if (img && clean(img.alt)) return clean(img.alt);
    }
    return clean(el.getAttribute('title') || el.getAttribute('placeholder') || el.getAttribute('name'));
  }
  const stepTargetOf = el => ({ role: roleOf(el), name: nameOf(el), ...describe(el) });

  let refs = new Map(); // the controls of the last look, by number, so the AI can name one exactly
  function pageText(limit = 4000) {
    let text = '';
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        if (node.matches(privateContent) || node.matches('samestate-layer')) return NodeFilter.FILTER_REJECT;
        const style = getComputedStyle(node);
        return style.display === 'none' || style.visibility === 'hidden' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
    });
    for (let node = walker.nextNode(); node && text.length < limit; node = walker.nextNode()) {
      const part = clean(node.data, 400);
      if (part) text += (/^[,.;:!?)]/.test(part) ? '' : ' ') + part;
    }
    return text.trim().slice(0, limit);
  }
  function look() {
    refs = new Map();
    const controls = [];
    for (const el of document.querySelectorAll(STEP_POOL)) {
      if (controls.length >= 150) break;
      if (!visible(el) || el.closest('samestate-layer')) continue;
      if (!el.matches(FIELD) && el.parentElement?.closest(ACTIONABLE)?.matches('a[href],button')) continue; // a part of a link or button
      const control = { ref: controls.length + 1, role: roleOf(el), name: nameOf(el) };
      if (el.type === 'password') control.password = true;
      if (el.matches('input[type=checkbox],input[type=radio]')) control.checked = el.checked;
      if (el.hasAttribute('aria-expanded')) control.expanded = el.getAttribute('aria-expanded') === 'true';
      if (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true') control.selected = true;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') control.disabled = true;
      if (el.matches('select') && !el.closest('[data-samestate-private]')) control.options = [...el.options].slice(0, 12).map(o => clean(o.text, 40));
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) control.offscreen = true;
      refs.set(control.ref, el);
      controls.push(control);
    }
    const de = document.documentElement;
    return { url: location.href, controls, text: pageText(), scroll: { y: Math.round(scrollY), max: Math.max(0, de.scrollHeight - innerHeight) } };
  }

  function namedControl(target) {
    const want = clean(target.name).toLowerCase();
    if (!want) return null;
    const pool = Array.from(document.querySelectorAll(STEP_POOL)).filter(el => visible(el) && !el.closest('samestate-layer'));
    const same = pool.filter(el => nameOf(el).toLowerCase() === want);
    const sameRole = same.filter(el => roleOf(el) === target.role);
    const hits = sameRole.length ? sameRole : same;
    if (hits.length) return { el: hits.find(el => target.path && elementPath(el) === target.path) || hits[0], status: sameRole.length ? 'direct' : 'semantic' };
    const loose = pool.filter(el => (!target.role || roleOf(el) === target.role) && nameOf(el).toLowerCase().includes(want));
    return loose.length === 1 ? { el: loose[0], status: 'semantic' } : null;
  }
  async function stepControl(target, ref) {
    const own = ref && refs.get(ref);
    if (own?.isConnected && visible(own)) return { el: own, status: 'direct' };
    if (!target || typeof target !== 'object') return { el: null, status: 'none' };
    if (target.name) {
      const named = namedControl(target);
      if (named) return named;
      // A screen that labels the control differently: the control at the same place, if it has the same role.
      const el = target.path && locate(target.path);
      return el && visible(el) && el.matches(STEP_POOL) && (!target.role || roleOf(el) === target.role) ? { el, status: 'semantic' } : { el: null, status: 'none' };
    }
    // A recorded click has no name (page text stays in the frame), only the control's place and attributes.
    const { textKey, ...description } = target;
    return findTarget(description);
  }
  async function findStepControl(target, ref) {
    let { el, status } = await stepControl(target, ref);
    for (let tries = 0; !el && tries < 8; tries++) {
      await sleep(150);
      finishAnimations();
      ({ el, status } = await stepControl(target, ref));
    }
    // Like a synced click: a navigation item may sit behind this screen's menu button.
    let opened = null;
    if (!el && (target?.nav || ['link', 'button', 'menuitem'].includes(target?.role)) && (opened = menuToggle())) {
      press(opened);
      for (let tries = 0; !el && tries < 6; tries++) {
        await sleep(150);
        finishAnimations();
        ({ el, status } = await stepControl(target, ref));
      }
      if (el) status = 'revealed';
      else closeMenu(opened);
    }
    return { el, status };
  }
  // Runs a click or key press and says whether it started loading another page. A page load ends this document
  // and can drop the answer, so a link's load is held back until the answer is on its way. A form that posts
  // data cannot be held back; its answer goes at once.
  function actAndWatch(fn) {
    let leaving = false, resume = null, settle;
    const decided = new Promise(done => { settle = done; });
    const watch = event => {
      if (event.defaultPrevented || event.destination.sameDocument || event.downloadRequest != null) return;
      leaving = true;
      if (event.formData || !event.cancelable) { settle(); return; }
      event.preventDefault();
      const url = event.destination.url;
      resume = () => location.assign(withUa(url));
      settle();
    };
    window.navigation?.addEventListener('navigate', watch);
    try { fn(); } catch {}
    setTimeout(settle, 60); // a form submission starts its page load in a later task
    return decided.then(() => {
      window.navigation?.removeEventListener('navigate', watch);
      if (resume) setTimeout(resume, 120);
      return leaving;
    });
  }
  function setValue(el, value) {
    const text = String(value ?? '');
    if (el.matches('select')) {
      const want = text.toLowerCase();
      const option = [...el.options].find(o => o.value.toLowerCase() === want || clean(o.text).toLowerCase() === want);
      if (!option) return false;
      el.value = option.value;
    } else if (el.matches('input[type=checkbox],input[type=radio],[role=checkbox],[role=switch]')) {
      const on = !/^(false|off|no|0|unchecked)$/i.test(text);
      const now = el.matches('input') ? el.checked : el.getAttribute('aria-checked') === 'true';
      if (now !== on) press(el);
      return true;
    } else if (el.isContentEditable) {
      el.focus();
      el.textContent = text;
    } else {
      // The native setter, so pages that track the value themselves (React and others) see the change.
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      el.focus();
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, text);
    }
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function pressKey(el, key) {
    const keys = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, Space: 32 };
    const target = el || document.activeElement || document.body;
    const init = { key: key === 'Space' ? ' ' : key, code: key, keyCode: keys[key], which: keys[key], bubbles: true, cancelable: true, composed: true };
    const go = target.dispatchEvent(new KeyboardEvent('keydown', init));
    target.dispatchEvent(new KeyboardEvent('keyup', init));
    if (!go) return;
    // What the browser would do for a real key: Enter in a field sends its form; Enter on a button or link presses it.
    if (key === 'Enter' && target.form && target.matches('input')) target.form.requestSubmit();
    else if (key === 'Enter' && target.matches('a[href],button,[role=button],[role=link],summary')) press(target);
  }
  const textShown = text => {
    const want = clean(text, 400).toLowerCase();
    return !!want && pageText(200000).replace(/\s+/g, ' ').toLowerCase().includes(want);
  };
  async function runStep(step, ref) {
    const kind = step?.do;
    if (kind === 'open') {
      let url;
      try { url = new URL(step.path, location.origin); } catch { return { status: 'none', note: 'not an address on this site' }; }
      if (url.origin !== location.origin) return { status: 'none', note: 'another site' };
      if (step.fresh) { following = url.href; setTimeout(() => location.assign(withUa(url.href)), 0); return { status: 'navigated', leaving: true }; }
      const result = followAddress(url.href);
      return { ...result, leaving: result.status === 'navigated' && (url.pathname !== location.pathname || url.search !== location.search) };
    }
    if (kind === 'scroll') {
      const de = document.documentElement, max = de.scrollHeight - innerHeight;
      const y = { top: 0, bottom: max, up: scrollY - innerHeight * 0.8 }[step.to] ?? scrollY + innerHeight * 0.8;
      suppressUntil = now() + 500;
      scrollTo({ top: Math.max(0, Math.min(max, y)), behavior: 'instant' });
      return { status: 'direct' };
    }
    if (kind === 'expect') {
      const absent = step.absent === true;
      const deadline = now() + 3000;
      let shown = textShown(step.text);
      while (shown === absent && now() < deadline) { await sleep(150); shown = textShown(step.text); }
      return { status: shown !== absent ? 'pass' : 'fail' };
    }
    if (!['click', 'fill', 'press'].includes(kind)) return { status: 'none', note: 'unknown step' };
    let el = null, status = 'direct';
    if (step.target || ref) {
      ({ el, status } = await findStepControl(step.target, ref));
      if (!el) return { status };
    }
    const target = el ? stepTargetOf(el) : null;
    if (el) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch {} flash(el); }
    if (kind === 'fill') {
      if (!el || !el.matches(FIELD + ',[role=checkbox],[role=switch]')) return { status: 'none', note: 'not a field' };
      return setValue(el, step.value) ? { status, target } : { status: 'none', note: 'no such option', target };
    }
    if (kind === 'press') {
      const key = ['Enter', 'Escape', 'Tab', 'ArrowDown', 'ArrowUp', 'Space'].includes(step.key) ? step.key : 'Enter';
      if (el) el.focus?.();
      return { status, target, leaving: await actAndWatch(() => pressKey(el, key)) };
    }
    return { status, target, leaving: await actAndWatch(() => press(el)) };
  }

  /* ----------------------- outline and measurements ----------------------- */
  // DOM-based inspection, scoped to this preview. No field values or private text leave the frame.
  const OUTLINE_LIMIT = 800;
  const INSPECT_SOURCES = {
    headings: 'https://www.w3.org/WAI/tutorials/page-structure/headings/',
    landmarks: 'https://www.w3.org/WAI/tutorials/page-structure/regions/',
    focus: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html',
    contrast: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    target: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
    targetEnhanced: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html',
    text: 'https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html'
  };
  let outlineState = { headings: false, landmarks: false, focus: false, pick: false, selected: null };
  let outlineHost = null, outlineTimer = 0, outlineId = 0, outlineNodes = new Map(), outlineSwallowUntil = 0;
  const outlineIds = new WeakMap();
  const inspectKey = el => { if (!outlineIds.has(el)) outlineIds.set(el, 'outline-' + ++outlineId); const key = outlineIds.get(el); outlineNodes.set(key, el); return key; };
  const inspectRound = n => Math.round(n * 10) / 10;
  const inspectSuggestion = (title, detail, source, kind = 'recommendation') => ({ title, detail, kind, source: INSPECT_SOURCES[source] || INSPECT_SOURCES.headings });
  function inspectText(el) {
    if (!el || el.closest('[data-samestate-private],input,textarea,select,[contenteditable]')) return '';
    let text = '';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        return n.matches('input,textarea,select,[contenteditable],[data-samestate-private],script,style,noscript,template,[aria-hidden=true]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
    });
    for (let n = walker.nextNode(); n && text.length < 500; n = walker.nextNode()) text += n.textContent + ' ';
    return clean(text, 180);
  }
  function inspectName(el) {
    if (el.closest('[data-samestate-private]')) return '';
    const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => inspectText(document.getElementById(id))).join(' ');
    const label = clean(by || el.getAttribute('aria-label'), 180);
    if (label) return label;
    if (el.labels?.length) { const text = clean([...el.labels].map(inspectText).join(' '), 180); if (text) return text; }
    if (el.matches('input[type=submit],input[type=reset],input[type=button]')) return clean(el.value || (el.type === 'submit' ? 'Submit' : el.type === 'reset' ? 'Reset' : ''));
    if (el.matches('img,input[type=image]')) return clean(el.alt, 180);
    if (el.matches('input,textarea,select,[contenteditable]')) return clean(el.getAttribute('title'), 180);
    return inspectText(el) || clean(el.querySelector('img[alt]')?.alt || el.querySelector('svg title')?.textContent || el.getAttribute('title'), 180);
  }
  function inspectVisibility(el) {
    let atHidden = !!el.closest('[hidden],[aria-hidden=true],[inert]');
    for (let p = el; p && !atHidden; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || /hidden|collapse/.test(cs.visibility)) atHidden = true;
      if (p.tagName === 'DETAILS' && !p.open && !p.querySelector(':scope > summary')?.contains(el)) atHidden = true;
    }
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const clipped = (r.width <= 1 && r.height <= 1 && /hidden|clip/.test(cs.overflow)) || /inset\(50%\)|rect\(0px,? 0px,? 0px,? 0px\)/.test(cs.clipPath + cs.clip);
    return { hidden: !visible(el) || clipped, atHidden };
  }
  function inspectLandmark(el) {
    const explicit = (el.getAttribute('role') || '').trim().split(/\s+/)[0];
    if (explicit) return ['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'search', 'region', 'form'].includes(explicit) ? explicit : '';
    const tag = el.tagName;
    if (tag === 'MAIN') return 'main';
    if (tag === 'NAV') return 'navigation';
    if (tag === 'ASIDE') return 'complementary';
    if (tag === 'SEARCH') return 'search';
    if ((tag === 'FORM' || tag === 'SECTION') && inspectName(el) && (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || el.hasAttribute('title'))) return tag === 'FORM' ? 'form' : 'region';
    if (['HEADER', 'FOOTER'].includes(tag) && !el.parentElement?.closest('article,aside,main,nav,section,[role=article],[role=region],[role=main],[role=navigation],[role=complementary]')) return tag === 'HEADER' ? 'banner' : 'contentinfo';
    return '';
  }
  function inspectHeadingLevel(el) {
    const role = (el.getAttribute('role') || '').split(/\s+/)[0];
    if (role && role !== 'heading') return null;
    if (role === 'heading') { const n = Number(el.getAttribute('aria-level')); return Number.isInteger(n) && n > 0 ? n : 2; }
    return /^H[1-6]$/.test(el.tagName) ? Number(el.tagName[1]) : null;
  }
  function inspectRole(el) {
    const role = (el.getAttribute('role') || '').trim().split(/\s+/)[0];
    if (role) return clean(role, 60);
    if (inspectLandmark(el)) return inspectLandmark(el);
    if (inspectHeadingLevel(el)) return 'heading';
    if (el.matches('input')) return { radio: 'radio', checkbox: 'checkbox', range: 'slider', number: 'spinbutton', search: 'searchbox', button: 'button', submit: 'button', reset: 'button', image: 'button' }[el.type] || 'textbox';
    if (el.matches('select')) return el.multiple || el.size > 1 ? 'listbox' : 'combobox';
    if (el.matches('textarea,[contenteditable]')) return 'textbox';
    if (el.matches('a[href],area[href]')) return 'link';
    return { BUTTON: 'button', SUMMARY: 'button', IFRAME: 'frame', AUDIO: 'audio', VIDEO: 'video', IMG: 'image', P: 'paragraph', LI: 'listitem' }[el.tagName] || el.tagName.toLowerCase();
  }
  function inspectItem(el, extra = {}) {
    return { key: inspectKey(el), tag: el.tagName.toLowerCase(), name: el.closest('[data-samestate-private]') ? 'Private element' : inspectName(el), ...inspectVisibility(el), suggestions: [], ...extra };
  }
  function inspectInClosedDetails(el) {
    for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open && !p.querySelector(':scope > summary')?.contains(el)) return true;
    return false;
  }
  function outlineData() {
    for (const [key, el] of outlineNodes) if (!el.isConnected) outlineNodes.delete(key);
    const headings = [], landmarks = [], focus = [], suggestions = [];
    const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role~="heading"]')].filter(el => !own(el) && inspectHeadingLevel(el) !== null);
    let previous = 0;
    for (const el of hs.slice(0, OUTLINE_LIMIT)) {
      const item = inspectItem(el, { level: inspectHeadingLevel(el) });
      if (!item.atHidden) {
        if (!item.name) item.suggestions.push(inspectSuggestion('Give this heading a useful name', 'An empty heading does not describe its section. Add meaningful heading text.', 'headings', 'check'));
        if (previous && item.level > previous + 1) item.suggestions.push(inspectSuggestion('Review the heading hierarchy', `The outline jumps from level ${previous} to ${item.level}. Nest headings to reflect sections; returning to an earlier level is valid.`, 'headings'));
        previous = item.level;
      }
      if (el.getAttribute('role')?.split(/\s+/)[0] === 'heading' && !/^[1-9]\d*$/.test(el.getAttribute('aria-level') || '')) item.suggestions.push(inspectSuggestion('Set an explicit heading level', 'A role=heading element needs a positive aria-level. The browser fallback is level 2.', 'headings', 'check'));
      headings.push(item);
    }
    const ls = [...document.querySelectorAll('main,nav,header,footer,aside,search,section,form,[role]')].filter(el => !own(el) && inspectLandmark(el));
    for (const el of ls.slice(0, OUTLINE_LIMIT)) {
      const role = inspectLandmark(el), item = inspectItem(el, { role });
      // Region names come from their labelling attributes, not the region's entire text content.
      item.name = clean((el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => inspectText(document.getElementById(id))).join(' ') || el.getAttribute('aria-label') || el.getAttribute('title'), 180);
      if (el.closest('[data-samestate-private]')) item.name = 'Private element';
      if (['region', 'form'].includes(role) && !item.name && !item.atHidden) item.suggestions.push(inspectSuggestion('Name this region', 'Use aria-labelledby with a visible heading, or an appropriate aria-label, to identify its purpose.', 'landmarks', 'check'));
      landmarks.push(item);
    }
    const available = landmarks.filter(i => !i.atHidden), mains = available.filter(i => i.role === 'main');
    if (mains.length !== 1) suggestions.push(inspectSuggestion(mains.length ? 'Review multiple main landmarks' : 'Add a main landmark', 'Use a main region for the page content. Keep one main landmark exposed in this document; hidden alternatives do not count.', 'landmarks'));
    for (const role of ['navigation', 'complementary', 'region', 'form']) {
      const items = available.filter(i => i.role === role);
      if (items.length > 1) for (const item of items) if (!item.name) item.suggestions.push(inspectSuggestion('Distinguish regions with a name', `There are ${items.length} ${role} regions. Label regions with different purposes; repeated navigation with the same purpose can share a name.`, 'landmarks'));
    }
    if (!headings.some(i => !i.atHidden && i.level === 1)) suggestions.push(inspectSuggestion('Provide a clear page heading', 'A descriptive level-1 heading helps identify the page. This is a structure recommendation, not a standalone WCAG failure.', 'headings'));
    let modal = null; try { modal = document.querySelector('dialog:modal'); } catch {}
    const candidates = [...document.querySelectorAll('a[href],area[href],button,input:not([type=hidden]),select,textarea,summary,iframe,object,embed,audio[controls],video[controls],[contenteditable],[tabindex]')].filter(el => !own(el) && el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert]') && !inspectInClosedDetails(el) && el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible' && (!modal || modal.contains(el)));
    const radios = new Map();
    for (const el of candidates) if (el.matches('input[type=radio][name]') && el.name) {
      const scope = el.form || el.getRootNode(); if (!radios.has(scope)) radios.set(scope, new Map());
      const groups = radios.get(scope); if (!groups.has(el.name)) groups.set(el.name, []); groups.get(el.name).push(el);
    }
    const filtered = candidates.filter(el => { if (!el.matches('input[type=radio][name]') || !el.name) return true; const group = radios.get(el.form || el.getRootNode()).get(el.name); return el === (group.find(r => r.checked) || group[0]); });
    const sorted = filtered.map((el, index) => ({ el, index })).sort((a, b) => (a.el.tabIndex > 0 ? a.el.tabIndex : Infinity) - (b.el.tabIndex > 0 ? b.el.tabIndex : Infinity) || a.index - b.index);
    for (const [index, { el }] of sorted.slice(0, OUTLINE_LIMIT).entries()) {
      const item = inspectItem(el, { order: index + 1, role: inspectRole(el), tabindex: el.tabIndex });
      if (item.hidden && !item.atHidden) item.suggestions.push(inspectSuggestion('Verify hidden or off-screen focus targets', 'An off-screen skip link may be intentional. Check that it becomes visible on focus and that keyboard users can see where they are.', 'focus', 'review'));
      if (item.atHidden) item.suggestions.push(inspectSuggestion('Focusable content is hidden from assistive technology', 'This control can receive Tab focus but has aria-hidden or another hidden ancestor. Remove it from Tab order while hidden, or expose its meaning.', 'focus', 'check'));
      if (el.tabIndex > 0) item.suggestions.push(inspectSuggestion('Prefer the document focus order', `tabindex=${el.tabIndex} moves this control before ordinary controls. Prefer DOM order with native focusability or tabindex=0; verify meaning and keyboard operation.`, 'focus'));
      if (!item.name && !el.closest('[data-samestate-private]')) item.suggestions.push(inspectSuggestion('Check this control’s accessible name', 'Add a visible label or an appropriate accessible name. The simplified DOM name calculation may miss custom component behaviour.', 'focus', 'review'));
      focus.push(item);
    }
    const truncated = hs.length > OUTLINE_LIMIT || ls.length > OUTLINE_LIMIT || sorted.length > OUTLINE_LIMIT;
    return { url: location.href, title: clean(document.title, 200), viewport: { width: document.documentElement.clientWidth, height: innerHeight }, headings, landmarks, focus, suggestions, truncated, limits: 'DOM estimate: nested frames and shadow roots are not traversed. Verify actual Tab/Shift+Tab, modal and custom-widget behaviour. Radio groups use the checked option, or the first available option.' };
  }
  function elementMeasurements(el) {
    if (!el?.isConnected || own(el)) return null;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el), hidden = inspectVisibility(el), suggestions = [];
    const number = p => inspectRound(parseFloat(cs[p]) || 0), edges = prefix => Object.fromEntries(['Top','Right','Bottom','Left'].map(e => [e.toLowerCase(), number(prefix + e)]));
    const fontSize = number('fontSize'), lineHeight = cs.lineHeight === 'normal' ? null : number('lineHeight');
    const opacity = (() => { for (let p = el; p; p = p.parentElement) if (Number(getComputedStyle(p).opacity) < 1) return true; return false; })();
    const contrast = !hidden.hidden && !opacity && hasOwnText(el) ? contrastOf(el, cs, new Map()) : null;
    const large = fontSize >= 24 || fontSize >= 18.66 && Number(cs.fontWeight) >= 700, required = large ? 3 : 4.5;
    if (contrast !== null && contrast < required && !el.matches(':disabled,[aria-disabled=true]')) suggestions.push(inspectSuggestion('Review text contrast', `${contrast}:1 measured; ${large ? 'large' : 'normal'} text generally needs ${required}:1 (WCAG 1.4.3 AA). Logos and incidental text have exceptions. Verify the actual background and text purpose.`, 'contrast', 'check'));
    const target = el.matches(TARGETS), inline = el.matches('a[href]') && cs.display === 'inline';
    if (target && !hidden.hidden && !el.matches(':disabled')) {
      if (r.width < 24 || r.height < 24) suggestions.push(inspectSuggestion('Review the pointer target', `${inspectRound(r.width)} × ${inspectRound(r.height)} CSS px. WCAG 2.5.8 AA generally uses 24 × 24 CSS px, with spacing, inline, equivalent, browser-control and essential exceptions.${inline ? ' This inline link may qualify for an exception.' : ''} Increase the clickable area where appropriate.`, 'target', 'review'));
      else if (r.width < 44 || r.height < 44) suggestions.push(inspectSuggestion('Consider a larger touch target', '44 × 44 CSS px is a useful touch target goal (WCAG 2.5.5 AAA has exceptions). Meeting 24 × 24 does not require 44 × 44 at AA.', 'targetEnhanced'));
    }
    const cpl = el.matches('p,li,blockquote,dd') ? charsPerLine(el, cs, r.height) : 0;
    if (cpl > 80) suggestions.push(inspectSuggestion('Shorten long reading lines', `About ${cpl} characters per line is estimated. Consider max-inline-size around 65–75ch. WCAG 1.4.8 AAA describes a user-adjustable limit of 80 characters, or 40 for CJK; this estimate alone is not a conformance result.`, 'text'));
    if (el.matches('p,li,blockquote,dd') && lineHeight && lineHeight / fontSize < 1.5) suggestions.push(inspectSuggestion('Consider more line spacing', `${(lineHeight / fontSize).toFixed(2)}× font size measured. Around 1.5 line height can improve reading comfort. The AAA visual-presentation criterion allows a mechanism for users to adjust this; the default alone is not a failure.`, 'text'));
    if (hidden.hidden) suggestions.push(inspectSuggestion('This element is not visually available', 'Hidden, clipped or off-canvas content can be intentional. Verify it becomes available when its control is activated, and test the actual accessibility tree.', 'focus', 'review'));
    return { key: inspectKey(el), tag: el.tagName.toLowerCase(), name: el.closest('[data-samestate-private]') ? 'Private element' : inspectName(el), role: inspectRole(el), ...hidden,
      rect: { x: inspectRound(r.left + scrollX), y: inspectRound(r.top + scrollY), width: inspectRound(r.width), height: inspectRound(r.height) },
      viewport: { left: inspectRound(r.left), top: inspectRound(r.top), right: inspectRound(document.documentElement.clientWidth - r.right), bottom: inspectRound(innerHeight - r.bottom) },
      margin: edges('margin'), padding: edges('padding'), border: Object.fromEntries(['Top','Right','Bottom','Left'].map(e => [e.toLowerCase(), number('border' + e + 'Width')])),
      typography: { fontFamily: cs.fontFamily, fontSize, lineHeight, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing, charsPerLine: cpl || null },
      colors: { text: cs.color, background: cs.backgroundColor, contrast, contrastTarget: required }, display: cs.display, gap: cs.gap, boxSizing: cs.boxSizing, suggestions };
  }
  function setOutlineState(value = {}) {
    outlineState = { headings: value.headings === true, landmarks: value.landmarks === true, focus: value.focus === true, pick: value.pick === true, selected: typeof value.selected === 'string' ? value.selected : null };
    drawOutline();
  }
  function drawOutline() {
    clearTimeout(outlineTimer); outlineTimer = 0;
    if (!Object.values(outlineState).some(Boolean)) { outlineHost?.remove(); outlineHost = null; return; }
    if (!outlineHost?.isConnected) { outlineHost = document.createElement('div'); outlineHost.dataset.samestateOutline = ''; outlineHost.setAttribute('aria-hidden', 'true'); outlineHost.attachShadow({ mode: 'open' }); getLayer().appendChild(outlineHost); }
    outlineHost.style.cssText = `all:initial!important;position:fixed!important;inset:0!important;width:${document.documentElement.clientWidth}px!important;height:${innerHeight}px!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;pointer-events:none!important;z-index:20!important`;
    const drawing = outlineHost.shadowRoot;
    drawing.replaceChildren();
    const color = '#367c9d', labelStyle = 'position:absolute;padding:1px 4px;border-radius:3px;background:#1f526d;color:white;font:11px/1.4 system-ui,sans-serif;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    const box = (el, title, selected = false) => {
      if (!visible(el)) return;
      const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      const node = document.createElement('div'); node.style.cssText = `position:absolute;box-sizing:border-box;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border:2px solid ${selected ? '#2563eb' : color};background:${selected ? '#3b82f615' : 'transparent'}`;
      const label = document.createElement('span'); label.style.cssText = labelStyle + `;left:${Math.max(0, Math.min(r.left, innerWidth - 260))}px;top:${Math.max(0, r.top)}px`; label.textContent = title;
      drawing.append(node, label);
    };
    if (outlineState.headings || outlineState.landmarks || outlineState.focus) {
      const data = outlineData();
      if (outlineState.landmarks) for (const item of data.landmarks.slice(0, 150)) box(outlineNodes.get(item.key), item.role + (item.name ? ': ' + item.name : ''));
      if (outlineState.headings) for (const item of data.headings.slice(0, 200)) box(outlineNodes.get(item.key), `h${item.level} · ${item.name || '(unnamed)'}`);
      if (outlineState.focus) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.dataset.outlineFocus = ''; svg.setAttribute('width', String(innerWidth)); svg.setAttribute('height', String(innerHeight)); svg.style.cssText = `position:absolute;inset:0;overflow:hidden;width:${document.documentElement.clientWidth}px;height:${innerHeight}px`;
        const defs = document.createElementNS(svg.namespaceURI, 'defs'), marker = document.createElementNS(svg.namespaceURI, 'marker'), path = document.createElementNS(svg.namespaceURI, 'path');
        marker.id = 'samestate-outline-arrow'; marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '10'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '5'); marker.setAttribute('markerHeight', '5'); marker.setAttribute('orient', 'auto'); path.setAttribute('d', 'M0 0L10 5L0 10Z'); path.setAttribute('fill', color); marker.append(path); defs.append(marker); svg.append(defs);
        let previous = null;
        for (const item of data.focus.slice(0, 200)) {
          const r = outlineNodes.get(item.key).getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
          if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) continue;
          if (previous) { const line = document.createElementNS(svg.namespaceURI, 'line'); for (const [key, value] of Object.entries({ x1: previous.x, y1: previous.y, x2: x, y2: y, stroke: color, 'stroke-width': 1.5, 'marker-end': 'url(#samestate-outline-arrow)' })) line.setAttribute(key, String(value)); svg.append(line); }
          const circle = document.createElementNS(svg.namespaceURI, 'circle'); for (const [key, value] of Object.entries({ cx: x, cy: y, r: 10, fill: 'white', stroke: color, 'stroke-width': 1.5 })) circle.setAttribute(key, String(value));
          const label = document.createElementNS(svg.namespaceURI, 'text'); label.setAttribute('x', String(x)); label.setAttribute('y', String(y + 4)); label.setAttribute('text-anchor', 'middle'); label.setAttribute('fill', '#174661'); label.style.cssText = 'font:10px system-ui,sans-serif'; label.textContent = item.order;
          svg.append(circle, label); previous = { x, y };
        }
        drawing.append(svg);
      }
    }
    const selected = outlineNodes.get(outlineState.selected);
    if (selected?.isConnected) { const r = selected.getBoundingClientRect(); box(selected, `${inspectRound(r.width)} × ${inspectRound(r.height)} CSS px`, true); }
    if (outlineState.pick) { const label = document.createElement('span'); label.style.cssText = labelStyle + ';left:8px;top:8px;background:#1e40af'; label.textContent = 'Click an element to measure · Escape to cancel'; drawing.append(label); }
  }
  function scheduleOutline() {
    if (!outlineHost && !outlineState.pick) return;
    clearTimeout(outlineTimer); outlineTimer = setTimeout(drawOutline, 120);
  }
  function interceptInspection(event) {
    if (event.type === 'click' && now() < outlineSwallowUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!outlineState.pick || own(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.type === 'click' || event.type === 'touchend') {
      if (event.type === 'touchend') outlineSwallowUntil = now() + 500;
      const el = event.composedPath().find(n => n?.nodeType === 1 && !own(n));
      outlineState.pick = false;
      if (el) { outlineState.selected = inspectKey(el); drawOutline(); send('inspection-pick', { data: elementMeasurements(el) }); }
    }
  }
  addEventListener('keydown', event => {
    if (outlineState.pick && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); outlineState.pick = false; drawOutline(); send('inspection-pick', { data: null }); }
  }, true);
  addEventListener('scroll', scheduleOutline, { capture: true, passive: true });
  addEventListener('resize', scheduleOutline, { passive: true });
  new MutationObserver(records => {
    if (records.some(r => !own(r.target) && (r.type !== 'childList' || [...r.addedNodes, ...r.removedNodes].some(n => !own(n))))) scheduleOutline();
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class','style','hidden','aria-hidden','inert','tabindex','role','aria-level','aria-label','disabled','checked','open'] });

  /* ------------------------------ shell messages ------------------------------ */
  let themeStyle;
  function applyPreviewTheme(css) {
    if (!css) {
      themeStyle?.remove();
      return;
    }
    themeStyle ??= document.createElement('style');
    if (themeStyle.textContent !== css) themeStyle.textContent = css;
    if (!themeStyle.isConnected) document.documentElement.append(themeStyle);
  }

  let queue = Promise.resolve(), lastLook = null; // what the last config set: touch, theme, long text and screen setting
  async function receive(m) {
    if (!m?.__samestateShell) return;
    // Samestate's own changes are not the page's layout shifts. Config arrives on every page load, so it only counts when it changes something.
    if (!['snapshot', 'state', 'look', 'config', 'outline-read', 'outline-measure', 'outline-state'].includes(m.type)) quietUntil = performance.now() + 800;
    if (m.type === 'config') {
      const tools = Array.isArray(m.debug) ? m.debug.filter(id => typeof id === 'string') : [], sim = typeof m.sim === 'string' ? m.sim : '';
      const look = JSON.stringify([m.touch === true, m.themeCss || '', m.longText === true, m.variant || '', tools, sim]);
      if (look !== lastLook && (lastLook !== null || m.themeCss || m.longText === true || m.variant || tools.length || sim)) quietUntil = performance.now() + 800; // a page that starts plain loads with no quiet time
      lastLook = look;
      cfg.inspect = m.inspect !== false;
      cfg.touch = m.touch === true;
      cfg.pageSteps = m.pageSteps === true;
      if (cfg.textSalt !== m.textSalt) {
        cfg.textSalt = m.textSalt;
        cfg.textKey = typeof m.textSalt === 'string' && crypto.subtle
          ? crypto.subtle.importKey('raw', encoder.encode(m.textSalt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
          : null;
      }
      applyTouchMode();
      if (m.outline) setOutlineState(m.outline);
      applyPreviewTheme(m.themeCss);
      if (m.grid && typeof m.grid === 'object') { const g = m.grid, n = (v, lo, hi, d) => Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d; gridConfig = { columns: n(g.columns, 1, 24, 12), gutter: n(g.gutter, 0, 200, 24), maxWidth: n(g.maxWidth, 0, 5000, 1200), margin: n(g.margin, 0, 400, 16), baseline: n(g.baseline, 2, 100, 8) }; }
      const nextLang = typeof m.lang === 'string' ? m.lang.slice(0, 35) : '';
      if (nextLang !== screenLang && variant === 'lang') setVariant(''); // a new language for the same setting
      screenLang = nextLang;
      if (document.body) { setLongText(m.longText === true); setVariant(VARIANTS.includes(m.variant) ? m.variant : ''); setDebug(tools, sim); }
    }
    else if (m.type === 'fix' && typeof m.id === 'string') send('fixed', { id: m.id, count: applyFix(m.id, m.keys, m.css) });
    else if (m.type === 'unfix' && typeof m.id === 'string') removeFix(m.id);
    else if (m.type === 'replay-step' && Array.isArray(m.actions)) await replayStep(m.actions);
    else if (m.type === 'reload') reloadPage();
    else if (m.type === 'identity' && typeof m.name === 'string' && (m.name === '' || m.name.startsWith('samestate-device:'))) {
      // The device identity emulate.js reads when a page loads. Only Samestate's own names are accepted.
      if (window.name !== m.name && (m.name || window.name.startsWith('samestate-device:'))) window.name = m.name;
      if (m.reload) reloadPage();
    }
    else if (m.type === 'state') send('state', { rid: m.rid, url: location.href, scroll: scrollState() });
    else if (m.type === 'align') {
      // Asked for by the user with "Align screens": go to the page the leading screen is on, then to its scroll position.
      let url = null;
      try { url = new URL(m.url); url.searchParams.delete(UA_MARK); } catch {}
      if (m.navigate && url && url.origin === location.origin && (url.pathname !== location.pathname || url.search !== location.search)) {
        send('aligning');
        location.assign(withUa(url.href));
      } else if (m.scroll) applyScroll(m.scroll);
    }
    else if (m.type === 'demo' && demo) runDemo(m);
    else if (m.type === 'look' && typeof m.rid === 'string') {
      let data = null;
      try { data = look(); } catch {}
      send('looked', { rid: m.rid, data });
    }
    else if (m.type === 'step' && typeof m.rid === 'string') {
      let result;
      try { result = await runStep(m.step, Number.isInteger(m.ref) ? m.ref : null); } catch { result = { status: 'none' }; }
      send('stepped', { rid: m.rid, ...result });
    }
    else if (m.type === 'snapshot') {
      let data = null;
      try { data = await snapshot({ links: m.links === true }); } catch {}
      send('snapshot', { rid: m.rid, data });
    }
    else if (m.type === 'outline-read' && typeof m.rid === 'string') {
      let data = null; try { data = outlineData(); } catch {}
      send('outlined', { rid: m.rid, data });
    }
    else if (m.type === 'outline-state') setOutlineState(m.state);
    else if (m.type === 'outline-measure' && typeof m.rid === 'string') {
      const el = outlineNodes.get(m.key); let data = null;
      if (m.reveal && visible(el)) { const r = el.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) { suppressUntil = now() + 800; el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); } }
      try { data = elementMeasurements(el); } catch {}
      if (data && m.highlight) { outlineState.selected = data.key; drawOutline(); }
      send('element-measured', { rid: m.rid, data });
    }
    else if (m.type === 'design') setDesign(m.design);
    else if (m.type === 'find' && typeof m.rid === 'string') send('found', { rid: m.rid, ...findElements(typeof m.selector === 'string' ? m.selector.slice(0, 500) : '', Number(m.index) || 0) });
    else if (m.type === 'autofill' && ['valid', 'edge', 'clear'].includes(m.mode)) send('filled', { count: fillForms(m.mode), mode: m.mode });
    else if (m.type === 'breakpoints' && typeof m.rid === 'string') send('breakpoints', { rid: m.rid, values: cssBreakpoints() });
    else if (m.type === 'fingerprint' && typeof m.rid === 'string') send('fingerprint', { rid: m.rid, ...(await siteFingerprint()) });
    else if (m.type === 'reload-css') reloadCss();
    else if (m.type === 'page-size' && typeof m.rid === 'string') send('page-size', { rid: m.rid, ...pageSize() });
    else if (m.type === 'scroll-to') { suppressUntil = now() + 600; window.scrollTo({ top: Number(m.y) || 0, left: 0, behavior: 'instant' }); send('scrolled', { rid: m.rid, y: scrollY }); }
    else if (m.type === 'hide-fixed') hideFixed(m.on === true);
    else if (m.type === 'peek-twin' && m.d) { const { el } = await findTarget(m.d); if (el) ring(el, '#22d3ee', 600); }
    else if (m.type === 'highlight') {
      const els = []; for (const k of m.keys || []) for (const el of snapMap.get(k) || []) if (el.isConnected) els.push(el);
      const first = els.find(visible) || els[0];
      if (first) { suppressUntil = now() + 800; first.scrollIntoView({ block: 'center', behavior: 'instant' }); }
      setTimeout(() => els.filter(visible).slice(0, 40).forEach(el => ring(el, '#ffb020', 2600)), 60);
    } else if (m.type === 'act' && Object.hasOwn(handlers, m.kind)) {
      const runIt = async () => { let r = null; try { r = await handlers[m.kind](m); } catch { r = { status: 'none' }; } if (r && m.aid) send('result', Object.assign({ aid: m.aid }, r)); };
      if (m.kind === 'media' || /hover|scroll/.test(m.kind)) runIt(); else queue = queue.then(runIt);
    }
  }

  addEventListener('message', event => {
    if (event.source !== parent || event.origin !== EXT) return;
    if (demo) {
      receive(event.data);
    } else if (event.data?.type === 'connect' && !port) {
      port = chrome.runtime.connect({ name: 'samestate-preview' });
      port.onDisconnect.addListener(() => { port = null; });
      port.onMessage.addListener(receive);
      port.postMessage({ token: event.data.token });
    }
  });

  function ready() {
    if (demo) send('hello');
    else parent.postMessage({ __samestateReady: true }, EXT);
  }

  ready();
  addEventListener('pageshow', ready);
})();
