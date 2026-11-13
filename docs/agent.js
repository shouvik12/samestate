/* Mirrors controls and measures layout using element structure and geometry. */
(() => {
  'use strict';
  const tag = document.currentScript, ext = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  const demo = !!tag?.matches('script[data-samestate="demo"]');
  const EXT = demo ? location.origin : ext ? 'chrome-extension://' + ext : null;
  if (!EXT || window.__samestate || window.parent === window || window.parent !== window.top) return;
  if (!location.ancestorOrigins || location.ancestorOrigins[0] !== EXT) return; // only inside a Samestate device frame
  window.__samestate = true;
  const cfg = { touch: false, inspect: false };
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
      .filter(el => canMirrorClick(el) && kindOf(el) === description.kind && visible(el)).slice(0, 400)
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

  function canMirrorClick(el) {
    if (demo && el.matches('#signin .close')) return true;
    if (el.closest(playerControl)) return false;
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
    const candidates = matchingControls(description).filter(canMirrorClick);
    if (description.textKey && cfg.textKey && !description.demoControl) {
      const structural = candidates.find(visible);
      if (structural && await textFingerprint(structural) === description.textKey) return { el: structural, status: 'direct' };
      const eligible = Array.from(document.querySelectorAll(ACTIONABLE))
        .filter(el => el !== structural && canMirrorClick(el) && kindOf(el) === description.kind && visible(el)).slice(0, 300);
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

  function mirrorClick(el) {
    const description = describe(el);
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
  }, true);

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
    if (!cfg.inspect || !e.isTrusted || cfg.touch) return;
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
    if (!cfg.touch || !e.isTrusted || e.target.closest?.('form,input,textarea,select,[contenteditable]') || e.pointerType !== 'mouse' || e.button !== 0) return;
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

  /* --------------------------- snapshot for diffing --------------------------- */
  let snapMap = new Map();
  async function snapshot() {
    snapMap = new Map();
    const de = document.documentElement, vw = de.clientWidth, items = [], textTasks = [];
    const reg = (key, el) => { if (!snapMap.has(key)) snapMap.set(key, []); snapMap.get(key).push(el); };
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
      items.push(item);
      if (cfg.textKey && vis && ['heading', 'text', 'button', 'link'].includes(cat)) {
        textTasks.push(textFingerprint(el).then(key => { if (key) item.textKey = key; }));
      }
    };
    const hasTextNode = el => Array.from(el.childNodes).some(node => node.nodeType === Node.TEXT_NODE);
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => push('heading', el, { level: Number(el.tagName[1]) }));
    document.querySelectorAll('p,li,blockquote,figcaption,dd,dt').forEach(el => {
      if (hasTextNode(el)) push('text', el);
    });
    document.querySelectorAll('a[href],button,[role=button],input:not([type=hidden]),select,textarea,summary,[role=tab]').forEach(el => {
      const kind = kindOf(el);
      const field = ['field', 'select', 'check'].includes(kind);
      const inline = kind === 'link' && getComputedStyle(el).display === 'inline' && hasTextNode(el.parentElement);
      push(field ? 'input' : kind === 'link' ? 'link' : 'button', el, { kind, inline });
    });
    document.querySelectorAll('img').forEach(el => {
      push('image', el, { natW: el.naturalWidth, broken: el.complete && el.naturalWidth === 0 && el.matches('img[src],img[srcset],picture img') });
    });
    document.querySelectorAll('table').forEach(el => {
      let scroller = null;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
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
      if (/auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 4) { const key = 'sc|' + scrollers.length; reg(key, el); scrollers.push({ key, name: 'scroll area', snap: cs.scrollSnapType && cs.scrollSnapType !== 'none', table: !!el.querySelector('table') }); }
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
    await Promise.all(textTasks);
    return {
      vw, docW: de.scrollWidth, metaViewport: !!document.querySelector('meta[name=viewport]'),
      items, overflow, scrollers, fixed,
      menuToggle: Array.from(document.querySelectorAll('[aria-haspopup=menu],[aria-controls][aria-expanded]')).some(visible)
    };
  }

  async function runDemo(m) {
    const el = m.sel && document.querySelector(m.sel); if (!el) return; send('active');
    if (m.do === 'click' && canMirrorClick(el)) { flash(el); press(el); mirrorClick(el); }
    else if (m.do === 'scroll') { const y0 = scrollY, y = el.getBoundingClientRect().top + scrollY - 90; for (let i = 1; i <= 28; i++) { window.scrollTo({ top: y0 + (y - y0) * i / 28, behavior: 'instant' }); act('scroll', scrollState()); await sleep(28); } }
    else if (m.do === 'step' && cfg.pageSteps) { // the tour's clicks are synthetic, so Page steps is told directly what a real click would open
      flash(el);
      const link = el.closest('a[href]');
      if (!(link && openPageInWall(link.href)) && journeyControl(el)) sendPageStep('open-state', { url: location.href, action: describe(el) });
    }
  }

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

  let queue = Promise.resolve();
  async function receive(m) {
    if (!m?.__samestateShell) return;
    if (m.type === 'config') {
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
      applyPreviewTheme(m.themeCss);
    }
    else if (m.type === 'replay-step' && Array.isArray(m.actions)) await replayStep(m.actions);
    else if (m.type === 'reload') location.reload();
    else if (m.type === 'state') send('state', { rid: m.rid, url: location.href, scroll: scrollState() });
    else if (m.type === 'align') {
      // Asked for by the user with "Align screens": go to the page the leading screen is on, then to its scroll position.
      let url = null;
      try { url = new URL(m.url); } catch {}
      if (m.navigate && url && url.origin === location.origin && (url.pathname !== location.pathname || url.search !== location.search)) {
        send('aligning');
        location.assign(url.href);
      } else if (m.scroll) applyScroll(m.scroll);
    }
    else if (m.type === 'demo' && demo) runDemo(m);
    else if (m.type === 'snapshot') {
      let data = null;
      try { data = await snapshot(); } catch {}
      send('snapshot', { rid: m.rid, data });
    }
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
