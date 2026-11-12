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
].map((d, i) => Object.assign({ on: true }, d, { slot: i, touch: d.kind !== 'desktop', ready: false, rot: false, linked: true, pos: i }));
const SYNC = { click: ['Clicks & menus', true], scroll: ['Scrolling', true], hover: ['Hover', true] };
const KIND_SYNC = { click: 'click', scroll: 'scroll', escroll: 'scroll', swipe: 'scroll', hover: 'hover', unhover: 'hover' };

let target = null, previewUrl = null, leader = null, zoom = 1, mode = 'grid', focusDev = null, aid = 0, findings = [], catFilter = null;
let textSalt = null;
const active = () => DEVICES.filter(d => d.on && d.el);
function post(device, type, data) {
  if (!device?.iframe || !target) return;
  const message = { __samestateShell: 1, type, ...data };
  if (target === EXT) device.iframe.contentWindow.postMessage(message, EXT);
  else device.port?.postMessage(message);
}

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
const IC = { link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>', rot: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="14" rx="2"/><path d="M4 17a8 8 0 0 0 8 4M20 7a8 8 0 0 0-5-4"/></svg>', rel: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg>', foc: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>' };
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
  applyArrangement();
}
function buildFrames() {
  const wrap = $('#frames');
  $('#match-text').disabled = !target;
  wrap.innerHTML = ''; leader = null; pendingAlign.clear(); lastAlign = null;
  $('#empty').style.display = target ? 'none' : '';
  for (const d of DEVICES) {
    d.port?.disconnect();
    d.el = d.iframe = d.port = null;
    d.ready = false;
    if (!d.on || !target) continue;
    const el = document.createElement('div'), c = deviceChrome(d);
    el.className = `dev ${d.kind} ${d.os || ''} ${d.notch ? 'notch' : ''} ${d.linked ? '' : 'unlinked'}`;
    el.innerHTML = `<div class="dev-head"><i class="dot"></i><b>${d.name}</b><span class="dims"></span><span class="sp"></span><button data-a="link" title="Linked: this screen follows the others. Click to unlink.">${IC.link}</button>${d.touch ? `<button data-a="rot" title="Rotate">${IC.rot}</button>` : ''}<button data-a="rel" title="Reload">${IC.rel}</button><button data-a="foc" title="Focus this device">${IC.foc}</button></div><div class="dev-body"><div class="scaled">${c.top}<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads" allow="clipboard-write"></iframe>${c.bottom}</div></div>`;
    d.el = el; d.body = el.querySelector('.dev-body'); d.scaled = el.querySelector('.scaled'); d.iframe = el.querySelector('iframe');
    el.querySelector('.dev-head').addEventListener('click', e => {
      const b = e.target.closest('button'), a = b && b.dataset.a;
      if (a === 'rot') { d.rot = !d.rot; layout(d); }
      if (a === 'rel') post(d, 'reload');
      if (a === 'link') { d.linked = !d.linked; el.classList.toggle('unlinked', !d.linked); b.title = d.linked ? 'Linked: this screen follows the others. Click to unlink.' : 'Unlinked: this screen moves on its own. Click to link.'; }
      if (a === 'foc') { focusDev = d; setMode(mode === 'focus' ? 'grid' : 'focus'); }
    });
    arrangeable(d);
    d.token = crypto.randomUUID();
    if (target !== EXT) d.iframe.credentialless = true;
    // The bundled demo shares this page's origin, where a sandbox with scripts cannot isolate anything
    // and Chrome logs a warning. Real sites are another origin and keep the sandbox.
    else d.iframe.removeAttribute('sandbox');
    d.iframe.src = previewUrl;
    wrap.appendChild(el);
    d.el.querySelector('.addr').textContent = target === EXT ? 'tidepool.demo' : new URL(target).host;
  }
  relayout();
}
/* ---------------------------- arranging the wall ---------------------------- */
// Screens are reordered with the CSS order property: moving an iframe in the page would reload it.
// The arrangement lasts until the Samestate tab is closed or reloaded.
let layoutLocked = false, dragDev = null;
function moveScreen(list, moved, onto) { // "moved" takes the place of "onto"; returns the new order
  const order = [...list].sort((a, b) => a.pos - b.pos);
  const from = order.indexOf(moved), to = order.indexOf(onto);
  if (from < 0 || to < 0 || from === to) return order;
  order.splice(from, 1);
  order.splice(to, 0, moved);
  order.forEach((d, i) => { d.pos = i; });
  return order;
}
function applyArrangement() {
  for (const d of DEVICES) {
    if (!d.el) continue;
    d.el.style.order = d.pos;
    d.el.querySelector('.dev-head').draggable = !layoutLocked;
  }
  $('#frames').classList.toggle('locked', layoutLocked);
  const lock = $('#lock');
  lock.classList.toggle('on', layoutLocked);
  lock.querySelector('span').textContent = layoutLocked ? 'Unlock layout' : 'Lock layout';
  lock.title = layoutLocked ? 'Screens are fixed in place. Click to allow dragging.' : 'Drag a screen by its title to move it. Click to fix screens in place.';
}
function endArrange() {
  dragDev = null;
  $('#frames').classList.remove('arranging');
  document.querySelectorAll('.dev.dragging,.dev.drop-target').forEach(el => el.classList.remove('dragging', 'drop-target'));
}
function arrangeable(d) {
  const el = d.el, head = el.querySelector('.dev-head');
  head.addEventListener('dragstart', e => {
    if (layoutLocked || mode === 'focus' || e.target.closest?.('button')) { e.preventDefault(); return; }
    dragDev = d;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', d.name);
    // Changing the page inside dragstart cancels the drag in Chrome, so mark it just after.
    setTimeout(() => { if (dragDev === d) { el.classList.add('dragging'); $('#frames').classList.add('arranging'); } }, 0);
  });
  head.addEventListener('dragend', endArrange);
  el.addEventListener('dragover', e => {
    if (!dragDev || dragDev === d) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drop-target');
  });
  el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop-target'); });
  el.addEventListener('drop', e => {
    if (!dragDev || dragDev === d) return;
    e.preventDefault();
    moveScreen(DEVICES, dragDev, d);
    endArrange();
    applyArrangement();
  });
}
$('#lock').onclick = () => { layoutLocked = !layoutLocked; endArrange(); applyArrangement(); };

function setMode(m) { mode = m; document.querySelectorAll('#mode button').forEach(b => b.classList.toggle('on', b.dataset.v === m)); relayout(); }
function setZoom(v) { zoom = v / 100; $('#zoom').value = v; $('#zoomv').textContent = v + '%'; active().forEach(layout); }
$('#zoom').addEventListener('input', e => setZoom(+e.target.value));
$('#mode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.v); });
$('#align').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#align button').forEach(x => x.classList.toggle('on', x === b)); $('#frames').style.alignItems = b.dataset.v; });
$('#filters').onclick = () => $('#devlist').classList.toggle('closed');
$('#land').onclick = () => { active().forEach(d => { if (d.touch) d.rot = true; }); relayout(); };
$('#port').onclick = () => { active().forEach(d => { d.rot = false; }); relayout(); };
$('#rz').onclick = () => setZoom(100);
$('#alignall').onclick = () => alignScreens();
window.addEventListener('resize', () => mode === 'focus' && relayout());
// Keep the canvas where the user left it: a device frame taking focus (dialogs, synced typing) must not scroll the wall.
const cv = $('#canvas'); let cvPos = [0, 0], cvUser = 0, cvDrag = false, cvAllow = 0;
for (const ev of ['wheel', 'keydown', 'touchstart']) cv.addEventListener(ev, () => { cvUser = Date.now(); }, { passive: true, capture: true });
cv.addEventListener('pointerdown', () => { cvDrag = true; }, true); window.addEventListener('pointerup', () => { cvDrag = false; cvUser = Date.now(); }, true);
cv.addEventListener('scroll', () => { if (cvDrag || Date.now() - cvUser < 700 || Date.now() < cvAllow) cvPos = [cv.scrollLeft, cv.scrollTop]; else { cv.scrollLeft = cvPos[0]; cv.scrollTop = cvPos[1]; } });


/* ------------------------------ opening a page ------------------------------ */
// The same files run as the Chrome extension and as the web demo (GitHub Pages), where only the bundled sample site is available.
const IS_EXT = typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id);
const EXT = location.origin;
const REPO = 'https://github.com/shouvik12/samestate';
let openId = 0;
let registration = Promise.resolve();

function register(origin) {
  if (!IS_EXT) return Promise.resolve();
  registration = registration.catch(() => {}).then(async () => {
    const reply = await chrome.runtime.sendMessage({ type: 'register', origin });
    if (!reply?.ok) throw new Error('Preview registration failed');
  });
  return registration;
}

async function open(source, alreadyAllowed = false) {
  const id = ++openId;
  let url;
  const isDemo = source === 'demo';

  if (isDemo) {
    url = new URL('./demo/index.html', location.href);
  } else {
    if (!IS_EXT) return;
    try {
      const hasScheme = /^https?:\/\//i.test(source);
      const local = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(?=[:/]|$)/i.test(source);
      url = new URL(hasScheme ? source : (local ? 'http://' : 'https://') + source);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error();
    } catch {
      $('#joblog').textContent = 'Enter an HTTP or HTTPS address without credentials.';
      return;
    }
  }

  target = previewUrl = textSalt = null;
  $('#match-text').checked = false;
  buildFrames();
  findings = [];
  renderFindings();
  $('#joblog').textContent = '';
  $('#src').value = '';

  try {
    if (!isDemo && !alreadyAllowed) {
      const granted = await chrome.permissions.request({ origins: [`${url.protocol}//${url.hostname}/*`] });
      if (id !== openId) return;
      if (!granted) {
        await register(null);
        if (id === openId) $('#joblog').textContent = 'Allow access to the site in Chrome to open a preview.';
        return;
      }
    }
    await register(isDemo ? null : url.origin);
  } catch {
    if (id === openId) $('#joblog').textContent = 'Could not open the preview. Try opening the site again.';
    return;
  }

  if (id !== openId) return;
  target = url.origin;
  previewUrl = url.href;
  buildFrames();
  setTimeout(() => { if (id === openId) detect(true); }, 3500);
}

$('#open').addEventListener('submit', e => {
  e.preventDefault();
  const source = $('#src').value.trim();
  if (!source) return;
  endTour(false);
  redirects = 0;
  open(source);
});

// The site sent the preview to another origin (example.com → www.example.com). Chrome access, header
// handling and the agent are all tied to one origin, so the preview is reopened on the new one.
let redirects = 0, redirectHandled = 0, appTabId = null;
async function followRedirect(message) {
  if (message.tabId !== appTabId || !target || target === EXT || message.from !== previewUrl) return;
  if (redirectHandled === openId) return; // every device frame reports the same redirect
  const id = redirectHandled = openId;
  let url;
  try { url = new URL(message.url); } catch { return; }
  const from = new URL(target).host;
  let allowed = false;
  try { allowed = await chrome.permissions.contains({ origins: [`${url.protocol}//${url.hostname}/*`] }); } catch {}
  if (id !== openId) return;
  if (allowed && ++redirects <= 3) return open(url.href, true);

  // Chrome only shows its access prompt after a click or key press, so the address is filled in for the user.
  openId++;
  target = previewUrl = textSalt = null;
  $('#match-text').checked = false;
  buildFrames();
  findings = [];
  renderFindings();
  register(null).catch(() => {});
  $('#src').value = url.href;
  $('#src').focus();
  $('#joblog').textContent = allowed
    ? `${from} keeps redirecting. Press Enter to try ${url.host} again.`
    : `${from} redirects to ${url.host}. Press Enter to open it there.`;
}
/* -------------------------------- guided demo -------------------------------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dev = id => DEVICES.find(d => d.id === id);
const play = (id, m) => post(dev(id), 'demo', m);
const STEPS = [
  { t: 'Clicking <b>Products</b> on the Desktop. Phones and tablets have no nav bar, so each opens its own menu and then Products.', run: () => play('desktop', { do: 'click', sel: '.dd-btn' }), wait: 5200 },
  { t: 'Clicking <b>Sign in</b> on the Desktop. On phones that button lives inside the drawer, and the same dialog opens everywhere.', run: () => play('desktop', { do: 'click', sel: '.signin.desk-only' }), wait: 4600 },
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
  tour++; $('#tour').hidden = true;
  if (clear) { openId++; target = previewUrl = textSalt = null; $('#match-text').checked = false; buildFrames(); $('#panel').hidden = true; $('#joblog').textContent = ''; $('#src').value = ''; $('#src').focus(); findings = []; renderFindings(); $('#findings').innerHTML = '<p class="muted">Open a site, then press <b>Detect differences</b>.</p>'; }
}
$('#skip').onclick = () => endTour(IS_EXT); // on the web demo the sample site stays open to play with
$('#demo').onclick = $('#watch').onclick = startTour;
$('#own').onclick = () => { if (IS_EXT) $('#src').focus(); else window.open(REPO + '#install', '_blank', 'noopener'); };
$('#reload').onclick = () => active().forEach(device => post(device, 'reload'));
$('#match-text').onchange = event => {
  textSalt = event.target.checked ? crypto.randomUUID() : null;
  active().filter(device => device.ready).forEach(configure);
  detect(true);
};

/* ------------------------------ message routing ------------------------------ */
const pendingSnap = new Map(), entries = new Map();
const configure = device => post(device, 'config', { touch: device.touch, textSalt });

function handleMessage(device, message) {
  if (!message?.__samestate) return;
  switch (message.type) {
    case 'hello': {
      device.ready = true;
      device.el.classList.add('ready');
      configure(device);
      if (!leader) setLeader(device);
      const align = pendingAlign.get(device);
      pendingAlign.delete(device);
      // The screen was sent to the leading screen's page; now that it has loaded, match the scroll position.
      if (align) setTimeout(() => { if (device.ready) post(device, 'align', { ...align, navigate: false }); }, 700);
      break;
    }
    case 'state':
      pendingState.get(message.rid)?.(message);
      break;
    case 'aligning': // the screen is loading the leading screen's page; finish when it says hello again
      if (lastAlign) pendingAlign.set(device, lastAlign);
      break;
    case 'active':
      setLeader(device);
      break;
    case 'snapshot':
      pendingSnap.get(message.rid)?.(device, message.data);
      break;
    case 'result':
      addResult(message, device);
      break;
    case 'act': {
      if (!Object.hasOwn(KIND_SYNC, message.kind) || !SYNC[KIND_SYNC[message.kind]][1]) return;
      setLeader(device);
      if (!device.linked) return; // an unlinked screen moves on its own
      const id = ['click', 'swipe'].includes(message.kind) ? ++aid : 0;
      if (id) startEntry(id, device, message);
      const { type, __samestate, ...action } = message;
      for (const other of active()) {
        if (other !== device && other.ready && other.linked) post(other, 'act', { ...action, aid: id });
      }
      break;
    }
  }
}

/* Bring every linked screen to the page and scroll position of the leading screen (the one used last). */
const pendingState = new Map(), pendingAlign = new Map();
let lastAlign = null;
function alignTargets(all, lead) {
  return all.filter(d => d !== lead && d.ready && d.linked);
}
async function alignScreens() {
  const lead = leader?.ready ? leader : active().find(d => d.ready);
  if (!lead) return;
  const rid = crypto.randomUUID(), preview = openId;
  const state = await new Promise(done => {
    pendingState.set(rid, done);
    post(lead, 'state', { rid });
    setTimeout(() => done(null), 1500);
  });
  pendingState.delete(rid);
  if (!state || preview !== openId || typeof state.url !== 'string') return;
  lastAlign = { url: state.url, scroll: state.scroll };
  pendingAlign.clear();
  for (const other of alignTargets(active(), lead)) post(other, 'align', { ...lastAlign, navigate: true });
}

function setLeader(device) {
  if (leader === device) return;
  leader = device;
  DEVICES.forEach(d => d.el?.classList.toggle('leader', d === device));
}

window.addEventListener('message', event => {
  if (!target || event.origin !== target) return;
  const device = active().find(d => d.iframe.contentWindow === event.source);
  if (!device) return;
  if (target === EXT) handleMessage(device, event.data);
  else if (event.data?.__samestateReady === true) {
    device.iframe.contentWindow.postMessage({ type: 'connect', token: device.token }, target);
  }
});

if (IS_EXT) {
  const appTab = chrome.tabs.getCurrent();
  appTab.then(tab => { appTabId = tab?.id ?? null; });
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === 'redirected' && sender.id === chrome.runtime.id && !sender.tab) followRedirect(message);
  });
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== 'samestate-preview' || !port.sender?.frameId) return;
    async function identify(message) {
      port.onMessage.removeListener(identify);
      const tab = await appTab;
      const device = active().find(d => d.token === message.token);
      if (!device || tab?.id !== port.sender.tab?.id || port.sender.origin !== target) {
        port.disconnect();
        return;
      }
      device.port?.disconnect();
      device.port = port;
      port.onDisconnect.addListener(() => {
        if (device.port !== port) return;
        device.port = null;
        device.ready = false;
        device.el?.classList.remove('ready');
      });
      port.onMessage.addListener(data => { if (device.port === port) handleMessage(device, data); });
      handleMessage(device, { __samestate: 1, type: 'hello' });
    }
    port.onMessage.addListener(identify);
  });
}

/* --------------------------------- sync log --------------------------------- */
function startEntry(id, device, message) {
  const box = $('#log');
  box.querySelector('.muted')?.remove();
  const entry = document.createElement('div');
  entry.className = 'entry';
  const heading = document.createElement('div');
  heading.className = 'h';
  const name = message.d?.demoControl || message.d?.kind || 'control';
  heading.textContent = message.kind === 'swipe' ? device.name + ' · swipe' : device.name + ' · click ' + name;
  entry.appendChild(heading);
  box.prepend(entry);
  entries.set(id, entry);
  if (entries.size > 80) {
    const oldest = entries.keys().next().value;
    entries.get(oldest).remove();
    entries.delete(oldest);
  }
}

function addResult(message, device) {
  const entry = entries.get(message.aid);
  const labels = { direct: 'same', semantic: 'matched', revealed: 'revealed', skip: 'skipped', none: 'no match', hidden: 'unreachable' };
  if (!entry || !Object.hasOwn(labels, message.status)) return;
  const row = document.createElement('div');
  row.className = 'r';
  const name = document.createElement('b');
  name.textContent = device.name;
  const label = document.createElement('span');
  label.className = 'tag ' + message.status;
  label.textContent = labels[message.status];
  row.append(name, label);
  entry.appendChild(row);
}

/* ----------------------------- difference engine ----------------------------- */
const CATS = ['Content', 'Images', 'Typography', 'Layout', 'Tables', 'Navigation', 'Input', 'Usability'];
const q = s => '“' + (s.length > 38 ? s.slice(0, 36) + '…' : s) + '”';
const list = (arr0, n = 3, arr = [...new Set(arr0)]) => arr.slice(0, n).map(q).join(', ') + (arr.length > n ? ` +${arr.length - n} more` : '');

function index(data) {
  return new Map(data.items.map(item => [item.key, item]));
}

function uniqueTextItems(items) {
  const unique = new Map();
  for (const item of items.values()) {
    if (!item.textKey) continue;
    const key = item.cat + '|' + item.textKey;
    unique.set(key, unique.has(key) ? null : item);
  }
  return unique;
}

function matchItems(reference, device) {
  const matches = new Map(), used = new Set();
  if (textSalt) {
    const byText = uniqueTextItems(device);
    for (const [key, referenceItem] of uniqueTextItems(reference)) {
      const deviceItem = byText.get(key);
      if (referenceItem && deviceItem) {
        matches.set(referenceItem, deviceItem);
        used.add(deviceItem);
      }
    }
  }
  for (const item of reference.values()) {
    const counterpart = device.get(item.key);
    if (!matches.has(item) && counterpart && !used.has(counterpart)) {
      matches.set(item, counterpart);
      used.add(counterpart);
    }
  }
  return matches;
}
function analyze(snaps, refId) {
  const ref = snaps.find(s => s.dev.id === refId) || snaps[0];
  const out = [], referenceKeys = new Map();
  function add(sev, cat, dev, title, detail, keys = [], refKeys = keys.map(key => referenceKeys.get(key)).filter(Boolean)) {
    out.push({ sev, cat, dev, title, detail, keys, refKeys, reference: ref.dev });
  }
  const R = index(ref.data);
  for (const { dev, data } of snaps) {
    referenceKeys.clear();
    const I = index(data), vis = [...I.values()].filter(i => i.visible), n = dev.name;
    // ---- per-device checks
    if (data.docW > data.vw + 2) add('issue', 'Layout', dev, `Page scrolls sideways (+${data.docW - data.vw}px)`, data.overflow.length ? 'Pushed out by ' + data.overflow.map(o => q(o.name) + ' +' + o.by + 'px').join(', ') : 'Content is wider than the viewport.', data.overflow.map(o => o.key));
    if (dev.touch && !data.metaViewport) add('issue', 'Usability', dev, 'No viewport meta tag', 'The page renders at desktop width and gets shrunk on phones.');
    const broken = vis.filter(i => i.cat === 'image' && i.broken); if (broken.length) add('issue', 'Images', dev, `${broken.length} broken image${broken.length > 1 ? 's' : ''}`, list(broken.map(i => i.name)), broken.map(i => i.key));
    const blurry = vis.filter(i => i.cat === 'image' && i.natW && i.w > i.natW * 1.25); if (blurry.length) add('warn', 'Images', dev, `${blurry.length} image${blurry.length > 1 ? 's' : ''} stretched beyond source size`, blurry.slice(0, 3).map(i => `${q(i.name)} ${i.natW}px shown at ${i.w}px`).join(', '), blurry.map(i => i.key));
    const trunc = vis.filter(i => i.truncated); if (trunc.length) add('warn', 'Content', dev, `${trunc.length} text element${trunc.length > 1 ? 's' : ''} cut off`, list(trunc.map(i => i.name)), trunc.map(i => i.key));
    const tiny = vis.filter(i => (i.cat === 'text' || i.cat === 'heading' || i.cat === 'link') && i.size < 12); if (tiny.length) add('warn', 'Typography', dev, `${tiny.length} text element${tiny.length > 1 ? 's' : ''} under 12px`, list(tiny.map(i => `${i.name} (${i.size}px)`)), tiny.map(i => i.key));
    const edge = vis.filter(i => (i.cat === 'text' || i.cat === 'heading') && i.w > 60 && (i.x < 6 || i.x + i.w > data.vw - 6) && i.x + i.w <= data.vw + 2); if (edge.length) add('warn', 'Layout', dev, `${edge.length} text block${edge.length > 1 ? 's' : ''} touch the screen edge`, list(edge.map(i => i.name)), edge.map(i => i.key));
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
      const zoomy = vis.filter(i => i.cat === 'input' && /field/.test(i.kind || '') && i.size < 16); if (zoomy.length && dev.os === 'ios' && dev.kind === 'phone') add('info', 'Input', dev, `${zoomy.length} field${zoomy.length > 1 ? 's' : ''} under 16px font`, 'iOS Safari zooms the page when these are focused.', zoomy.map(i => i.key));
      const sw = data.scrollers.filter(s => !s.table); if (sw.length) add('info', 'Input', dev, `${sw.length} swipeable area${sw.length > 1 ? 's' : ''}`, 'Scrolls sideways by swipe' + (sw.some(s => s.snap) ? ' with snap points.' : '.'), sw.map(s => s.key));
    } else {
      const sw = data.scrollers.filter(s => !s.table); if (sw.length) add('info', 'Input', dev, `${sw.length} sideways scroll area${sw.length > 1 ? 's' : ''}`, 'Mouse users need a scrollbar, shift-wheel or arrow buttons here.', sw.map(s => s.key));
    }
    if (dev === ref.dev) continue;
    // ---- compared with the reference device
    const rn = ref.dev.name;
    const matches = matchItems(R, I);
    for (const [referenceItem, item] of matches) referenceKeys.set(item.key, referenceItem.key);
    const both = [...matches].filter(([r, i]) => r.visible && i.visible);
    const matchedVisible = new Set(both.map(([, item]) => item));
    const gone = [...R.values()].filter(item => item.visible && !matches.get(item)?.visible);
    const extra = vis.filter(item => !matchedVisible.has(item));
    const navGone = gone.filter(i => i.inNav && (i.cat === 'link' || i.cat === 'button'));
    if (navGone.length) {
      if (data.menuToggle) add('info', 'Navigation', dev, `Navigation collapses behind a menu button`, `${navGone.length} item${navGone.length > 1 ? 's' : ''} visible on ${rn} move into the menu: ${list(navGone.map(i => i.name), 4)}`, [], navGone.map(i => i.key));
      else add('issue', 'Navigation', dev, `${navGone.length} navigation item${navGone.length > 1 ? 's' : ''} disappear with no menu button`, list(navGone.map(i => i.name), 4), [], navGone.map(i => i.key));
    }
    const ctlGone = gone.filter(i => !i.inNav && (i.cat === 'link' || i.cat === 'button' || i.cat === 'input'));
    if (ctlGone.length) add('warn', 'Navigation', dev, `${ctlGone.length} control${ctlGone.length > 1 ? 's' : ''} from ${rn} not visible`, list(ctlGone.map(i => i.name), 4), [], ctlGone.map(i => i.key));
    const txtGone = gone.filter(i => i.cat === 'heading' || i.cat === 'text');
    if (txtGone.length) add('warn', 'Content', dev, `${txtGone.length} text block${txtGone.length > 1 ? 's' : ''} from ${rn} hidden`, list(txtGone.map(i => i.name)), [], txtGone.map(i => i.key));
    const imgGone = gone.filter(i => i.cat === 'image');
    if (imgGone.length) add('warn', 'Images', dev, `${imgGone.length} image${imgGone.length > 1 ? 's' : ''} from ${rn} hidden`, list(imgGone.map(i => i.name)), [], imgGone.map(i => i.key));
    const tblGone = gone.filter(i => i.cat === 'table');
    if (tblGone.length) add('info', 'Tables', dev, `Table replaced by another layout`, `${q(tblGone[0].name)} is shown as a table on ${rn} but not here.`, [], tblGone.map(i => i.key));
    const xs = extra.filter(i => i.cat !== 'nav');
    if (xs.length) add('info', 'Content', dev, `${xs.length} element${xs.length > 1 ? 's' : ''} only on ${n}`, list(xs.map(i => i.name || i.cat), 4), xs.map(i => i.key));

    const differentText = both.filter(([r, i]) => r.textKey && i.textKey && r.textKey !== i.textKey);
    if (differentText.length) {
      const detail = differentText.length === 1 ? '1 matched element has different text.' : differentText.length + ' matched elements have different text.';
      add('info', 'Content', dev, 'Visible text differs from ' + rn, detail, differentText.map(([, item]) => item.key));
    }
    const sized = both.filter(([r, i]) => (r.cat === 'heading' || r.cat === 'text') && Math.abs(r.size - i.size) >= 1);
    if (sized.length) { const heads = sized.filter(p => p[0].cat === 'heading').sort((a, b) => a[0].level - b[0].level); const pick = (heads.length ? heads : sized).slice(0, 3); add('info', 'Typography', dev, `Type scale adapts on ${sized.length} element${sized.length > 1 ? 's' : ''}`, pick.map(([r, i]) => `${q(r.name)} ${r.size}→${i.size}px`).join(', '), sized.map(p => p[1].key)); }
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
  const rid = crypto.randomUUID(), snaps = [];
  const scanSalt = textSalt;
  const scanPreview = openId;
  await new Promise(done => {
    pendingSnap.set(rid, (d, data) => { if (data) snaps.push({ dev: d, data }); if (snaps.length === devs.length) done(); });
    devs.forEach(d => post(d, 'snapshot', { rid })); setTimeout(done, 4000);
  });
  pendingSnap.delete(rid);
  if (scanSalt !== textSalt || scanPreview !== openId) return;
  snaps.sort((a, b) => a.dev.slot - b.dev.slot);
  findings = snaps.length ? analyze(snaps, $('#ref').value) : [];
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
  const el = e.target.closest('.finding'); if (!el) return;
  const f = findings[+el.dataset.i];
  if (f.keys.length) post(f.dev, 'highlight', { keys: f.keys });
  if (f.refKeys.length) post(f.reference, 'highlight', { keys: f.refKeys });
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
if (!IS_EXT) { document.body.classList.add('web'); $('#src').placeholder = 'Live demo on a sample site — install the extension to open any page'; $('#own').textContent = 'Get the Chrome extension'; }
// The extension starts on the default site, which the manifest already has access to, so no prompt is
// needed. The web demo can only show the bundled sample site, so it starts with the tour.
const DEFAULT_SITE = 'https://claude.com/';
async function openDefault() {
  const url = new URL(DEFAULT_SITE);
  let allowed = false;
  try { allowed = await chrome.permissions.contains({ origins: [`${url.protocol}//${url.hostname}/*`] }); } catch {}
  if (target || openId) return; // the user already opened something
  if (allowed) return open(DEFAULT_SITE, true);
  $('#src').value = DEFAULT_SITE;
  $('#joblog').textContent = `Press Enter to open ${url.host}.`;
}
if (IS_EXT) openDefault(); else startTour();
