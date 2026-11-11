/* Samestate sync agent — injected into each device frame of a Samestate tab.
 * Captures real user interactions as *semantic* descriptions ("click the Pricing link",
 * "scroll to 40% of the Features section") and replays them by meaning on other devices,
 * opening menus / drawers / accordions first when the equivalent control is tucked away. */
(() => {
  'use strict';
  const tag = document.currentScript, ext = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  const EXT = tag ? (tag.dataset.samestate ? location.origin : null) : ext ? 'chrome-extension://' + ext : null; // who may drive this frame
  if (!EXT || window.__samestate || window.parent === window || window.parent !== window.top) return;
  if (!location.ancestorOrigins || location.ancestorOrigins[0] !== EXT) return; // only inside a Samestate device frame
  window.__samestate = true;
  const cfg = { touch: false };
  const send = (type, data) => { try { parent.postMessage(Object.assign({ __samestate: 1, type }, data), EXT); } catch (e) {} };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 80);
  const now = () => Date.now();

  const ACTIONABLE = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=switch],[role=checkbox],[role=option],[onclick],[data-toggle],[data-bs-toggle],[aria-controls],[aria-expanded],[tabindex]:not([tabindex="-1"])';
  const TEXTY = /^(text|email|search|password|tel|url|number|date|time|month|week|datetime-local|)$/;

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
      if (cs.position === 'fixed' && (r.left >= vw || r.right <= 0 || r.top >= vh || r.bottom <= 0)) return false; // off-canvas drawer
      if (a !== el && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible')) {
        const ar = a.getBoundingClientRect();
        if (cs.overflowY !== 'visible' && (r.bottom <= ar.top + 1 || r.top >= ar.bottom - 1) && cs.overflowY === 'hidden') return false; // collapsed panel
        if (cs.overflowX === 'hidden' && (r.right <= ar.left + 1 || r.left >= ar.right - 1)) return false;
      }
    }
    return true;
  }

  function nameOf(el) {
    let n = el.getAttribute('aria-label');
    if (!n) { const lb = el.getAttribute('aria-labelledby'); if (lb) n = lb.split(/\s+/).map(i => { const x = document.getElementById(i); return x ? x.textContent : ''; }).join(' '); }
    if (!n && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) n = (el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute('placeholder') || el.name || el.title || (/^(submit|button|reset)$/.test(el.type) ? el.value : '') || el.type;
    if (!n && el.tagName === 'IMG') n = el.alt;
    if (!n) n = el.textContent;
    if (!norm(n) && el.querySelector) { const im = el.querySelector('img[alt],svg title'); if (im) n = im.getAttribute('alt') || im.textContent; }
    if (!norm(n)) n = el.getAttribute('title') || '';
    return norm(n);
  }

  function kindOf(el, name) {
    const tag = el.tagName, role = el.getAttribute('role') || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (tag === 'SELECT') return 'select';
      if (/^(checkbox|radio)$/.test(el.type)) return 'check';
      if (/^(submit|button|reset|image)$/.test(el.type)) return 'button';
      return (el.type === 'search' || /search/i.test(el.name + ' ' + el.id + ' ' + (el.placeholder || '') + ' ' + name)) ? 'search-field' : 'field';
    }
    const cls = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
    const sig = cls + ' ' + el.id + ' ' + name;
    const href = tag === 'A' ? (el.getAttribute('href') || '') : '';
    const realLink = href && href[0] !== '#' && !/^javascript:/i.test(href);
    const btnish = tag === 'BUTTON' || tag === 'SUMMARY' || role === 'button' || el.hasAttribute('aria-expanded') || el.hasAttribute('aria-controls') || !realLink;
    if (!realLink && btnish && /(^|[^a-z])(menu|hamburger|burger|nav-?toggle|navbar-toggler|drawer|sidebar|navigation)/i.test(sig) && role !== 'menuitem') return 'menu-toggle';
    if (!realLink && /search/i.test(sig)) return 'search-toggle';
    if (!realLink && (/(^|[^a-z])(close|dismiss)/i.test(sig) || /^(×|✕|✖|x)$/.test(name))) return 'close';
    if (role === 'tab') return 'tab';
    if (tag === 'SUMMARY' || el.hasAttribute('aria-expanded')) return 'disclosure';
    if (realLink) return 'link';
    return 'button';
  }

  function cssPath(el) {
    const parts = []; let e = el;
    while (e && e.nodeType === 1 && e !== document.body && e !== document.documentElement) {
      if (e.id && /^[A-Za-z][\w-]*$/.test(e.id)) { parts.unshift('#' + e.id); break; }
      let i = 1, s = e; while ((s = s.previousElementSibling)) if (s.tagName === e.tagName) i++;
      parts.unshift(e.tagName.toLowerCase() + ':nth-of-type(' + i + ')'); e = e.parentElement;
    }
    return parts.join('>');
  }
  function hrefOf(el) {
    if (el.tagName !== 'A' || !el.getAttribute('href')) return '';
    try { const u = new URL(el.href); return u.origin === location.origin ? (u.pathname.replace(/\/+$/, '') || '/') + u.search + u.hash : u.href; } catch (e) { return ''; }
  }
  function desc(el) {
    const name = nameOf(el), lm = el.closest('nav,header,footer,main,aside,dialog,[role=dialog],form');
    return {
      tag: el.tagName, role: el.getAttribute('role') || '', name, kind: kindOf(el, name), href: hrefOf(el),
      id: /^[A-Za-z][\w-]*$/.test(el.id || '') ? el.id : '', testid: el.getAttribute('data-testid') || el.getAttribute('data-test') || '',
      nameAttr: el.getAttribute('name') || '', type: el.getAttribute('type') || '', landmark: lm ? lm.tagName : '',
      path: cssPath(el), generic: !el.matches(ACTIONABLE)
    };
  }
  function actionable(t) {
    if (!t || t.nodeType !== 1) t = t && t.parentElement; if (!t) return null;
    const a = t.closest(ACTIONABLE); if (a) return a;
    let best = null;
    for (let e = t; e && e !== document.body; e = e.parentElement) { if (getComputedStyle(e).cursor === 'pointer') best = e; else break; }
    return best;
  }
  function locate(d) {
    let el = d.id && document.getElementById(d.id);
    if (!el && d.path) { try { el = document.querySelector(d.path); } catch (e) {} }
    return el || null;
  }

  /* --------------------- finding the equivalent element --------------------- */
  function rank(d) {
    if (d.generic) { const el = locate(d); return el ? [{ el, s: 50, same: true }] : []; }
    const out = [];
    for (const el of document.querySelectorAll(ACTIONABLE)) {
      const c = desc(el); let s = 0, strong = false;
      if (d.id && c.id === d.id) { s += 50; strong = true; }
      if (d.testid && c.testid === d.testid) { s += 50; strong = true; }
      if (d.href && c.href === d.href) { s += 35; strong = true; }
      if (d.name && c.name === d.name) { s += 30; strong = true; }
      else if (d.name && c.name && d.name.length > 2 && c.name.length > 2 && (c.name.includes(d.name) || d.name.includes(c.name))) s += 12;
      if (d.nameAttr && c.nameAttr === d.nameAttr) { s += 30; strong = true; }
      if (c.path === d.path) { s += 25; if (c.kind === d.kind) strong = true; }
      if (c.kind === d.kind) s += 15;
      if (c.tag === d.tag) s += 5;
      if (d.type && c.type === d.type) s += 5;
      if (c.landmark === d.landmark) s += 5;
      if (d.name && c.name && c.name !== d.name && !d.href && !(d.id && c.id === d.id)) s -= 25; // same slot, different label → probably a different control
      if (strong && s >= 40) out.push({ el, s, same: c.path === d.path || (d.id && c.id === d.id) });
    }
    return out.sort((a, b) => b.s - a.s).slice(0, 12);
  }
  const hiddenRoot = a => { const cs = getComputedStyle(a); return a.hidden || cs.display === 'none' || cs.visibility === 'hidden' || a.getBoundingClientRect().height < 1; };
  const closedToggle = (c, tried, self) => c && c !== self && !tried.has(c) && c.getAttribute('aria-expanded') !== 'true' && visible(c);

  function controllerFor(el, tried) { // which visible control reveals this hidden element?
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      if (a.tagName === 'DETAILS' && !a.open) { const s = a.querySelector(':scope>summary'); if (closedToggle(s, tried, el)) return s; }
      if (a.id) {
        const id = CSS.escape(a.id);
        for (const c of document.querySelectorAll(`[aria-controls~="${id}"],[data-target="#${id}"],[data-bs-target="#${id}"],a[href="#${id}"],[popovertarget="${id}"]`)) if (closedToggle(c, tried, el)) return c;
      }
      if (a !== el && hiddenRoot(a)) { const p = a.previousElementSibling; if (p && p.matches('button,[aria-expanded],[role=button]') && closedToggle(p, tried, el)) return p; }
    }
    return null;
  }
  function genericToggle(d, tried) {
    const all = [...document.querySelectorAll(ACTIONABLE)];
    const pick = k => all.find(el => closedToggle(el, tried, null) && kindOf(el, nameOf(el)) === k);
    return (d.kind === 'search-field' && pick('search-toggle')) || pick('menu-toggle') || null;
  }
  const isToggleKind = k => /^(menu-toggle|search-toggle|close)$/.test(k);

  async function findTarget(d, noReveal) {
    const steps = [], tried = new Set(); let hidden = false, any = false;
    for (let depth = 0; depth < 4; depth++) {
      let good = rank(d); any = any || good.length > 0;
      let v = good.find(r => visible(r.el));
      if (!v && depth > 0) { // off-screen frames are render-throttled, so drawer transitions never tick: jump them to their end state
        try { document.getAnimations().forEach(an => { const t = an.effect && an.effect.getComputedTiming(); if (t && isFinite(t.endTime)) an.finish(); }); } catch (e) {}
        good = rank(d); v = good.find(r => visible(r.el));
      }
      if (v) return { el: v.el, steps, how: steps.length ? 'revealed' : v.same ? 'direct' : 'semantic' };
      hidden = good.length > 0;
      if (noReveal || depth === 3) break;
      let tg = null;
      for (const r of good.slice(0, 5)) { tg = controllerFor(r.el, tried); if (tg) break; }
      if (!tg && good.length && !isToggleKind(d.kind)) tg = genericToggle(d, tried);
      if (!tg) break;
      tried.add(tg); steps.push(nameOf(tg) || 'menu'); flash(tg); press(tg); await sleep(420);
    }
    if (!any && isToggleKind(d.kind)) { // different design, same job: match by role
      const eq = [...document.querySelectorAll(ACTIONABLE)].find(el => kindOf(el, nameOf(el)) === d.kind && visible(el));
      if (eq) return { el: eq, steps, how: 'role' };
    }
    return { el: null, hidden, steps };
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
  function setValue(el, v) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
    if (el.value === v) return; set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change', { bubbles: true }));
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
  const act = (kind, data) => send('act', Object.assign({ kind }, data));
  function mark() { lastInput = now(); if (lastInput - lastActive > 400) { lastActive = lastInput; send('active'); } }
  const leading = () => now() > suppressUntil && (hovering || now() - lastInput < 1500);
  for (const ev of ['pointerdown', 'wheel', 'keydown', 'touchstart']) addEventListener(ev, e => e.isTrusted && mark(), { capture: true, passive: true });
  document.addEventListener('mouseenter', () => { hovering = true; mark(); });
  document.addEventListener('mouseleave', () => { hovering = false; if (lastHover) { lastHover = null; act('unhover', {}); } });

  addEventListener('click', e => {
    if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); return; }
    if (!e.isTrusted || replaying) return;
    const el = actionable(e.target);
    if (!el) { act('click', { passive: true, d: { id: e.target.id || '', path: cssPath(e.target), generic: true } }); return; }
    const tag = el.tagName;
    if (tag === 'LABEL' || tag === 'SELECT' || tag === 'OPTION' || (tag === 'INPUT' && /^(checkbox|radio)$/.test(el.type))) return; // synced through change events
    const d = desc(el);
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && TEXTY.test(el.type))) { act('focus', { d }); return; }
    const raw = tag === 'A' ? el.getAttribute('href') || '' : '';
    const inpage = !raw || raw[0] === '#';
    if (d.kind === 'link' && !inpage) return act('click', { d });           // page is about to unload: send now
    setTimeout(() => act('click', { d, inpage, expanded: el.isConnected ? el.getAttribute('aria-expanded') : null, open: tag === 'SUMMARY' && el.parentElement ? el.parentElement.open : null }), 90);
  }, true);

  const onField = e => {
    if (!e.isTrusted || replaying) return; const el = e.target;
    if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    const check = el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type);
    if (e.type === 'input' && (check || el.tagName === 'SELECT')) return;
    if (e.type === 'change' && !check && el.tagName !== 'SELECT') return act('input', { d: desc(el), value: el.value, commit: true });
    act('input', { d: desc(el), value: el.value, checked: check ? el.checked : null });
  };
  addEventListener('input', onField, true); addEventListener('change', onField, true);

  addEventListener('keydown', e => {
    if (!e.isTrusted) return;
    if (e.key === 'Escape') act('key', { key: 'Escape' });
    else if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && TEXTY.test(e.target.type)) act('key', { key: 'Enter', d: desc(e.target) });
  }, true);

  let lastHover = null, hoverT = 0;
  addEventListener('mouseover', e => {
    if (!e.isTrusted || cfg.touch) return;
    const el = actionable(e.target);
    if (el === lastHover) return; lastHover = el;
    clearTimeout(hoverT); hoverT = setTimeout(() => el && el.isConnected ? act('hover', { d: desc(el) }) : act('unhover', {}), 50);
  }, true);

  /* -------------------------------- scrolling -------------------------------- */
  let anchorCache = null, anchorAt = 0;
  function anchors() {
    if (anchorCache && now() - anchorAt < 800) return anchorCache;
    const out = [], seen = {};
    for (const el of document.querySelectorAll('h1,h2,h3,h4,section,article,footer')) {
      let key;
      if (/^H\d$/.test(el.tagName)) key = 'h:' + norm(el.textContent).slice(0, 60);
      else if (el.id) key = '#' + el.id;
      else { const h = el.querySelector('h1,h2,h3,h4'); key = el.tagName === 'FOOTER' ? 'footer' : h ? 's:' + norm(h.textContent).slice(0, 60) : ''; }
      if (!key || key.length < 3) continue;
      const r = el.getBoundingClientRect(); if (r.height < 1 || r.width < 1 || !visible(el)) continue;
      seen[key] = (seen[key] || 0) + 1; if (seen[key] > 1) key += '~' + seen[key];
      out.push({ key, top: r.top + scrollY });
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
    } else if (t.nodeType === 1 && !elRaf.has(t)) {
      elRaf.set(t, requestAnimationFrame(() => {
        elRaf.delete(t); if (!leading()) return;
        act('escroll', { d: { id: t.id || '', path: cssPath(t) }, px: t.scrollLeft / Math.max(1, t.scrollWidth - t.clientWidth), py: t.scrollTop / Math.max(1, t.scrollHeight - t.clientHeight) });
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
    if (!cfg.touch || !e.isTrusted || e.pointerType !== 'mouse' || e.button !== 0) return;
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
      if (!g.sc && g.axis === 'x' && Math.abs(dx) > 40) act('swipe', { d: { id: g.target.id || '', path: cssPath(g.target) }, dx, dy });
    }
  };
  addEventListener('pointerup', endDrag, true); addEventListener('pointercancel', endDrag, true);
  addEventListener('dragstart', e => { if (cfg.touch) e.preventDefault(); }, true);
  function applyTouchMode() {
    let st = document.getElementById('__samestate_touch');
    if (cfg.touch && !st) {
      st = document.createElement('style'); st.id = '__samestate_touch';
      st.textContent = 'html{-webkit-user-select:none;user-select:none}input,textarea{-webkit-user-select:text;user-select:text}';
      document.documentElement.appendChild(st);
    } else if (!cfg.touch && st) st.remove();
  }

  /* --------------------------- replaying remote acts --------------------------- */
  const go = href => { try { const u = new URL(href, location.origin); if (u.href !== location.href) location.assign(u.href); } catch (e) {} };
  const chain = f => (f.steps.length ? 'opened “' + f.steps.join('” → “') + '” → ' : '');
  let hoverEl = null;
  const handlers = {
    async click(m) {
      if (m.passive) { const el = locate(m.d); if (el && visible(el)) press(el); return null; }
      const f = await findTarget(m.d);
      if (!f.el) {
        if (m.d.kind === 'link' && m.d.href && !m.inpage) { go(m.d.href); return { status: 'nav', note: 'no visible link here — navigated straight to ' + m.d.href }; }
        if (isToggleKind(m.d.kind)) return { status: 'skip', note: 'not needed in this layout' };
        return { status: f.hidden ? 'hidden' : 'none', note: f.hidden ? 'exists but is not reachable in this layout' : 'no equivalent element' };
      }
      const el = f.el;
      if (m.expanded != null && el.getAttribute('aria-expanded') === m.expanded) return { status: 'skip', note: 'already ' + (m.expanded === 'true' ? 'open' : 'closed') };
      if (m.open != null && el.tagName === 'SUMMARY' && el.parentElement.open === m.open) return { status: 'skip', note: 'already in that state' };
      flash(el); press(el);
      return { status: f.how, note: chain(f) + ({ direct: 'same element', semantic: 'matched by meaning', revealed: 'clicked “' + nameOf(el) + '”', role: 'equivalent control “' + nameOf(el) + '”' })[f.how] };
    },
    async focus(m) {
      const f = await findTarget(m.d); if (!f.el) return { status: f.hidden ? 'hidden' : 'none', note: 'field not available' };
      try { f.el.focus({ preventScroll: true }); } catch (e) {} flash(f.el);
      return { status: f.how, note: chain(f) + 'focused field' };
    },
    async input(m) {
      const f = await findTarget(m.d); if (!f.el) return m.commit ? null : { status: f.hidden ? 'hidden' : 'none', note: 'field not available' };
      const el = f.el;
      if (m.checked != null) { if (el.checked !== m.checked) { replaying++; setTimeout(() => replaying--, 0); el.click(); } }
      else { setValue(el, m.value); if (m.commit) el.dispatchEvent(new Event('change', { bubbles: true })); }
      return m.commit ? null : { status: f.how, note: chain(f) + 'value set', quiet: !f.steps.length };
    },
    async key(m) {
      if (m.key === 'Escape') {
        const t = document.activeElement || document.body, o = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
        t.dispatchEvent(new KeyboardEvent('keydown', o)); t.dispatchEvent(new KeyboardEvent('keyup', o));
        for (const dlg of document.querySelectorAll('dialog[open]')) if (dlg.dispatchEvent(new Event('cancel', { cancelable: true }))) dlg.close();
        return { status: 'direct', note: 'Escape', quiet: true };
      }
      const f = await findTarget(m.d, true); if (!f.el) return { status: 'none', note: 'field not available' };
      const el = f.el, o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      const go2 = el.dispatchEvent(new KeyboardEvent('keydown', o)); el.dispatchEvent(new KeyboardEvent('keyup', o));
      if (go2 && el.form) { if (el.form.requestSubmit) el.form.requestSubmit(); else el.form.submit(); }
      return { status: f.how, note: 'submitted' };
    },
    scroll(m) { applyScroll(m); return null; },
    escroll(m) {
      const el = locate(m.d); if (!el) return null; suppressUntil = now() + 350;
      el.scrollLeft = m.px * (el.scrollWidth - el.clientWidth); el.scrollTop = m.py * (el.scrollHeight - el.clientHeight); return null;
    },
    swipe(m) {
      if (!cfg.touch) return { status: 'skip', note: 'swipe has no mouse equivalent here' };
      const el = locate(m.d); if (!el || !visible(el)) return { status: 'none', note: 'swipe target not found' };
      const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      fireTouch('touchstart', el, x, y); for (let i = 1; i <= 4; i++) fireTouch('touchmove', el, x + m.dx * i / 4, y + m.dy * i / 4); fireTouch('touchend', el, x + m.dx, y + m.dy);
      return { status: 'direct', note: 'swiped ' + (m.dx < 0 ? 'left' : 'right') };
    },
    hover(m) {
      handlers.unhover();
      const v = rank(m.d).find(r => visible(r.el)); if (!v) return null;
      hoverEl = v.el; hoverRing = ring(hoverEl, '#4da3ff', 0);
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
  function snapshot() {
    snapMap = new Map();
    const de = document.documentElement, vw = de.clientWidth, items = [];
    const reg = (key, el) => { if (!snapMap.has(key)) snapMap.set(key, []); snapMap.get(key).push(el); };
    const push = (cat, key, el, extra) => {
      if (items.length > 1800) return;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el), vis = visible(el);
      reg(key, el);
      items.push(Object.assign({
        cat, key, name: (extra && extra.name) || nameOf(el), visible: vis,
        x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height),
        font: (cs.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim(), size: Math.round(parseFloat(cs.fontSize) * 10) / 10, weight: cs.fontWeight,
        truncated: vis && ((cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1)),
        inNav: !!el.closest('nav,[role=navigation],header')
      }, extra));
    };
    const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => { const t = norm(el.textContent); if (t) push('heading', 'h|' + t, el, { level: +el.tagName[1] }); });
    document.querySelectorAll('p,li,blockquote,figcaption,dd,dt').forEach(el => { if (!ownText(el)) return; const t = norm(el.textContent); if (t.length > 3) push('text', 't|' + t.slice(0, 50), el); });
    document.querySelectorAll('a[href],button,[role=button],input:not([type=hidden]),select,textarea,summary,[role=tab]').forEach(el => {
      const d = desc(el), field = /field|select|check/.test(d.kind);
      const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement && ownText(el.parentElement);
      push(field ? 'input' : d.kind === 'link' ? 'link' : 'button', (field ? 'f|' : 'a|') + d.kind + '|' + (d.name || d.path) + '|' + d.href, el, { kind: d.kind, name: d.name, inline, iconOnly: !field && !norm(el.textContent) && !!el.querySelector('svg,img,i'), unlabeled: !d.name });
    });
    document.querySelectorAll('img').forEach(el => {
      const src = (el.currentSrc || el.src || '').split('/').pop().split('?')[0];
      push('image', 'i|' + (norm(el.alt) || src.replace(/[-_@]?(\d+x\d*|\d+w|small|medium|large|mobile|desktop|tablet|sm|md|lg|xl)(?=\.|$)/gi, '')), el, { name: norm(el.alt) || src, src, natW: el.naturalWidth, natH: el.naturalHeight, broken: el.complete && el.naturalWidth === 0 && !!el.getAttribute('src') });
    });
    let ti = 0;
    document.querySelectorAll('table').forEach(el => {
      const cs = getComputedStyle(el); let sc = null;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { if (/auto|scroll/.test(getComputedStyle(a).overflowX)) { sc = a; break; } }
      const box = sc || el.parentElement, cells = el.rows[0] ? [...el.rows[0].cells] : [];
      push('table', 'tb|' + (norm(el.caption && el.caption.textContent) || el.getAttribute('aria-label') || ti++), el, { name: norm(el.caption && el.caption.textContent) || 'table', display: cs.display, cols: cells.filter(visible).length, rows: el.rows.length, wide: el.scrollWidth > box.clientWidth + 2 || el.getBoundingClientRect().width > box.clientWidth + 2, scrollable: !!sc });
    });
    let ni = 0;
    document.querySelectorAll('nav,[role=navigation]').forEach(el => push('nav', 'n|' + (norm(el.getAttribute('aria-label')) || ni++), el, { name: norm(el.getAttribute('aria-label')) || 'navigation' }));

    // page-level facts
    const overflow = [], scrollers = [], fixed = []; let n = 0;
    const vh = innerHeight;
    for (const el of document.body.querySelectorAll('*')) {
      if (++n > 5000) break; if (el.tagName === 'SAMESTATE-LAYER' || el.closest('samestate-layer')) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none') continue;
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      if (/auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 4) { const key = 'sc|' + scrollers.length; reg(key, el); scrollers.push({ key, name: nameOf(el).slice(0, 40), snap: cs.scrollSnapType && cs.scrollSnapType !== 'none', table: !!el.querySelector('table') }); }
      if ((cs.position === 'fixed' || cs.position === 'sticky') && visible(el) && r.width * Math.min(r.height, vh) / (vw * vh) > 0.25 && r.top < vh && r.bottom > 0) { const key = 'fx|' + fixed.length; reg(key, el); fixed.push({ key, name: nameOf(el).slice(0, 40), cover: Math.round(r.width * Math.min(r.height, vh) / (vw * vh) * 100) }); }
      if (r.right + scrollX > vw + 2 && overflow.length < 6 && visible(el)) {
        let clipped = false, parentOver = false;
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') { clipped = true; break; } }
        if (el.parentElement && el.parentElement !== document.body) parentOver = el.parentElement.getBoundingClientRect().right + scrollX > vw + 2;
        if (!clipped && !parentOver) { const key = 'ov|' + overflow.length; reg(key, el); overflow.push({ key, name: (nameOf(el) || el.tagName.toLowerCase()).slice(0, 40), by: Math.round(r.right + scrollX - vw) }); }
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
      const label = fx.querySelector('h1,h2,h3,h4,[role=heading]');
      fixed.push({ key, name: norm(fx.getAttribute('aria-label') || (label && label.textContent) || fx.textContent).slice(0, 40), cover: Math.round(r.width * Math.min(r.height, vh) / (vw * vh) * 100), hides: els.map(e => nameOf(e)).filter(Boolean).slice(0, 6) });
    }
    const hoverOnly = [];
    try {
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
        const walk = list => { for (const rule of list) {
          if (rule.cssRules && !rule.selectorText) { if (!/hover:\s*none/.test(rule.conditionText || '')) walk(rule.cssRules); continue; }
          const sel = rule.selectorText; if (!sel || sel.indexOf(':hover') < 0 || hoverOnly.length > 12) continue;
          const st = rule.style; if (!(st.display || st.visibility === 'visible' || st.opacity === '1' || (st.maxHeight && st.maxHeight !== '0px'))) continue;
          for (const part of sel.split(',')) {
            const i = part.indexOf(':hover'); if (i < 0) continue;
            const base = part.slice(0, i).trim(), rest = part.slice(i + 6).trim(); if (!base || !rest) continue; // only "x:hover y" reveals
            try { const host = [...document.querySelectorAll(base)].find(visible); if (host && host.querySelector(rest.replace(/^[>+~]\s*/, ''))) { const key = 'hv|' + hoverOnly.length; reg(key, host); hoverOnly.push({ key, name: nameOf(host).slice(0, 40) || base }); } } catch (e) {}
          }
        } };
        walk(rules);
      }
    } catch (e) {}
    const mv = document.querySelector('meta[name=viewport]');
    return { url: location.href, vw, vh, dpr: devicePixelRatio, docW: de.scrollWidth, docH: de.scrollHeight, metaViewport: mv ? mv.content : null, items, overflow, scrollers, fixed, hoverOnly,
      menuToggle: [...document.querySelectorAll(ACTIONABLE)].some(el => kindOf(el, nameOf(el)) === 'menu-toggle' && visible(el)) };
  }

  async function runDemo(m) {
    const el = m.sel && document.querySelector(m.sel); if (!el) return; send('active');
    if (m.do === 'click') { const d = desc(el); flash(el); press(el); await sleep(90); act('click', { d, inpage: true, expanded: el.isConnected ? el.getAttribute('aria-expanded') : null, open: null }); }
    else if (m.do === 'type') { try { el.focus({ preventScroll: true }); } catch (e) {} for (let i = 1; i <= m.text.length; i++) { setValue(el, m.text.slice(0, i)); act('input', { d: desc(el), value: el.value, checked: null }); await sleep(70); } }
    else if (m.do === 'scroll') { const y0 = scrollY, y = el.getBoundingClientRect().top + scrollY - 90; for (let i = 1; i <= 28; i++) { window.scrollTo({ top: y0 + (y - y0) * i / 28, behavior: 'instant' }); act('scroll', scrollState()); await sleep(28); } }
  }

  /* ------------------------------ shell messages ------------------------------ */
  let queue = Promise.resolve();
  addEventListener('message', e => {
    const m = e.data; if (!m || !m.__samestateShell || e.origin !== EXT) return;
    if (m.type === 'config') { Object.assign(cfg, m.cfg); applyTouchMode(); }
    else if (m.type === 'goto') go(m.url);
    else if (m.type === 'history') history.go(m.delta);
    else if (m.type === 'reload') location.reload();
    else if (m.type === 'demo') runDemo(m);
    else if (m.type === 'clear') { try { localStorage.clear(); sessionStorage.clear(); document.cookie.split(';').forEach(c => { document.cookie = c.split('=')[0].trim() + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'; }); } catch (err) {} location.reload(); }
    else if (m.type === 'snapshot') { let data = null; try { data = snapshot(); } catch (err) { data = { error: String(err) }; } send('snapshot', { rid: m.rid, data }); }
    else if (m.type === 'highlight') {
      const els = []; for (const k of m.keys || []) for (const el of snapMap.get(k) || []) if (el.isConnected) els.push(el);
      const first = els.find(visible) || els[0];
      if (first) { suppressUntil = now() + 800; first.scrollIntoView({ block: 'center', behavior: 'instant' }); }
      setTimeout(() => els.filter(visible).slice(0, 40).forEach(el => ring(el, '#ffb020', 2600)), 60);
    } else if (m.type === 'act' && handlers[m.kind]) {
      const runIt = async () => { let r = null; try { r = await handlers[m.kind](m); } catch (err) { r = { status: 'none', note: 'error: ' + err.message }; } if (r && m.aid) send('result', Object.assign({ aid: m.aid }, r)); };
      if (/hover|scroll/.test(m.kind)) runIt(); else queue = queue.then(runIt);
    }
  });

  /* -------------------------------- navigation -------------------------------- */
  const here = () => location.href;
  let lastUrl = here();
  const navCheck = () => { const u = here(); if (u !== lastUrl) { lastUrl = u; send('nav', { url: u, title: document.title }); } };
  setInterval(navCheck, 400); // content scripts cannot see the page's own pushState calls, so poll
  addEventListener('popstate', navCheck); addEventListener('hashchange', navCheck);
  const hello = () => send('hello', { url: here(), title: document.title });
  hello(); addEventListener('DOMContentLoaded', hello); addEventListener('load', hello);
})();
