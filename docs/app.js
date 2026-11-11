'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const ANDROID_TAB = 'Mozilla/5.0 (Linux; Android 13; Nexus 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
// kind: desktop | tablet | phone · os picks the chrome drawn around the page
const DEVICES = [
  { id: 'iphone', name: 'iPhone 11 Pro', w: 375, h: 812, scale: .62, kind: 'phone', os: 'ios', notch: true, ua: IPHONE },
  { id: 'nexus7', name: 'Nexus 7', w: 600, h: 960, scale: .5, kind: 'tablet', os: 'android', ua: ANDROID_TAB },
  { id: 'desktop', name: 'Desktop', w: 1920, h: 1080, scale: .3, kind: 'desktop', ua: '' },
  { id: 'macbook', name: 'MacBook Air', w: 1440, h: 900, scale: .3, kind: 'desktop', ua: '' },
  { id: 'android', name: 'Android', w: 420, h: 680, scale: .62, kind: 'phone', os: 'android', ua: ANDROID },
  { id: 'pixel', name: 'Pixel 3XL', w: 412, h: 847, scale: .62, kind: 'phone', os: 'android', ua: ANDROID },
  { id: 'ipad', name: 'iPad Pro 11"', w: 834, h: 1194, scale: .42, kind: 'tablet', os: 'ios', ua: IPAD },
  { id: 'small', name: 'Small mobile', w: 320, h: 568, scale: .62, kind: 'phone', os: 'ios', ua: IPHONE, on: false },
  { id: 'large', name: 'Large display', w: 2560, h: 1440, scale: .22, kind: 'desktop', ua: '', on: false }
].map((d, i) => Object.assign({ on: true }, d, { slot: i, touch: d.kind !== 'desktop', ready: false, url: null, rot: false }));
const SYNC = { click: ['Clicks & menus', true], input: ['Typing & forms', true], scroll: ['Scrolling', true], hover: ['Hover', true], nav: ['Navigation', true] };
const KIND_SYNC = { click: 'click', focus: 'input', input: 'input', key: 'input', scroll: 'scroll', escroll: 'scroll', swipe: 'scroll', hover: 'hover', unhover: 'hover' };

let base = 4700, target = null, leader = null, zoom = 1, mode = 'grid', focusDev = null, aid = 0, findings = [], catFilter = null;
const bySlot = s => DEVICES[+s];
const active = () => DEVICES.filter(d => d.on && d.el);
const post = (d, type, data) => d.iframe && d.iframe.contentWindow && d.iframe.contentWindow.postMessage(Object.assign({ __samestateShell: 1, type }, data), '*');

/* ------------------------------- left panel ------------------------------- */
function renderLeft() {
  $('#devlist').innerHTML = DEVICES.map(d => `<label class="row"><input type="checkbox" data-dev="${d.id}" ${d.on ? 'checked' : ''}>${d.name}<small>${d.w}×${d.h}</small></label>`).join('');
  $('#synclist').innerHTML = Object.keys(SYNC).map(k => `<label class="row"><input type="checkbox" data-sync="${k}" ${SYNC[k][1] ? 'checked' : ''}>${SYNC[k][0]}</label>`).join('');
  $('#ref').innerHTML = DEVICES.map(d => `<option value="${d.id}">${d.name}</option>`).join(''); $('#ref').value = 'desktop';
}
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.dev) { DEVICES.find(d => d.id === t.dataset.dev).on = t.checked; buildFrames(); }
  if (t.dataset.sync) SYNC[t.dataset.sync][1] = t.checked;
});

/* --------------------------------- frames --------------------------------- */
const IC = { rot: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="14" rx="2"/><path d="M4 17a8 8 0 0 0 8 4M20 7a8 8 0 0 0-5-4"/></svg>', rel: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg>', foc: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>' };
const NAVIC = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg><svg viewBox="0 0 24 24"><path d="M12 15V4m-4 4 4-4 4 4M6 12v8h12v-8"/></svg><svg viewBox="0 0 24 24"><rect x="5" y="5" width="11" height="11" rx="2"/><path d="M9 19h8a2 2 0 0 0 2-2V9"/></svg>';
const ANDIC = '<svg viewBox="0 0 24 24"><path d="M15 6l-7 6 7 6z"/></svg><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg><svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>';
function deviceChrome(d) { // { top, bottom, extra px }
  if (d.kind === 'desktop') return { top: '<div class="c-win"><s></s><s></s><s></s><span class="addr"></span></div>', bottom: '', extra: 38 };
  const status = '<div class="c-status"><span>9:41</span><span><u></u><i></i></span></div>', url = '<div class="c-url"><span class="addr"></span><em></em></div>';
  if (d.kind === 'tablet' || d.rot) return { top: status + url, bottom: '', extra: 74 };
  return d.os === 'ios' ? { top: status + url, bottom: `<div class="c-bottom">${NAVIC}</div>`, extra: 120 } : { top: status + url, bottom: `<div class="c-bottom">${ANDIC}</div>`, extra: 114 };
}
function size(d) { return d.rot ? { w: d.h, h: d.w } : { w: d.w, h: d.h }; }
function layout(d) {
  const { w, h } = size(d), c = deviceChrome(d), H = h + c.extra;
  let s = d.scale * zoom;
  if (mode === 'focus') { const cv = $('#canvas'); s = Math.min((cv.clientWidth - 80) / w, (cv.clientHeight - 90) / H, 1.2); }
  d.body.style.width = w * s + 'px'; d.body.style.height = H * s + 'px'; d.body.style.boxSizing = 'content-box';
  d.scaled.style.width = w + 'px'; d.scaled.style.transform = `scale(${s})`;
  d.iframe.style.width = w + 'px'; d.iframe.style.height = h + 'px';
  d.el.querySelector('.dims').textContent = `(${w} × ${h}) ${Math.round(s * 100)}%`;
}
function relayout() {
  if (typeof cvAllow !== 'undefined') cvAllow = Date.now() + 300;
  const f = $('#frames'); f.className = 'frames ' + mode;
  if (mode === 'focus' && (!focusDev || !focusDev.el)) focusDev = leader || active()[0];
  for (const d of active()) { d.el.classList.toggle('focused', d === focusDev); layout(d); }
}
function buildFrames(path) {
  const wrap = $('#frames');
  const keep = path ? target + path : (leader && leader.url) || target + '/';
  wrap.innerHTML = ''; leader = null;
  $('#empty').style.display = target ? 'none' : '';
  for (const d of DEVICES) {
    d.el = d.iframe = null; d.ready = false; d.url = null;
    if (!d.on || !target) continue;
    const el = document.createElement('div'), c = deviceChrome(d);
    el.className = `dev ${d.kind} ${d.os || ''} ${d.notch ? 'notch' : ''}`;
    el.innerHTML = `<div class="dev-head"><i class="dot"></i><b>${d.name}</b><span class="dims"></span><span class="sp"></span>${d.touch ? `<button data-a="rot" title="Rotate">${IC.rot}</button>` : ''}<button data-a="rel" title="Reload">${IC.rel}</button><button data-a="foc" title="Focus this device">${IC.foc}</button></div><div class="dev-body"><div class="scaled">${c.top}<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads" allow="clipboard-write"></iframe>${c.bottom}</div></div>`;
    d.el = el; d.body = el.querySelector('.dev-body'); d.scaled = el.querySelector('.scaled'); d.iframe = el.querySelector('iframe');
    el.querySelector('.dev-head').addEventListener('click', e => {
      const b = e.target.closest('button'), a = b && b.dataset.a;
      if (a === 'rot') { d.rot = !d.rot; layout(d); }
      if (a === 'rel') post(d, 'reload');
      if (a === 'foc') { focusDev = d; setMode(mode === 'focus' ? 'grid' : 'focus'); }
    });
    wrap.appendChild(el);
    d.iframe.src = keep;
  }
  relayout();
}
function setMode(m) { mode = m; document.querySelectorAll('#mode button').forEach(b => b.classList.toggle('on', b.dataset.v === m)); relayout(); }
function setZoom(v) { zoom = v / 100; $('#zoom').value = v; $('#zoomv').textContent = v + '%'; active().forEach(layout); }
$('#zoom').addEventListener('input', e => setZoom(+e.target.value));
$('#mode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.v); });
$('#align').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#align button').forEach(x => x.classList.toggle('on', x === b)); $('#frames').style.alignItems = b.dataset.v; });
$('#filters').onclick = () => $('#devlist').classList.toggle('closed');
$('#land').onclick = () => { active().forEach(d => { if (d.touch) d.rot = true; }); relayout(); };
$('#port').onclick = () => { active().forEach(d => { d.rot = false; }); relayout(); };
$('#rz').onclick = () => setZoom(100);
$('#clear').onclick = () => active().forEach(d => post(d, 'clear'));
window.addEventListener('resize', () => mode === 'focus' && relayout());
// Keep the canvas where the user left it: a device frame taking focus (dialogs, synced typing) must not scroll the wall.
const cv = $('#canvas'); let cvPos = [0, 0], cvUser = 0, cvDrag = false, cvAllow = 0;
for (const ev of ['wheel', 'keydown', 'touchstart']) cv.addEventListener(ev, () => { cvUser = Date.now(); }, { passive: true, capture: true });
cv.addEventListener('pointerdown', () => { cvDrag = true; }, true); window.addEventListener('pointerup', () => { cvDrag = false; cvUser = Date.now(); }, true);
cv.addEventListener('scroll', () => { if (cvDrag || Date.now() - cvUser < 700 || Date.now() < cvAllow) cvPos = [cv.scrollLeft, cv.scrollTop]; else { cv.scrollLeft = cvPos[0]; cv.scrollTop = cvPos[1]; } });


/* ------------------------------ opening a page ------------------------------ */
// The same files run as the Chrome extension and as the web demo (GitHub Pages), where only the bundled sample site is available.
const IS_EXT = typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id);
const EXT = location.origin, HERE = location.pathname.replace(/\/[^/]*$/, '');
const REPO = 'https://github.com/shouvik12/samestate';
let registered = null;
const register = () => registered || (registered = IS_EXT ? chrome.runtime.sendMessage({ type: 'register' }) : Promise.resolve()); // enables framing + agent injection for this tab
function say(msg) { target = null; buildFrames(); $('#joblog').textContent = msg; }
async function open(source) {
  source = String(source || '').trim(); let start = '/';
  if (source === 'demo') { target = EXT; start = HERE + '/demo/index.html'; }
  else {
    if (!IS_EXT) { $('#src').value = ''; $('#src').placeholder = 'Install the Chrome extension to open your own pages: github.com/shouvik12/samestate'; return; }
    if (/^(git@|~|\/|\.\/)/.test(source)) return say('The extension previews URLs. Start your project (for example npm run dev) and open its localhost address here.');
    let u = source; if (!/^https?:\/\//i.test(u)) u = (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u) ? 'http://' : 'https://') + u;
    let url; try { url = new URL(u); } catch (e) { return say('That does not look like a URL.'); }
    target = url.origin; start = url.pathname + url.search + url.hash; $('#src').value = url.href;
  }
  await register(); buildFrames(start); setTimeout(() => detect(true), 3500);
}
$('#open').addEventListener('submit', e => {
  e.preventDefault(); const v = $('#src').value.trim(); if (!v) return;
  endTour(false);
  if (target && target !== EXT && v.startsWith(target) && active().some(d => d.ready)) { active().forEach(d => post(d, 'goto', { url: v })); return; }
  open(v);
});
/* -------------------------------- guided demo -------------------------------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dev = id => DEVICES.find(d => d.id === id);
const play = (id, m) => post(dev(id), 'demo', m);
const STEPS = [
  { t: 'Clicking <b>Products</b> on the Desktop. Phones and tablets have no nav bar, so each opens its own menu and then Products.', run: () => play('desktop', { do: 'click', sel: '.dd-btn' }), wait: 5200 },
  { t: 'Clicking <b>Sign in</b> on the Desktop. On phones that button lives inside the drawer, and the same dialog opens everywhere.', run: () => play('desktop', { do: 'click', sel: '.signin.desk-only' }), wait: 4600 },
  { t: 'Typing once. The email field fills in on every device.', run: () => play('desktop', { do: 'type', sel: '#signin [name=email]', text: 'you@company.com' }), wait: 3400 },
  { t: 'Closing the dialog on a phone this time. Any device can lead.', run: () => play('iphone', { do: 'click', sel: '#signin .close' }), wait: 3200 },
  { t: 'Scrolling to <b>Compare plans</b>. Devices line up on the same section even though their pages are different lengths.', run: () => play('desktop', { do: 'scroll', sel: '#plans' }), wait: 4200 },
  { t: 'Measuring every device against the Desktop. The report lists what changed, such as the table that is too wide for phones.', run: () => detect(), wait: 6000 },
  { t: IS_EXT ? 'That is the tour. Keep exploring the demo, or type your own URL in the address bar.' : 'That is the tour. Click around the devices yourself, or install the Chrome extension to open any page.', run: () => { $('#skip').textContent = IS_EXT ? 'Use my own site' : 'Close'; }, wait: 0 }
];
let tour = 0;
async function startTour() {
  const id = ++tour; $('#tour').hidden = false; $('#skip').textContent = 'Skip demo';
  $('#tourdots').innerHTML = STEPS.map(() => '<i></i>').join(''); $('#tourtext').textContent = 'Loading the demo site on every device…';
  DEVICES.forEach(d => { d.on = !/small|large/.test(d.id); d.rot = false; }); renderLeft(); setMode('grid'); $('#panel').hidden = true;
  $('#src').value = ''; await open('demo');
  for (let i = 0; i < 60 && id === tour && !(target && active().length && active().every(d => d.ready)); i++) await sleep(250);
  await sleep(1400);
  for (let i = 0; i < STEPS.length; i++) {
    if (id !== tour) return;
    $('#tourtext').innerHTML = STEPS[i].t; document.querySelectorAll('#tourdots i').forEach((x, k) => x.classList.toggle('on', k <= i));
    await sleep(900); if (id !== tour) return;
    STEPS[i].run(); await sleep(STEPS[i].wait);
  }
}
function endTour(clear) {
  tour++; $('#tour').hidden = true; try { localStorage.setItem('samestate.seenDemo', '1'); } catch (e) {}
  if (clear) { target = null; buildFrames(); $('#panel').hidden = true; $('#joblog').textContent = ''; $('#src').value = ''; $('#src').focus(); findings = []; renderFindings(); $('#findings').innerHTML = '<p class="muted">Open a site, then press <b>Detect differences</b>.</p>'; }
}
$('#skip').onclick = () => endTour(IS_EXT); // on the web demo the sample site stays open to play with
$('#demo').onclick = $('#watch').onclick = startTour;
$('#own').onclick = () => { if (IS_EXT) $('#src').focus(); else window.open(REPO + '#install', '_blank', 'noopener'); };
$('#back').onclick = () => active().forEach(d => post(d, 'history', { delta: -1 }));
$('#fwd').onclick = () => active().forEach(d => post(d, 'history', { delta: 1 }));
$('#reload').onclick = () => active().forEach(d => post(d, 'reload'));

/* ------------------------------ message routing ------------------------------ */
const pendingSnap = {}, entries = {};
let reconcileT = 0;
function setLeader(d) { if (leader === d) return; leader = d; DEVICES.forEach(x => x.el && x.el.classList.toggle('leader', x === d)); }
function showPaths() {
  for (const d of active()) {
    d.el.querySelectorAll('.addr').forEach(a => { let t = ''; try { const u = new URL(d.url || target); t = u.pathname.includes('/demo/') && u.origin === EXT ? 'tidepool.demo' + u.pathname.slice(u.pathname.indexOf('/demo/') + 5).replace('/index.html', '') : u.host + (u.pathname === '/' ? '' : u.pathname); } catch (e) {} a.textContent = t; });
    d.el.classList.toggle('ready', d.ready);
    d.el.classList.toggle('diverged', !!(leader && leader.url && d.url && d.url !== leader.url));
  }
}
function reconcile() {
  clearTimeout(reconcileT);
  reconcileT = setTimeout(() => {
    if (!leader || !leader.url || !SYNC.nav[1]) return;
    for (const d of active()) if (d !== leader && d.ready && d.url !== leader.url) post(d, 'goto', { url: leader.url });
  }, 1300);
}
window.addEventListener('message', e => {
  const m = e.data; if (!m || !m.__samestate) return;
  const d = DEVICES.find(x => x.iframe && x.iframe.contentWindow === e.source); if (!d) return;
  switch (m.type) {
    case 'hello': case 'nav':
      d.ready = true; d.url = m.url; post(d, 'config', { cfg: { touch: d.touch } });
      if (!leader) setLeader(d);
      if (d === leader) reconcile();
      showPaths(); break;
    case 'active': setLeader(d); showPaths(); break;
    case 'external': logLine(`<div class="entry"><div class="h">${d.name} <span>· external link kept out of the preview</span></div><div class="r"><a href="${esc(m.href)}" target="_blank" rel="noopener" style="color:var(--acc2)">${esc(m.href)}</a></div></div>`); break;
    case 'snapshot': if (pendingSnap[m.rid]) pendingSnap[m.rid](d, m.data); break;
    case 'result': addResult(m, d); break;
    case 'act': {
      setLeader(d);
      if (!SYNC[KIND_SYNC[m.kind] || 'click'][1]) return;
      const id = ++aid, loud = /^(click|focus|input|key|swipe)$/.test(m.kind) && !m.passive && !m.commit;
      if (loud) startEntry(id, d, m);
      for (const o of active()) if (o !== d && o.ready) post(o, 'act', Object.assign({}, m, { aid: loud ? id : 0, __samestate: undefined, slot: undefined, type: 'act' }));
    }
  }
});

/* --------------------------------- sync log --------------------------------- */
let lastInputKey = null;
function logLine(html) { const box = $('#log'); if (box.querySelector('.muted')) box.innerHTML = ''; box.insertAdjacentHTML('afterbegin', html); while (box.children.length > 80) box.lastChild.remove(); }
function startEntry(id, d, m) {
  const name = m.d && (m.d.name || m.d.kind) || '';
  const verb = { click: 'click', focus: 'focus', input: m.checked != null ? (m.checked ? 'check' : 'uncheck') : 'type in', key: m.key === 'Escape' ? 'press Escape' : 'press Enter in', swipe: 'swipe' }[m.kind];
  const key = m.kind + '|' + d.id + '|' + name;
  if (m.kind === 'input' && key === lastInputKey && $('#log .entry')) { $('#log .entry').dataset.id = id; $('#log .entry').querySelectorAll('.r').forEach(r => r.remove()); entries[id] = $('#log .entry'); return; }
  lastInputKey = m.kind === 'input' ? key : null;
  logLine(`<div class="entry" data-id="${id}"><div class="h">${d.name} <span>· ${verb}${name && m.key !== 'Escape' ? ' “' + esc(name) + '”' : ''}</span></div></div>`);
  entries[id] = $('#log .entry');
}
function addResult(m, d) {
  const el = entries[m.aid]; if (!el || el.dataset.id != m.aid) return;
  const label = { direct: 'same', semantic: 'matched', revealed: 'revealed', role: 'equivalent', nav: 'navigated', skip: 'skipped', none: 'no match', hidden: 'unreachable' }[m.status] || m.status;
  el.insertAdjacentHTML('beforeend', `<div class="r"><b>${d.name}</b><span class="tag ${m.status}">${label}</span><span>${esc(m.note)}</span></div>`);
}

/* ----------------------------- difference engine ----------------------------- */
const CATS = ['Content', 'Images', 'Typography', 'Layout', 'Tables', 'Navigation', 'Input', 'Usability'];
const q = s => '“' + (s.length > 38 ? s.slice(0, 36) + '…' : s) + '”';
const list = (arr0, n = 3, arr = [...new Set(arr0)]) => arr.slice(0, n).map(q).join(', ') + (arr.length > n ? ` +${arr.length - n} more` : '');

function index(data) { // merge duplicates (e.g. desktop nav link + drawer copy): visible if any copy is
  const m = new Map();
  for (const it of data.items) { const cur = m.get(it.key); if (!cur || (it.visible && !cur.visible)) m.set(it.key, it); }
  return m;
}
function analyze(snaps, refId) {
  const out = [], add = (sev, cat, dev, title, detail, keys) => out.push({ sev, cat, dev, title, detail, keys: keys || [] });
  const ref = snaps.find(s => s.dev.id === refId) || snaps[0];
  const R = index(ref.data);
  for (const { dev, data } of snaps) {
    const I = index(data), vis = [...I.values()].filter(i => i.visible), n = dev.name;
    // ---- per-device checks
    if (data.docW > data.vw + 2) add('issue', 'Layout', dev, `Page scrolls sideways (+${data.docW - data.vw}px)`, data.overflow.length ? 'Pushed out by ' + data.overflow.map(o => q(o.name) + ' +' + o.by + 'px').join(', ') : 'Content is wider than the viewport.', data.overflow.map(o => o.key));
    if (dev.touch && !data.metaViewport) add('issue', 'Usability', dev, 'No viewport meta tag', 'The page renders at desktop width and gets shrunk on phones.');
    const broken = vis.filter(i => i.cat === 'image' && i.broken); if (broken.length) add('issue', 'Images', dev, `${broken.length} broken image${broken.length > 1 ? 's' : ''}`, list(broken.map(i => i.name)), broken.map(i => i.key));
    const blurry = vis.filter(i => i.cat === 'image' && i.natW && !/\.svg$/i.test(i.src) && i.w > i.natW * 1.25); if (blurry.length) add('warn', 'Images', dev, `${blurry.length} image${blurry.length > 1 ? 's' : ''} stretched beyond source size`, blurry.slice(0, 3).map(i => `${q(i.name)} ${i.natW}px shown at ${i.w}px`).join(', '), blurry.map(i => i.key));
    const trunc = vis.filter(i => i.truncated); if (trunc.length) add('warn', 'Content', dev, `${trunc.length} text element${trunc.length > 1 ? 's' : ''} cut off`, list(trunc.map(i => i.name)), trunc.map(i => i.key));
    const tiny = vis.filter(i => (i.cat === 'text' || i.cat === 'heading' || i.cat === 'link') && i.size < 12); if (tiny.length) add('warn', 'Typography', dev, `${tiny.length} text element${tiny.length > 1 ? 's' : ''} under 12px`, list(tiny.map(i => `${i.name} (${i.size}px)`)), tiny.map(i => i.key));
    const edge = vis.filter(i => (i.cat === 'text' || i.cat === 'heading') && i.w > 60 && (i.x < 6 || i.x + i.w > data.vw - 6) && i.x + i.w <= data.vw + 2); if (edge.length) add('warn', 'Layout', dev, `${edge.length} text block${edge.length > 1 ? 's' : ''} touch the screen edge`, list(edge.map(i => i.name)), edge.map(i => i.key));
    const noName = vis.filter(i => i.cat === 'button' && i.unlabeled); if (noName.length) add('warn', 'Usability', dev, `${noName.length} control${noName.length > 1 ? 's have' : ' has'} no accessible name`, 'Icon-only buttons without a label.', noName.map(i => i.key));
    const hiding = data.fixed.filter(f => f.hides && f.hides.length);
    for (const f of hiding) add('issue', 'Usability', dev, `Overlay hides ${f.hides.length} control${f.hides.length > 1 ? 's' : ''}`, `${q(f.name || 'fixed element')} sits on top of ${list(f.hides, 4)}`, [f.key]);
    for (const f of data.fixed) if (!f.hides && !hiding.some(h => h.name === f.name)) add('warn', 'Usability', dev, `Fixed element covers ${f.cover}% of the screen`, q(f.name || 'element'), [f.key]);
    for (const t of vis.filter(i => i.cat === 'table')) {
      if (t.wide && !t.scrollable) add('issue', 'Tables', dev, 'Table is wider than its container', `${q(t.name)} overflows with no scroll wrapper.`, [t.key]);
      else if (t.wide) add('info', 'Tables', dev, dev.touch ? 'Table needs a sideways swipe' : 'Table needs horizontal scrolling', `${q(t.name)}: ${t.cols} columns in a scroll area.`, [t.key]);
    }
    if (dev.touch) {
      const taps = vis.filter(i => (i.cat === 'link' || i.cat === 'button' || i.cat === 'input') && !i.inline);
      const bad = taps.filter(i => Math.min(i.w, i.h) < 24), small = taps.filter(i => Math.min(i.w, i.h) >= 24 && Math.min(i.w, i.h) < 40);
      if (bad.length) add('issue', 'Input', dev, `${bad.length} tap target${bad.length > 1 ? 's' : ''} under 24px`, list(bad.map(i => `${i.name} (${i.w}×${i.h})`)), bad.map(i => i.key));
      if (small.length) add('warn', 'Input', dev, `${small.length} tap target${small.length > 1 ? 's' : ''} under 40px`, list(small.map(i => `${i.name} (${i.w}×${i.h})`)), small.map(i => i.key));
      if (data.hoverOnly.length) add('warn', 'Input', dev, `${data.hoverOnly.length} hover-only interaction${data.hoverOnly.length > 1 ? 's' : ''}`, 'Revealed on mouse hover, which touch screens do not have: ' + list(data.hoverOnly.map(h => h.name)), data.hoverOnly.map(h => h.key));
      const zoomy = vis.filter(i => i.cat === 'input' && /field/.test(i.kind || '') && i.size < 16); if (zoomy.length && dev.os === 'ios' && dev.kind === 'phone') add('info', 'Input', dev, `${zoomy.length} field${zoomy.length > 1 ? 's' : ''} under 16px font`, 'iOS Safari zooms the page when these are focused.', zoomy.map(i => i.key));
      const sw = data.scrollers.filter(s => !s.table); if (sw.length) add('info', 'Input', dev, `${sw.length} swipeable area${sw.length > 1 ? 's' : ''}`, 'Scrolls sideways by swipe' + (sw.some(s => s.snap) ? ' with snap points.' : '.'), sw.map(s => s.key));
    } else {
      const sw = data.scrollers.filter(s => !s.table); if (sw.length) add('info', 'Input', dev, `${sw.length} sideways scroll area${sw.length > 1 ? 's' : ''}`, 'Mouse users need a scrollbar, shift-wheel or arrow buttons here.', sw.map(s => s.key));
    }
    if (dev === ref.dev) continue;
    // ---- compared with the reference device
    const rn = ref.dev.name, gone = [], extra = [];
    for (const [k, r] of R) { if (!r.visible) continue; const i = I.get(k); if (!i || !i.visible) gone.push(r); }
    for (const i of vis) { const r = R.get(i.key); if (!r || !r.visible) extra.push(i); }
    const navGone = gone.filter(i => i.inNav && (i.cat === 'link' || i.cat === 'button'));
    if (navGone.length) {
      if (data.menuToggle) add('info', 'Navigation', dev, `Navigation collapses behind a menu button`, `${navGone.length} item${navGone.length > 1 ? 's' : ''} visible on ${rn} move into the menu: ${list(navGone.map(i => i.name), 4)}`, navGone.map(i => i.key));
      else add('issue', 'Navigation', dev, `${navGone.length} navigation item${navGone.length > 1 ? 's' : ''} disappear with no menu button`, list(navGone.map(i => i.name), 4), navGone.map(i => i.key));
    }
    const ctlGone = gone.filter(i => !i.inNav && (i.cat === 'link' || i.cat === 'button' || i.cat === 'input'));
    if (ctlGone.length) add('warn', 'Navigation', dev, `${ctlGone.length} control${ctlGone.length > 1 ? 's' : ''} from ${rn} not visible`, list(ctlGone.map(i => i.name), 4), ctlGone.map(i => i.key));
    const txtGone = gone.filter(i => i.cat === 'heading' || i.cat === 'text');
    if (txtGone.length) add('warn', 'Content', dev, `${txtGone.length} text block${txtGone.length > 1 ? 's' : ''} from ${rn} hidden`, list(txtGone.map(i => i.name)), txtGone.map(i => i.key));
    const imgGone = gone.filter(i => i.cat === 'image');
    if (imgGone.length) add('warn', 'Images', dev, `${imgGone.length} image${imgGone.length > 1 ? 's' : ''} from ${rn} hidden`, list(imgGone.map(i => i.name)), imgGone.map(i => i.key));
    const tblGone = gone.filter(i => i.cat === 'table');
    if (tblGone.length) add('info', 'Tables', dev, `Table replaced by another layout`, `${q(tblGone[0].name)} is shown as a table on ${rn} but not here.`, tblGone.map(i => i.key));
    const xs = extra.filter(i => i.cat !== 'nav');
    if (xs.length) add('info', 'Content', dev, `${xs.length} element${xs.length > 1 ? 's' : ''} only on ${n}`, list(xs.map(i => i.name || i.cat), 4), xs.map(i => i.key));

    const both = []; for (const i of vis) { const r = R.get(i.key); if (r && r.visible) both.push([r, i]); }
    const fam = both.filter(([r, i]) => r.font && i.font && r.font !== i.font);
    if (fam.length) add('warn', 'Typography', dev, `Font family changes on ${fam.length} element${fam.length > 1 ? 's' : ''}`, `${fam[0][0].font} → ${fam[0][1].font} · ${list(fam.map(p => p[1].name))}`, fam.map(p => p[1].key));
    const sized = both.filter(([r, i]) => (r.cat === 'heading' || r.cat === 'text') && Math.abs(r.size - i.size) >= 1);
    if (sized.length) { const heads = sized.filter(p => p[0].cat === 'heading').sort((a, b) => a[0].level - b[0].level); const pick = (heads.length ? heads : sized).slice(0, 3); add('info', 'Typography', dev, `Type scale adapts on ${sized.length} element${sized.length > 1 ? 's' : ''}`, pick.map(([r, i]) => `${q(r.name)} ${r.size}→${i.size}px`).join(', '), sized.map(p => p[1].key)); }
    const src = both.filter(([r, i]) => r.cat === 'image' && r.src && i.src && r.src !== i.src);
    if (src.length) add('info', 'Images', dev, `${src.length} image${src.length > 1 ? 's' : ''} served from a different file`, src.slice(0, 2).map(([r, i]) => `${r.src} → ${i.src}`).join(', '), src.map(p => p[1].key));
    const crop = both.filter(([r, i]) => r.cat === 'image' && r.h && i.h && Math.abs(r.w / r.h - i.w / i.h) / (r.w / r.h) > .08);
    if (crop.length) add('info', 'Images', dev, `${crop.length} image${crop.length > 1 ? 's' : ''} change shape`, crop.slice(0, 2).map(([r, i]) => `${q(r.name)} ${r.w}×${r.h} → ${i.w}×${i.h}`).join(', '), crop.map(p => p[1].key));
    const tcols = both.filter(([r, i]) => r.cat === 'table' && (r.cols !== i.cols || r.display !== i.display));
    for (const [r, i] of tcols) add('info', 'Tables', dev, r.display !== i.display ? 'Table restructured' : `Table shows ${i.cols} of ${r.cols} columns`, `${q(r.name)}: ${r.display !== i.display ? 'rendered as ' + i.display + ' instead of ' + r.display : 'columns are hidden on ' + n}.`, [i.key]);
    // side-by-side → stacked
    const blocks = both.filter(([r]) => r.cat === 'heading' || r.cat === 'image').sort((a, b) => a[0].y - b[0].y || a[0].x - b[0].x);
    const overlap = (a, b) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    const stacked = [];
    for (let a = 0; a < blocks.length && stacked.length < 60; a++) for (let b = a + 1; b < Math.min(blocks.length, a + 8); b++) {
      const [ra, ia] = blocks[a], [rb, ib] = blocks[b];
      if (overlap(ra, rb) > .5 * Math.min(ra.h, rb.h) && (ra.x + ra.w <= rb.x + 2 || rb.x + rb.w <= ra.x + 2) && overlap(ia, ib) <= 0) { stacked.push(ib); break; }
    }
    if (stacked.length > (dev.kind === 'desktop' ? 1 : 0)) add('info', 'Layout', dev, `${stacked.length} side-by-side element${stacked.length > 1 ? 's' : ''} stack vertically`, `Next to each other on ${rn}, one above the other here: ${list(stacked.map(i => i.name))}`, stacked.map(i => i.key));
    // reading order
    const rowMajor = k => (a, b) => overlap(a[k], b[k]) > .3 * Math.min(a[k].h, b[k].h) ? a[k].x - b[k].x : a[k].y - b[k].y; // same row → left to right
    const seq = both.filter(([r]) => r.cat === 'heading' || r.cat === 'image').sort(rowMajor(0));
    const dOrder = [...seq].sort(rowMajor(1)), pos = seq.map(p => dOrder.indexOf(p));
    const lis = []; const keep = new Set(); // longest increasing subsequence = elements that kept their order
    { const tails = [], prev = []; pos.forEach((v, idx) => { let lo = 0, hi = tails.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (pos[tails[mid]] < v) lo = mid + 1; else hi = mid; } prev[idx] = lo ? tails[lo - 1] : -1; tails[lo] = idx; }); let k = tails[tails.length - 1]; while (k >= 0 && k !== undefined) { keep.add(k); k = prev[k]; } }
    const moved = seq.filter((_, idx) => !keep.has(idx)).map(p => p[1]);
    if (moved.length && moved.length <= seq.length / 2 && dev.kind !== 'desktop') add('info', 'Layout', dev, `Reading order changes for ${moved.length} element${moved.length > 1 ? 's' : ''}`, `Appear in a different sequence than on ${rn}: ${list(moved.map(i => i.name))}`, moved.map(i => i.key));
  }
  return out;
}

async function detect(quiet) {
  const devs = active().filter(d => d.ready); if (devs.length < 1) return;
  $('#detect span').textContent = 'Measuring…';
  const rid = 's' + Date.now(), snaps = [];
  await new Promise(done => {
    pendingSnap[rid] = (d, data) => { if (data && !data.error) snaps.push({ dev: d, data }); if (snaps.length === devs.length) done(); };
    devs.forEach(d => post(d, 'snapshot', { rid })); setTimeout(done, 4000);
  });
  delete pendingSnap[rid];
  snaps.sort((a, b) => a.dev.slot - b.dev.slot);
  findings = snaps.length ? analyze(snaps, $('#ref').value) : [];
  window.__findings = findings;
  $('#detect span').textContent = 'Detect differences'; renderFindings(); if (quiet !== true) showTab('diff');
}
function renderFindings() {
  const order = { issue: 0, warn: 1, info: 2 };
  const cats = CATS.filter(c => findings.some(f => f.cat === c));
  $('#chips').innerHTML = cats.length ? `<button class="chip ${!catFilter ? 'on' : ''}" data-cat="">All ${findings.length}</button>` + cats.map(c => `<button class="chip ${catFilter === c ? 'on' : ''}" data-cat="${c}">${c} ${findings.filter(f => f.cat === c).length}</button>`).join('') : '';
  $('#diffn').textContent = findings.length || '';
  const shown = findings.map((f, i) => Object.assign(f, { i })).filter(f => !catFilter || f.cat === catFilter);
  if (!shown.length) { $('#findings').innerHTML = '<p class="muted">No differences found for this view.</p>'; return; }
  let html = '';
  for (const d of DEVICES) {
    const fs = shown.filter(f => f.dev === d).sort((a, b) => order[a.sev] - order[b.sev]); if (!fs.length) continue;
    const c = s => fs.filter(f => f.sev === s).length;
    html += `<div class="group">${d.name}<small>${c('issue')} issues · ${c('warn')} warnings · ${c('info')} adaptations</small></div>` +
      fs.map(f => `<div class="finding ${f.sev}" data-i="${f.i}"><div class="t">${esc(f.title)}<span class="c">${f.cat}</span></div><div class="d">${esc(f.detail)}</div></div>`).join('');
  }
  $('#findings').innerHTML = html;
}
$('#chips').addEventListener('click', e => { if (e.target.dataset.cat !== undefined) { catFilter = e.target.dataset.cat || null; renderFindings(); } });
$('#findings').addEventListener('click', e => {
  const el = e.target.closest('.finding'); if (!el) return; const f = findings[+el.dataset.i]; if (!f.keys.length) return;
  post(f.dev, 'highlight', { keys: f.keys });
  const ref = DEVICES.find(d => d.id === $('#ref').value); if (ref && ref !== f.dev) post(ref, 'highlight', { keys: f.keys });
  if (mode === 'focus') { focusDev = f.dev; relayout(); }
  cvAllow = Date.now() + 900;
  f.dev.el && f.dev.el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
});
$('#detect').onclick = () => detect();
function showTab(t) { $('#panel').hidden = false; if (mode === 'focus') relayout(); document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $('#pane-diff').hidden = t !== 'diff'; $('#pane-log').hidden = t !== 'log'; }
document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.tab) showTab(b.dataset.tab); });
$('#closepanel').onclick = () => { $('#panel').hidden = true; if (mode === 'focus') relayout(); };
document.querySelector('.right-tools').addEventListener('click', e => { const b = e.target.closest('[data-panel]'); if (!b) return; const t = b.dataset.panel, open = !$('#panel').hidden && !$('#pane-' + t).hidden; if (open) $('#closepanel').onclick(); else showTab(t); });

/* ----------------------------------- boot ----------------------------------- */
renderLeft();
const asked = new URLSearchParams(location.search).get('url');
let seenDemo = false; try { seenDemo = !!localStorage.getItem('samestate.seenDemo'); } catch (e) {}
if (!IS_EXT) { document.body.classList.add('web'); $('#src').placeholder = 'Live demo on a sample site — install the extension to open any page'; $('#own').textContent = 'Get the Chrome extension'; }
if (asked && IS_EXT) { $('#src').value = asked; open(asked); } else if (!seenDemo || !IS_EXT) startTour();
