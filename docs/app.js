'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function previewDevice(preset, slot) {
  return { ...preset, slot, touch: preset.kind !== 'desktop', on: !!preset.starter, ready: false, rot: false, linked: true, scaleOverride: null, physicalScale: null, x: null, y: null };
}
const DEVICES = [...DEVICE_PRESETS, ...loadCustomDevices()].map(previewDevice);
let nextDeviceSlot = DEVICES.length;
const pageScreens = [];
let pageSteps = false, sameDevice = false, sharedDeviceId = 'iphone', nextPage = 1, deviceWallMode = 'grid';
const allScreens = () => [...DEVICES, ...pageScreens];
const viewScreens = () => pageSteps ? pageScreens : DEVICES.filter(d => d.on);
const presetFor = d => (sameDevice || d.step) ? DEVICES.find(device => device.id === sharedDeviceId) || d : d;
const SYNC = { click: ['Clicks & menus', true], nav: ['Links & pages', true], scroll: ['Scrolling', true], hover: ['Hover', true], media: ['Video playback', true] };
const KIND_SYNC = { click: 'click', navigate: 'nav', scroll: 'scroll', escroll: 'scroll', swipe: 'scroll', hover: 'hover', unhover: 'hover', media: 'media' };

let target = null, previewUrl = null, leader = null, zoom = 1, mode = 'grid', focusDev = null, aid = 0, findings = [], catFilter = null;
let textSalt = null, wallRevision = 0;
let videoRequest = null;
const active = () => viewScreens().filter(d => d.el);
const siteScreens = site => site.picker.value === 'wall' ? site.devices.filter(d => d.el && !d.el.hidden) : [];
const workspaceScreens = () => sitesMode ? sitePanels.flatMap(siteScreens) : active();
const connectedScreens = () => [...allScreens(), ...sitePanels.flatMap(site => [site.singleDevice, ...site.devices])];
const previewOrigin = device => device.site ? device.site.url?.origin : target;
const CALIBRATION_WIDTH = 160;
const PREVIEW_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
let calibrationWidthMm = null;
function post(device, type, data) {
  if (!device?.iframe || !previewOrigin(device)) return;
  const message = { __samestateShell: 1, type, ...data };
  if (previewOrigin(device) === EXT) device.iframe.contentWindow.postMessage(message, EXT);
  else device.port?.postMessage(message);
}

/* ------------------------------- left panel ------------------------------- */
function updateReference() {
  const reference = $('#ref');
  const selection = reference.value;
  const selected = sitesMode ? [...new Map(workspaceScreens().map(d => [d.id, d])).values()] : viewScreens();
  reference.replaceChildren(...selected.map(d => new Option(screenName(d), d.id)));
  reference.disabled = selected.length === 0;
  if (selected.some(d => d.id === selection)) reference.value = selection;
  else if (selected.some(d => d.id === 'desktop')) reference.value = 'desktop';
}

function renderLeft() {
  refreshDevicePicker();
  $('#synclist').innerHTML = Object.keys(SYNC).map(k => `<label class="row"><input type="checkbox" data-sync="${k}" ${SYNC[k][1] ? 'checked' : ''}>${SYNC[k][0]}</label>`).join('');
  updateReference();
}
$('#synclist').addEventListener('change', e => {
  if (e.target.dataset.sync) SYNC[e.target.dataset.sync][1] = e.target.checked;
});

/* --------------------------------- frames --------------------------------- */
const IC = { link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>', rot: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="14" rx="2"/><path d="M4 17a8 8 0 0 0 8 4M20 7a8 8 0 0 0-5-4"/></svg>', rel: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg>', foc: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>' };
const NAVIC = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg><svg viewBox="0 0 24 24"><path d="M12 15V4m-4 4 4-4 4 4M6 12v8h12v-8"/></svg><svg viewBox="0 0 24 24"><rect x="5" y="5" width="11" height="11" rx="2"/><path d="M9 19h8a2 2 0 0 0 2-2V9"/></svg>';
const ANDIC = '<svg viewBox="0 0 24 24"><path d="M15 6l-7 6 7 6z"/></svg><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg><svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>';
function deviceChrome(preset, landscape) {
  if (preset.frame) return { top: '', bottom: '', extra: 0 };
  if (preset.kind === 'desktop') return { top: '<div class="c-win"><s></s><s></s><s></s><span class="addr"></span></div>', bottom: '', extra: 38 };
  const status = '<div class="c-status"><span>9:41</span><span><u></u><i></i></span></div>';
  const url = '<div class="c-url"><span class="addr"></span><em></em></div>';
  if (preset.kind === 'tablet') return { top: status + url, bottom: '', extra: 74 };
  const ios = preset.os === 'ios';
  return { top: status + url, bottom: '<div class="c-bottom">' + (ios ? NAVIC : ANDIC) + '</div>', extra: landscape ? 74 : ios ? 120 : 114 };
}

function screenName(d) {
  if (d.site) return sameDevice ? d.name + ' · ' + presetFor(d).name : d.name;
  if (d.step) return 'Step ' + d.step + ' · ' + presetFor(d).name;
  if (sameDevice) return 'Screen ' + (viewScreens().indexOf(d) + 1) + ' · ' + presetFor(d).name;
  return d.name;
}

function size(d) {
  const { w, h, kind } = presetFor(d);
  return d.rot && kind !== 'desktop' ? { w: h, h: w } : { w, h };
}

// Phones and tablets tell the page they are one (emulate.js reads this from the frame's name before the page runs):
// user-agent, platform, touch, pixel ratio and screen size. Desktop presets keep the browser's own identity.
// Off unless turned on: a site whose server picks the layout still sends desktop pages, and its scripts may then
// build a page no real phone gets, so screens would stop showing the same thing.
let emulateDevices = false;
try { emulateDevices = localStorage.getItem('samestate.emulate') === 'on'; } catch {}
const CHROME_MAJOR = (navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1] || '130';
const IOS_VERSION = '17_5', SAFARI_VERSION = '17.5';
function deviceIdentity(d) {
  const preset = presetFor(d);
  if (!emulateDevices || preset.kind === 'desktop') return null;
  const { w, h } = size(d);
  const ios = preset.os === 'ios', phone = preset.kind === 'phone';
  // iPads have reported themselves as a Mac with touch since iPadOS 13.
  const ua = ios
    ? phone
      ? `Mozilla/5.0 (iPhone; CPU iPhone OS ${IOS_VERSION} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${SAFARI_VERSION} Mobile/15E148 Safari/604.1`
      : `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${SAFARI_VERSION} Safari/605.1.15`
    : `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 ${phone ? 'Mobile ' : ''}Safari/537.36`;
  return {
    ua, ios, mobile: phone, chrome: CHROME_MAJOR, w, h, dpr: phone ? 3 : 2,
    platform: ios ? (phone ? 'iPhone' : 'MacIntel') : 'Linux armv81',
    vendor: ios ? 'Apple Computer, Inc.' : 'Google Inc.'
  };
}
const identityName = d => { const identity = deviceIdentity(d); return identity ? 'samestate-device:' + JSON.stringify(identity) : ''; };
// A frame keeps the name it was created with, whatever its name attribute says later, so a changed identity is
// handed to the preview's agent, which renames its own window; with reload, the page then loads with it.
function setIdentity(d, reload) {
  const identity = identityName(d);
  if (identity === d.identity && !reload) return;
  d.identity = d.iframe.name = identity;
  if (d.ready) post(d, 'identity', { name: identity, reload });
}

function physicalSetting(d, preset) {
  return d.physicalScale?.presetId === preset.id ? d.physicalScale : null;
}

function layout(d) {
  const preset = presetFor(d);
  const { w, h } = size(d);
  const chrome = deviceChrome(preset, w > h);
  if (d.chromeId !== preset.id) {
    const classes = ['phone', 'tablet', 'desktop', 'ios', 'android', 'watch', 'display', 'notch'];
    d.el.classList.remove(...classes);
    d.el.classList.add(...[preset.kind, preset.os, preset.frame, preset.notch && 'notch'].filter(Boolean));
    d.top.innerHTML = chrome.top;
    d.bottom.innerHTML = chrome.bottom;
    d.touch = preset.kind !== 'desktop';
    d.el.querySelector('[data-a=rot]').hidden = !d.touch;
    d.chromeId = preset.id;
    if (d.ready) configure(d);
  }
  // A changed preset or orientation applies from the preview's next page load.
  setIdentity(d, false);
  const address = d.top.querySelector('.addr');
  if (address) address.textContent = d.site ? (d.site.url.origin === EXT ? 'tidepool.demo' : d.site.url.host) : d.step ? new URL(d.pageUrl).pathname : target === EXT ? 'tidepool.demo' : new URL(target).host;
  const name = screenName(d);
  d.el.querySelector('.dev-name').textContent = name;
  d.iframe.title = name + ' preview';
  d.el.classList.toggle('landscape', w > h);
  const physical = physicalSetting(d, preset);
  const pixelsPerMm = physical ? CALIBRATION_WIDTH / calibrationWidthMm : 0;
  d.el.classList.toggle('physical-preview', !!physical);
  let scale = physical ? physical.mmPerViewportPx * pixelsPerMm : d.scaleOverride ?? preset.scale * zoom;
  const height = physical ? h : h + chrome.extra;
  if (d.site && !physical && d.scaleOverride === null) {
    const panelWidth = Math.max(1, d.site.preview.clientWidth - 58);
    scale = mode === 'focus'
      ? Math.min(panelWidth / w, Math.max(1, d.site.preview.clientHeight - 78) / height, 1.2)
      : Math.min(scale, panelWidth / w);
  } else if (!d.site && mode === 'focus' && !physical && d.scaleOverride === null) {
    const canvas = $('#canvas');
    scale = Math.min(Math.max(1, canvas.clientWidth - 80) / w, Math.max(1, canvas.clientHeight - 90) / height, 1.2);
  }
  d.body.style.width = w * scale + 'px';
  d.body.style.height = height * scale + 'px';
  d.body.style.boxSizing = 'content-box';
  if (physical && preset.physical) {
    const { bodyWidth, bodyHeight } = preset.physical;
    const [widthMm, heightMm] = d.rot ? [bodyHeight, bodyWidth] : [bodyWidth, bodyHeight];
    const vertical = Math.max(0, (heightMm * pixelsPerMm - h * scale) / 2);
    const horizontal = Math.max(0, (widthMm * pixelsPerMm - w * scale) / 2);
    d.body.style.padding = `${vertical}px ${horizontal}px`;
  } else d.body.style.padding = '';
  d.scaled.style.width = w + 'px';
  d.scaled.style.transform = 'scale(' + scale + ')';
  d.iframe.style.width = w + 'px';
  d.iframe.style.height = h + 'px';
  d.annotations.redraw();
  d.el.querySelector('.viewport-size').textContent = '(' + w + ' × ' + h + ')';
  const scaleButton = d.el.querySelector('[data-a=scale]');
  const percent = Math.round(scale * 100) + '%';
  scaleButton.textContent = percent;
  scaleButton.title = physical ? 'Calibrated physical size · Change preview scale' : 'Change preview scale';
  scaleButton.setAttribute('aria-label', 'Change preview scale for ' + name + ', currently ' + percent + (physical ? ' at calibrated physical size' : ''));
}

function relayout() {
  if (sitesMode) { sitePanels.forEach(fitSite); refreshThemeTargets(); return; }
  if (typeof cvAllow !== 'undefined') cvAllow = Date.now() + 300;
  const f = $('#frames');
  f.className = 'frames ' + mode;
  const visible = new Set(active());
  if (mode === 'focus' && !visible.has(focusDev)) focusDev = visible.has(leader) ? leader : active()[0];
  for (const d of allScreens()) {
    if (!d.el) continue;
    d.el.hidden = !visible.has(d);
    if (!d.el.hidden) {
      d.el.classList.toggle('focused', d === focusDev);
      layout(d);
    }
  }
  applyArrangement();
  refreshThemeTargets();
}

function setPreviewSource(frame, url) {
  if (url.origin === EXT) frame.removeAttribute('sandbox');
  else frame.setAttribute('sandbox', PREVIEW_SANDBOX);
  frame.credentialless = url.origin !== EXT;
  frame.src = url.href;
}

function addFrame(d) {
  const el = document.createElement('div');
  const closeLabel = d.step ? 'Close this step' : 'Close this preview';
  el.className = 'dev' + (d.linked ? '' : ' unlinked');
  el.innerHTML = `<div class="dev-head"><i class="dot"></i><b class="dev-name"></b><span class="dims"><span class="viewport-size" title="Page viewport in CSS pixels"></span><button type="button" data-a="scale" class="preview-scale-button" aria-haspopup="dialog" title="Change preview scale"></button></span><span class="sp"></span><button data-a="link" title="Toggle screen link"${d.step ? ' hidden' : ''}>${IC.link}</button><button data-a="rot" title="Rotate">${IC.rot}</button><button data-a="rel" title="Reload">${IC.rel}</button><button data-a="foc" title="Focus this device">${IC.foc}</button><button type="button" data-a="close" title="${closeLabel}" aria-label="${closeLabel}">×</button></div><div class="dev-body"><div class="scaled"><div class="device-top"></div><iframe sandbox="${PREVIEW_SANDBOX}" allow="autoplay; clipboard-write"></iframe><div class="device-bottom"></div></div></div>`;
  d.el = el;
  d.body = el.querySelector('.dev-body');
  d.scaled = el.querySelector('.scaled');
  d.iframe = el.querySelector('iframe');
  d.top = el.querySelector('.device-top');
  d.bottom = el.querySelector('.device-bottom');
  const annotationTools = document.createElement('div');
  d.body.before(annotationTools);
  d.annotations = mountPreviewAnnotations(d.iframe, el.querySelector('.dev-head'), annotationTools, () => fitWall(d.site));
  d.chromeId = null;
  el.querySelector('.dev-head').addEventListener('click', event => {
    const button = event.target.closest('button');
    const action = button?.dataset.a;
    if (action === 'scale') editPreviewScale(d, button);
    if (action === 'rot') { d.rot = !d.rot; layout(d); fitWall(d.site); }
    if (action === 'rel') post(d, 'reload');
    if (action === 'link') {
      d.linked = !d.linked;
      el.classList.toggle('unlinked', !d.linked);
      button.title = d.linked ? 'Linked: this screen follows the others. Click to unlink.' : 'Unlinked: this screen moves on its own. Click to link.';
    }
    if (action === 'foc') {
      if (d.site) for (const site of sitePanels) site.focusDev = site.devices.find(device => device.id === d.id);
      else focusDev = d;
      setMode(mode === 'focus' ? 'grid' : 'focus');
      if (d.site) updateSiteTools();
    }
    if (action === 'close') {
      if (d.site) { d.on = false; removeFrame(d); fitSite(d.site); updateSiteTools(); }
      else if (d.step) closePage(d);
      else {
        selectDevice(d, false);
        refreshDevicePicker();
      }
    }
  });
  arrangeable(d);
  d.themeTargetId = d.token = crypto.randomUUID();
  d.identity = d.iframe.name = identityName(d); // before the first load
  if (d.site) {
    setPreviewSource(d.iframe, d.site.url);
    d.site.frames.append(el);
  } else {
    setPreviewSource(d.iframe, new URL(d.pageUrl || previewUrl));
    const next = allScreens().find(item => item.slot > d.slot && item.el);
    $('#frames').insertBefore(el, next?.el || null);
  }
}

const scaleDialog = $('#preview-scale');
const scaleInput = $('#preview-scale-value');
const physicalSettings = $('#physical-size-settings');
const calibrationInput = $('#physical-calibration-mm');
const screenWidthInput = $('#physical-screen-mm');
$('#physical-calibration-line').style.width = CALIBRATION_WIDTH + 'px';
let scaleDevice = null;

function editPreviewScale(d, button) {
  scaleDevice = d;
  scaleDialog.returnValue = '';
  $('#preview-scale-title').textContent = screenName(d);
  scaleInput.value = Math.max(1, Number.parseInt(button.textContent, 10));
  const preset = presetFor(d);
  const physical = physicalSetting(d, preset);
  const mmPerViewportPx = preset.physical ? preset.physical.screenWidth / preset.w : physical?.mmPerViewportPx;
  physicalSettings.open = !!physical;
  calibrationInput.value = calibrationWidthMm ?? '';
  screenWidthInput.value = mmPerViewportPx ? (mmPerViewportPx * size(d).w).toFixed(1) : '';
  screenWidthInput.readOnly = !!preset.physical;
  $('#physical-size-note').textContent = preset.physical
    ? 'Uses this model’s screen and body dimensions.'
    : 'Enter the device’s display width in this orientation, excluding the bezel.';
  scaleDialog.showModal();
  scaleInput.select();
}

scaleDialog.addEventListener('close', () => {
  const choice = scaleDialog.returnValue;
  if (scaleDevice?.el && choice === 'physical') {
    const preset = presetFor(scaleDevice);
    const mmPerViewportPx = preset.physical ? preset.physical.screenWidth / preset.w : screenWidthInput.valueAsNumber / size(scaleDevice).w;
    calibrationWidthMm = calibrationInput.valueAsNumber;
    scaleDevice.scaleOverride = null;
    scaleDevice.physicalScale = { presetId: preset.id, mmPerViewportPx };
    relayout();
  } else if (scaleDevice?.el && ['apply', '100', 'auto'].includes(choice)) {
    scaleDevice.physicalScale = null;
    scaleDevice.scaleOverride = choice === 'apply' ? scaleInput.valueAsNumber / 100 : choice === '100' ? 1 : null;
    relayout();
  }
  scaleDevice = null;
});

function removeFrame(d) {
  pendingAlign.delete(d);
  const port = d.port;
  d.port = null;
  port?.disconnect();
  d.el?.remove();
  d.el = d.iframe = null;
  d.annotations = null;
  d.ready = false;
  d.themeCss = '';
}

function updateWall() {
  wallRevision++;
  videoRequest = null;
  $('#video-status').textContent = '';
  $('#match-text').disabled = sitesMode ? !workspaceScreens().length : !target;
  $('#empty').style.display = target ? 'none' : '';
  $('#wall-empty').textContent = pageSteps ? 'Enter a page address to add a step.' : 'Select devices in the sidebar to preview this site.';
  $('#wall-empty').hidden = !target || active().length > 0;
  if (IS_EXT) $('#src').placeholder = pageSteps && target ? 'Enter a site or /path' : 'https://your-site.com';
  $('#detect span').textContent = 'Detect differences';
  relayout();
  if (sitesMode) {
    updateReference();
    $('#match-text').disabled = !workspaceScreens().length;
  }
  $('#frames').dispatchEvent(new Event('wall-view-changed'));
}

function buildFrames() {
  for (const d of allScreens()) removeFrame(d);
  pageScreens.length = 0;
  freePlacement.steps = false;
  nextPage = 1;
  leader = null;
  lastAlign = null;
  if (target) {
    DEVICES.filter(d => d.on).forEach(addFrame);
    if (pageSteps) addPage(previewUrl);
  }
  updateReference();
  updateWall();
}

function selectDevice(d, selected) {
  const wasEmpty = selected && !active().length;
  d.on = selected;
  // A screen switched back on is placed next to the screens already showing, not at the spot it
  // had before, which can be far to the right of an otherwise empty wall.
  if (selected) d.x = d.y = null;
  if (target && selected) addFrame(d);
  else removeFrame(d);
  if (leader === d && !d.el) setLeader(active().find(item => item.ready) || null);
  updateReference();
  findings = [];
  renderFindings();
  updateWall();
  if (wasEmpty) { cvAllow = Date.now() + 300; cv.scrollLeft = cv.scrollTop = 0; cvPos = [0, 0]; updateWallScroll(); }
}

function deviceOptions() {
  return Object.entries(DEVICE_GROUPS).map(([id, label]) => {
    const group = document.createElement('optgroup');
    group.label = label;
    group.append(...DEVICES.filter(d => d.group === id).map(d => new Option(d.name, d.id)));
    return group;
  }).filter(group => group.childElementCount);
}

function fillSharedDevices() {
  const picker = $('#shared-device');
  picker.replaceChildren(...deviceOptions());
  if (!DEVICES.some(d => d.id === sharedDeviceId)) sharedDeviceId = 'iphone';
  picker.value = sharedDeviceId;
}

function addPage(url, actions = []) {
  const preset = DEVICES.find(d => d.id === sharedDeviceId);
  const step = nextPage++;
  const d = previewDevice({ ...preset, id: 'step-' + step, step, pageUrl: url, actions, replayPending: actions.length > 0 }, nextDeviceSlot++);
  pageScreens.push(d);
  addFrame(d);
  return d;
}

function refreshViews() {
  const journeyView = pageSteps && !sitesMode;
  $('#device-sizes').value = sameDevice ? 'same' : 'different';
  $('#device-sizes').disabled = journeyView;
  if (journeyView) $('#device-sizes').value = 'same';
  $('#shared-device-row').hidden = !sameDevice && !journeyView;
  $('#page-steps').checked = journeyView;
  $('#page-steps').title = sitesMode ? 'Open Page steps on the device wall' : '';
  $('#page-steps-help').hidden = !journeyView;
  $('#alignall').disabled = pageSteps && !sitesMode;
  document.querySelectorAll('#synclist input').forEach(input => { input.disabled = pageSteps && !sitesMode; });
  if (!active().includes(leader)) setLeader(active().find(d => d.ready) || null);
  updateReference();
  findings = [];
  renderFindings();
  updateWall();
}

function setPageSteps(enabled) {
  if (pageSteps === enabled) return;
  if (enabled) deviceWallMode = mode;
  pageSteps = enabled;
  clearThemePreset();
  $('#page-steps-status').textContent = '';
  if (pageSteps && target && !pageScreens.length) addPage(previewUrl);
  updateMode(pageSteps ? 'row' : deviceWallMode);
  refreshViews();
  for (const d of pageScreens) if (d.ready) configure(d);
}

function openPage(address, source, action) {
  const status = $('#page-steps-status');
  let url;
  try { url = new URL(address, previewUrl); } catch { url = null; }
  if (!url || url.origin !== target || url.username || url.password || (target === EXT && !url.pathname.startsWith(DEMO_PATH))) {
    status.textContent = 'Choose a page on the current site.';
    return;
  }
  const actions = action ? [...(source.pageUrl === url.href ? source.actions : []), action] : [];
  const d = addPage(url.href, actions);
  refreshViews();
  status.textContent = 'Added step ' + d.step + '.';
  if (mode === 'focus') { focusDev = d; relayout(); }
  cvAllow = Date.now() + 900;
  d.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function closePage(d) {
  removeFrame(d);
  pageScreens.splice(pageScreens.indexOf(d), 1);
  $('#page-steps-status').textContent = 'Closed step ' + d.step + '.';
  refreshViews();
}

$('#device-sizes').addEventListener('change', event => {
  sameDevice = event.target.value === 'same';
  refreshViews();
});
$('#shared-device').addEventListener('change', event => {
  sharedDeviceId = event.target.value;
  for (const d of connectedScreens()) if (sameDevice || d.step) d.rot = false;
  refreshViews();
});
// Turns phone and tablet identity on or off and reloads the previews, which read it when a page loads.
// The guided demo turns it on for one step without saving, then puts back the user's choice.
function setDeviceIdentity(on, save) {
  emulateDevices = on;
  $('#device-identity').checked = on;
  if (save) try { localStorage.setItem('samestate.emulate', on ? 'on' : 'off'); } catch {}
  for (const d of connectedScreens()) {
    if (!d.el || d === d.site?.singleDevice) continue;
    setIdentity(d, true);
  }
}
const savedDeviceIdentity = () => { try { return localStorage.getItem('samestate.emulate') === 'on'; } catch { return false; } };
function restoreDeviceIdentity() {
  if (emulateDevices !== savedDeviceIdentity()) setDeviceIdentity(savedDeviceIdentity(), false);
}
$('#device-identity').checked = emulateDevices;
$('#device-identity').addEventListener('change', event => setDeviceIdentity(event.target.checked, true));
$('#page-steps').addEventListener('change', event => {
  const enabled = event.target.checked;
  endTour(false);
  if (sitesMode) setSitesMode(false);
  setPageSteps(enabled);
});

/* ---------------------------- arranging the wall ---------------------------- */
// Screens can be dragged by their title bar to any place on the wall. The first drag pins every screen where
// it is, then each one moves freely. Screens are positioned with CSS, never moved in the page, because moving
// an iframe would reload it. Choosing Grid or Row again returns to the automatic layout. The arrangement
// lasts until the Samestate tab is closed or reloaded.
const SNAP = 10, WALL_PAD = 40;
const freePlacement = { devices: false, steps: false };
let layoutLocked = false, drag = null, topZ = 1;
const currentWall = () => pageSteps ? 'steps' : 'devices';
const freelyPlaced = site => mode !== 'focus' && (site ? site.freePlacement === true : freePlacement[currentWall()]);
const arrangementFrames = site => site ? site.frames : $('#frames');
const arrangementScreens = site => site ? siteScreens(site) : active();
const snap = v => Math.max(0, Math.round(v / SNAP) * SNAP);
// Where a dragged screen lands: its start position plus the pointer movement, snapped and kept on the wall.
function dragTarget(start, from, to) {
  return { x: snap(start.x + to.x - from.x), y: snap(start.y + to.y - from.y) };
}
// The wall must be large enough to scroll to every screen.
function wallSize(boxes) {
  let w = 0, h = 0;
  for (const b of boxes) { w = Math.max(w, b.x + b.w); h = Math.max(h, b.y + b.h); }
  return { w: w + WALL_PAD, h: h + WALL_PAD };
}
// A screen switched on after the wall was arranged goes to the right of everything else.
function nextFreeSpot(boxes) {
  return { x: boxes.length ? snap(Math.max(...boxes.map(b => b.x + b.w)) + 30) : 26, y: 22 };
}
const boxOf = d => ({ x: d.x, y: d.y, w: d.el.offsetWidth, h: d.el.offsetHeight });
function fitWall(site) {
  const f = arrangementFrames(site);
  if (!freelyPlaced(site)) { f.style.width = f.style.height = ''; return; }
  const placed = arrangementScreens(site).filter(d => d.x != null), { w, h } = wallSize(placed.map(boxOf));
  f.style.width = w + 'px'; f.style.height = h + 'px';
}
function placeScreens(site) {
  const free = freelyPlaced(site);
  const screens = arrangementScreens(site);
  for (const d of screens) {
    if (free && d.x == null) Object.assign(d, nextFreeSpot(screens.filter(o => o.x != null).map(boxOf)));
    d.el.style.left = free ? d.x + 'px' : '';
    d.el.style.top = free ? d.y + 'px' : '';
  }
  fitWall(site);
}
function pinScreens(site) { // switch from the automatic layout to free placement, keeping every screen where it is
  const f = arrangementFrames(site), origin = f.getBoundingClientRect();
  for (const d of arrangementScreens(site)) {
    const r = d.el.getBoundingClientRect();
    d.x = Math.round(r.left - origin.left); d.y = Math.round(r.top - origin.top);
  }
  if (site) site.freePlacement = true;
  else freePlacement[currentWall()] = true;
  f.classList.add('free');
  placeScreens(site);
}
function unpinScreens(site) {
  if (site) site.freePlacement = false;
  else freePlacement[currentWall()] = false;
  const screens = site ? site.devices : pageSteps ? pageScreens : DEVICES;
  screens.forEach(d => { d.x = d.y = null; if (d.el) d.el.style.zIndex = ''; });
}
function applyArrangement() {
  for (const site of sitesMode ? sitePanels : [null]) {
    const frames = arrangementFrames(site);
    frames.classList.toggle('locked', layoutLocked);
    frames.classList.toggle('free', freelyPlaced(site));
    placeScreens(site);
  }
  const lock = $('#lock');
  lock.classList.toggle('on', layoutLocked);
  lock.querySelector('span').textContent = layoutLocked ? 'Unlock layout' : 'Lock layout';
  lock.title = layoutLocked ? 'Screens are fixed in place. Click to allow dragging.' : 'Drag a screen by its title bar to move it. Click to fix screens in place.';
}
function arrangeable(d) {
  const head = d.el.querySelector('.dev-head');
  const frames = arrangementFrames(d.site);
  head.addEventListener('pointerdown', e => {
    if (layoutLocked || mode === 'focus' || e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    if (!freelyPlaced(d.site)) pinScreens(d.site);
    drag = { d, id: e.pointerId, from: { x: e.clientX, y: e.clientY }, start: { x: d.x, y: d.y } };
    head.setPointerCapture(e.pointerId);
    d.el.style.zIndex = ++topZ; // the screen being moved stays on top of the ones it passes
    d.el.classList.add('dragging');
    frames.classList.add('arranging'); // preview pages must not catch the pointer mid-drag
  });
  head.addEventListener('pointermove', e => {
    if (drag?.d !== d || e.pointerId !== drag.id) return;
    Object.assign(d, dragTarget(drag.start, drag.from, { x: e.clientX, y: e.clientY }));
    d.el.style.left = d.x + 'px'; d.el.style.top = d.y + 'px';
    fitWall(d.site);
  });
  const end = e => {
    if (drag?.d !== d || e.pointerId !== drag.id) return;
    drag = null;
    d.el.classList.remove('dragging');
    frames.classList.remove('arranging');
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
}
$('#lock').onclick = () => { layoutLocked = !layoutLocked; applyArrangement(); };

function updateMode(m) { mode = m; document.querySelectorAll('#mode button').forEach(b => b.classList.toggle('on', b.dataset.v === m)); }
function setMode(m) { updateMode(m); relayout(); }
function setZoom(v) {
  zoom = v / 100;
  $('#zoom').value = v;
  $('#zoomv').textContent = v + '%';
  if (sitesMode) sitePanels.forEach(fitSite);
  else { active().forEach(layout); fitWall(); }
}
$('#zoom').addEventListener('input', e => setZoom(+e.target.value));
$('#mode').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.v !== 'focus') {
    if (sitesMode) sitePanels.forEach(unpinScreens);
    else if (freePlacement[currentWall()]) unpinScreens();
  }
  setMode(button.dataset.v);
  if (sitesMode) updateSiteTools();
});
$('#align').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  document.querySelectorAll('#align button').forEach(x => x.classList.toggle('on', x === b));
  $('#frames').style.alignItems = b.dataset.v;
  for (const site of sitePanels) site.frames.style.alignItems = b.dataset.v;
});
function setOrientation(landscape) {
  for (const d of workspaceScreens()) {
    const { w, h, kind } = presetFor(d);
    if (kind !== 'desktop') d.rot = landscape ? w < h : w > h;
  }
  relayout();
}
$('#land').onclick = () => setOrientation(true);
$('#port').onclick = () => setOrientation(false);
$('#rz').onclick = () => setZoom(100);
$('#toggle-sidebar').addEventListener('click', event => {
  const sidebar = $('#sidebar');
  sidebar.hidden = !sidebar.hidden;
  const label = sidebar.hidden ? 'Show sidebar' : 'Hide sidebar';
  event.currentTarget.setAttribute('aria-expanded', String(!sidebar.hidden));
  event.currentTarget.setAttribute('aria-label', label);
  event.currentTarget.title = label;
  relayout();
});
$('#alignall').onclick = () => alignScreens();
$('#play-videos').onclick = () => requestPlayback(true);
$('#pause-videos').onclick = () => requestPlayback(false);
window.addEventListener('resize', () => mode === 'focus' && relayout());
// Keep the canvas where the user left it: a device frame taking focus (dialogs, synced typing) must not scroll the wall.
const cv = $('#canvas'); let cvPos = [0, 0], cvUser = 0, cvDrag = false, cvAllow = 0;
const wallScroll = $('#wall-scroll');

function updateWallScroll() {
  const { clientWidth, scrollWidth, scrollLeft } = cv;
  const max = scrollWidth - clientWidth;
  wallScroll.disabled = max <= 0;
  wallScroll.max = Math.max(0, max);
  wallScroll.value = scrollLeft;
  wallScroll.style.setProperty('--thumb-width', (scrollWidth ? 100 * clientWidth / scrollWidth : 100) + '%');
}

function scrollFromBar() {
  cvUser = Date.now();
  cv.scrollLeft = wallScroll.valueAsNumber;
  cvPos[0] = cv.scrollLeft;
}

wallScroll.addEventListener('input', scrollFromBar);
wallScroll.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  wallScroll.valueAsNumber += event.key === 'ArrowLeft' ? -48 : 48;
  scrollFromBar();
});
const wallSizeObserver = new ResizeObserver(updateWallScroll);
wallSizeObserver.observe(cv);
wallSizeObserver.observe($('#frames'));

for (const ev of ['wheel', 'keydown', 'touchstart']) cv.addEventListener(ev, () => { cvUser = Date.now(); }, { passive: true, capture: true });
cv.addEventListener('pointerdown', () => { cvDrag = true; }, true); window.addEventListener('pointerup', () => { cvDrag = false; cvUser = Date.now(); }, true);
cv.addEventListener('scroll', () => {
  if (cvDrag || Date.now() - cvUser < 700 || Date.now() < cvAllow) cvPos = [cv.scrollLeft, cv.scrollTop];
  else { cv.scrollLeft = cvPos[0]; cv.scrollTop = cvPos[1]; }
  wallScroll.value = cv.scrollLeft;
});


/* ------------------------------ opening a page ------------------------------ */
// The same files run as the Chrome extension and as the web demo (GitHub Pages), where only the bundled sample site is available.
const IS_EXT = typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id);
const EXT = location.origin;
const DEMO_URL = new URL('./demo/index.html', location.href);
const DEMO_PATH = new URL('./demo/', location.href).pathname;
const REPO = 'https://github.com/shouvik12/samestate';
let openId = 0, openingId = 0;
let registration = Promise.resolve();
let registeredWallOrigin = null;
let registeredSites = new Map();
const originPattern = url => `${url.protocol}//${url.hostname}/*`;
// Most sites redirect between the bare and www host, so Chrome access is asked for both at once
// and the redirect is then followed without a second prompt.
function twinOrigins(url) {
  const host = url.hostname;
  const plain = /^[\d.]+$|^\[/.test(host) || !host.includes('.');
  const twin = plain ? null : host.startsWith('www.') ? host.slice(4) : host.split('.').length === 2 ? 'www.' + host : null;
  return [originPattern(url), ...(twin ? [`${url.protocol}//${twin}/*`] : [])];
}

function register(origin, site) {
  if (!IS_EXT) return Promise.resolve();
  registration = registration.catch(() => {}).then(async () => {
    const nextWall = site ? registeredWallOrigin : origin;
    const nextSites = new Map(registeredSites);
    if (site && origin) nextSites.set(site, origin);
    else if (site) nextSites.delete(site);
    const reply = await chrome.runtime.sendMessage({ type: 'register', origin: nextWall, sites: [...new Set(nextSites.values())] });
    if (!reply?.ok) throw new Error('Preview registration failed');
    registeredWallOrigin = nextWall;
    registeredSites = nextSites;
  });
  return registration;
}

function parseAddress(source, base) {
  const relative = /^(?:\/|\.{1,2}\/|[?#])/.test(source);
  if (relative && !base) return null;
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(source);
  const local = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(?=[:/?#]|$)/i.test(source);
  const address = relative || hasScheme ? source : (local ? 'http://' : 'https://') + source;
  let url;
  try { url = new URL(address, base); } catch { return null; }
  const demoPage = base && new URL(base).origin === EXT && url.origin === EXT;
  if ((!demoPage && !/^https?:$/.test(url.protocol)) || url.username || url.password) return null;
  return url;
}

async function open(url, alreadyAllowed = false) {
  const isDemo = url === DEMO_URL;
  if (!isDemo && !IS_EXT) return;
  const id = ++openId;
  openingId = id;
  $('#joblog').textContent = '';

  try {
    if (!isDemo && !alreadyAllowed) {
      $('#joblog').textContent = 'Waiting for Chrome site access…';
      const granted = await chrome.permissions.request({ origins: twinOrigins(url) });
      if (id !== openId) return;
      if (!granted) {
        $('#joblog').textContent = 'Allow access to the site in Chrome to open a preview.';
        return;
      }
    }
    await register(isDemo ? null : url.origin);
  } catch {
    if (id === openId) $('#joblog').textContent = 'Could not open the preview. Try opening the site again.';
    return;
  } finally {
    if (openingId === id) openingId = 0;
  }

  if (id !== openId) return;
  target = url.origin;
  previewUrl = url.href;
  textSalt = null;
  $('#match-text').checked = false;
  $('#page-steps-status').textContent = '';
  $('#joblog').textContent = '';
  // Keep the opened site in the address bar so it shows what is previewing, not the placeholder.
  $('#src').value = isDemo || pageSteps ? '' : url.href;
  buildFrames();
  findings = [];
  renderFindings();
  setTimeout(() => { if (id === openId) detect(true); }, 3500);
}

$('#src').addEventListener('input', () => { $('#joblog').textContent = ''; });
$('#open').addEventListener('submit', e => {
  e.preventDefault();
  const source = $('#src').value.trim();
  if (!source) return;
  const url = parseAddress(source, pageSteps && target ? previewUrl : undefined);
  if (!url) {
    $('#joblog').textContent = 'Enter an HTTP or HTTPS address without credentials.';
    return;
  }
  endTour(false);
  $('#joblog').textContent = '';
  if (pageSteps && url.origin === target) {
    openPage(url.href);
    $('#src').value = '';
    return;
  }
  if (!IS_EXT) {
    $('#joblog').textContent = 'Use the Chrome extension to open another site.';
    return;
  }
  redirects = 0;
  open(url);
});

// The site sent the preview to another origin (example.com → www.example.com). Chrome access, header
// handling and the agent are all tied to one origin, so the preview is reopened on the new one.
let redirects = 0, redirectHandled = 0, appTabId = null;
async function followRedirect(message) {
  if (openingId || message.tabId !== appTabId || !target || target === EXT || message.from !== previewUrl) return;
  if (redirectHandled === openId) return; // every device frame reports the same redirect
  const id = redirectHandled = openId;
  let url;
  try { url = new URL(message.url); } catch { return; }
  const from = new URL(target).host;
  let allowed = false;
  try { allowed = await chrome.permissions.contains({ origins: [originPattern(url)] }); } catch {}
  if (id !== openId) return;
  if (allowed && ++redirects <= 3) return open(url, true);

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

/* --------------------------- website comparison --------------------------- */
const sitePanels = [];
let sitesMode = false;
let siteLayoutMode = 'grid', wallModeBeforeSites = 'grid';

function copySiteDevice(d, site) {
  const { id, name, w, h, kind, os, frame, scale, notch, physical, slot } = d;
  return { ...previewDevice({ id, name, w, h, kind, os, frame, scale, notch, physical }, slot), site, on: true };
}

function selectedDevice(d) {
  return sitesMode ? sitePanels.some(site => site.devices.some(device => device.id === d.id && device.on)) : d.on;
}

function toggleDevice(d, selected) {
  if (!sitesMode) return selectDevice(d, selected);
  for (const site of sitePanels) {
    const preview = site.devices.find(device => device.id === d.id);
    if (preview) {
      preview.on = selected;
      if (!selected) removeFrame(preview);
    } else if (selected) site.devices.push(copySiteDevice(d, site));
    fitSite(site);
  }
  updateSiteTools();
}

function updateSiteTools() {
  if (!sitesMode) return;
  wallRevision++;
  findings = [];
  refreshDevicePicker();
  updateReference();
  renderFindings();
  $('#detect span').textContent = 'Detect differences';
  $('#match-text').disabled = !workspaceScreens().length;
  refreshThemeTargets();
  $('#frames').dispatchEvent(new Event('wall-view-changed'));
}

function fitSite(site) {
  const { clientWidth: width, clientHeight: height } = site.preview;
  if (!width || !height) return;
  const showWall = site.picker.value === 'wall';
  site.frames.hidden = !showWall;
  site.single.hidden = showWall;
  site.annotationControls.hidden = showWall || !site.url;
  if (!site.url) return;
  if (showWall) {
    site.frames.classList.toggle('row', mode === 'row');
    site.frames.classList.toggle('focus', mode === 'focus');
    site.frames.classList.toggle('locked', layoutLocked);
    site.frames.classList.toggle('free', freelyPlaced(site));
    if (!site.focusDev?.on || !site.devices.includes(site.focusDev)) site.focusDev = site.devices.find(d => d.on);
    for (const d of site.devices) {
      if (!d.on) continue;
      if (!d.el) addFrame(d);
      d.el.hidden = mode === 'focus' && site.focusDev !== d;
      layout(d);
    }
    placeScreens(site);
    return;
  }
  if (!site.frame.hasAttribute('src')) setPreviewSource(site.frame, site.url);
  const preset = dev(site.picker.value);
  const w = preset?.w ?? width;
  const h = preset?.h ?? height;
  const scale = Math.min(1, width / w, height / h);
  site.size.style.width = w * scale + 'px';
  site.size.style.height = h * scale + 'px';
  site.frame.style.width = w + 'px';
  site.frame.style.height = h + 'px';
  site.annotations.surface.style.width = w + 'px';
  site.annotations.surface.style.transform = 'scale(' + scale + ')';
  site.annotations.redraw();
}

function syncSiteScroll(site) {
  if (site.picker.value !== 'wall') return;
  const top = site.preview.scrollTop;
  if (site.syncedTop === top) { site.syncedTop = null; return; }
  for (const other of sitePanels) {
    if (other === site || other.picker.value !== 'wall') continue;
    const next = Math.min(top, other.preview.scrollHeight - other.preview.clientHeight);
    if (other.preview.scrollTop !== next) {
      other.preview.scrollTop = next;
      other.syncedTop = other.preview.scrollTop;
    }
  }
}

$('#site-columns').addEventListener('wheel', event => {
  if (event.target.closest('.site-preview') || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  const scrollable = sitePanels.filter(site => site.preview.scrollHeight > site.preview.clientHeight);
  const site = scrollable.find(item => item.el.contains(event.target)) || scrollable[0];
  if (!site) return;
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? site.preview.clientHeight : 1;
  site.preview.scrollTop += event.deltaY * unit;
}, { passive: false });

function fillSiteDevices(site) {
  const value = site.picker.value;
  site.picker.replaceChildren(new Option('All devices', 'wall'), new Option('Responsive', 'responsive'), ...deviceOptions());
  site.picker.value = value === 'responsive' || dev(value) ? value : 'wall';
  fitSite(site);
}

async function openSite(site, url, alreadyAllowed = false) {
  const bundled = url.origin === EXT && url.pathname.startsWith(DEMO_PATH);
  if (!bundled && (!IS_EXT || !/^https?:$/.test(url.protocol) || url.username || url.password)) {
    site.status.textContent = IS_EXT ? 'Enter an HTTP or HTTPS address without credentials.' : 'Use the Chrome extension to open other sites.';
    return;
  }
  const revision = ++site.revision;
  site.opening = true;
  site.status.textContent = '';
  try {
    if (!bundled && !alreadyAllowed) {
      site.status.textContent = 'Waiting for Chrome site access…';
      const granted = await chrome.permissions.request({ origins: twinOrigins(url) });
      if (revision !== site.revision) return;
      if (!granted) {
        site.status.textContent = 'Allow site access in Chrome to open this preview.';
        return;
      }
    }
    await register(bundled ? null : url.origin, site);
    if (revision !== site.revision) return;
    if (site.url && site.url.href !== url.href) {
      site.annotations.clear();
      for (const d of site.devices) d.annotations?.clear();
    }
    const sameOrigin = site.url?.origin === url.origin;
    site.url = url;
    site.redirectSource = null;
    site.input.value = bundled ? url.pathname : url.href;
    site.frame.title = 'Preview of ' + (bundled ? url.pathname : url.host);
    site.leader = null;
    site.lastAlign = null;
    for (const d of [site.singleDevice, ...site.devices]) {
      if (!sameOrigin) d.themeCss = '';
      if (!d.iframe?.hasAttribute('src')) continue;
      pendingAlign.delete(d);
      const port = d.port;
      d.port = null;
      port?.disconnect();
      d.ready = false;
      d.token = crypto.randomUUID();
      d.el.classList.remove('ready', 'leader');
      setPreviewSource(d.iframe, url);
    }
    site.status.textContent = '';
    fitSite(site);
    updateSiteTools();
  } catch {
    if (revision === site.revision) site.status.textContent = 'Could not open this preview. Try the address again.';
  } finally {
    if (revision === site.revision) site.opening = false;
  }
}

function addSite(url) {
  const el = $('#site-panel-template').content.firstElementChild.cloneNode(true);
  const site = {
    el, input: el.querySelector('.site-url'), picker: el.querySelector('.site-preset'),
    status: el.querySelector('.site-status'), preview: el.querySelector('.site-preview'),
    frames: el.querySelector('.site-frames'), single: el.querySelector('.site-single'),
    annotationControls: el.querySelector('.site-annotation-controls'),
    size: el.querySelector('.site-size'), frame: el.querySelector('iframe'),
    revision: 0, redirects: 0, themeTargetId: crypto.randomUUID()
  };
  const token = crypto.randomUUID();
  site.singleDevice = { site, el: site.single, iframe: site.frame, token, themeTargetId: token, ready: false };
  site.annotations = mountPreviewAnnotations(site.frame, site.annotationControls, site.annotationControls);
  const selected = DEVICES.filter(d => sitePanels.length ? selectedDevice(d) : d.on);
  site.devices = (selected.length || sitePanels.length ? selected : DEVICES.filter(d => d.starter)).map(d => copySiteDevice(d, site));
  site.frames.style.alignItems = $('#frames').style.alignItems;
  site.input.setAttribute('aria-label', 'Site address');
  el.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const address = parseAddress(site.input.value.trim(), site.url?.href);
    if (!address) { site.status.textContent = 'Enter a valid site address.'; return; }
    site.redirects = 0;
    openSite(site, address);
  });
  el.querySelector('.site-close').addEventListener('click', () => {
    site.revision++;
    site.observer.disconnect();
    [site.singleDevice, ...site.devices].forEach(removeFrame);
    el.remove();
    sitePanels.splice(sitePanels.indexOf(site), 1);
    register(null, site).catch(() => {});
    updateSiteTools();
    (sitePanels.at(-1)?.input || $('#add-site')).focus();
  });
  site.picker.addEventListener('change', () => { fitSite(site); updateSiteTools(); });
  site.preview.addEventListener('scroll', () => syncSiteScroll(site));
  site.observer = new ResizeObserver(() => fitSite(site));
  site.observer.observe(site.preview);
  fillSiteDevices(site);
  sitePanels.push(site);
  $('#site-columns').append(el);
  openSite(site, url, true);
  return site;
}

const initialSite = () => previewUrl ? new URL(previewUrl) : DEMO_URL;

async function followSiteRedirect(site, message) {
  if (site.opening || site.url?.href !== message.from || site.redirectSource === message.from) return;
  const url = new URL(message.url);
  const revision = site.revision;
  site.redirectSource = message.from;
  let allowed = false;
  try { allowed = await chrome.permissions.contains({ origins: [originPattern(url)] }); } catch {}
  if (revision !== site.revision) return;
  if (allowed && ++site.redirects <= 3) return openSite(site, url, true);
  site.input.value = url.href;
  site.status.textContent = 'This site redirects. Open the new address to continue.';
}

function setSitesMode(enabled) {
  if (sitesMode === enabled) return;
  if (enabled) { wallModeBeforeSites = mode; updateMode(siteLayoutMode); }
  else { siteLayoutMode = mode; updateMode(wallModeBeforeSites); }
  sitesMode = enabled;
  clearThemePreset();
  $('#sites-toggle').setAttribute('aria-pressed', String(enabled));
  $('#site-workspace').hidden = !enabled;
  $('#add-site').hidden = !enabled;
  for (const selector of ['#canvas', '#wall-scroll', '#open']) {
    $(selector).hidden = enabled;
  }
  refreshViews();
  refreshDevicePicker();
  workspaceScreens().filter(d => d.ready).forEach(configure);
  if (enabled && !sitePanels.length) { addSite(initialSite()); addSite(initialSite()); }
}

$('#sites-toggle').addEventListener('click', () => { endTour(false); setSitesMode(!sitesMode); });
$('#add-site').addEventListener('click', () => addSite(sitePanels[0]?.url || initialSite()).input.focus());

/* ------------------------------ preview themes ------------------------------ */
const themeTarget = $('#theme-target');
const themeStatus = $('#theme-status');
const themePreset = $('#theme-preset');
const customTheme = ':custom';
let themeRequest = 0;

function fillThemePresets() {
  const selection = themePreset.value;
  const presets = [...tweakcnPresets].sort((a, b) => a[1].localeCompare(b[1]));
  themePreset.replaceChildren(
    new Option('Choose a theme', ''),
    ...presets.map(([name, label]) => new Option(label, name)),
    new Option('Custom CSS…', customTheme)
  );
  themePreset.value = selection;
}

function themePreviews() {
  if (!sitesMode) return active().filter(d => mode !== 'focus' || d === focusDev);
  return sitePanels.flatMap(site => {
    if (site.picker.value === 'wall') return siteScreens(site);
    return site.frame.hasAttribute('src') ? [site.singleDevice] : [];
  });
}

function refreshThemeTargets() {
  const selection = themeTarget.value;
  const previews = themePreviews();
  themeTarget.replaceChildren(new Option('All visible previews', 'all'));
  for (const [index, site] of sitePanels.entries()) {
    if (previews.some(d => d.site === site)) {
      themeTarget.add(new Option(`Site ${index + 1} · ${site.url.origin === EXT ? 'Demo' : site.url.host}`, site.themeTargetId));
    }
  }
  for (const d of previews) {
    const name = d === d.site?.singleDevice ? d.site.picker.selectedOptions[0].textContent : screenName(d);
    const suffix = d.site ? ' · Site ' + (sitePanels.indexOf(d.site) + 1) : '';
    themeTarget.add(new Option(name + suffix, d.themeTargetId));
  }
  if (Array.from(themeTarget.options).some(option => option.value === selection)) themeTarget.value = selection;
  else clearThemePreset();
  updateThemeControls(previews.length > 0);
}

function updateThemeControls(hasPreviews = themePreviews().length > 0) {
  themePreset.disabled = $('#reset-theme').disabled = !hasPreviews;
  $('#apply-theme').disabled = !hasPreviews || !themePreset.value;
  $('#theme-custom').hidden = themePreset.value !== customTheme;
}

function clearThemePreset() {
  themeRequest++;
  themePreset.value = '';
  themeStatus.textContent = '';
  updateThemeControls();
}

async function changeTheme(reset = false) {
  const request = ++themeRequest;
  const name = themePreset.value;
  if (!reset && !name) return;
  const selection = themeTarget.value;
  const targets = themePreviews()
    .filter(d => selection === 'all' || d.themeTargetId === selection || d.site?.themeTargetId === selection)
    .map(d => ({ d, iframe: d.iframe, origin: previewOrigin(d) }));
  if (!targets.length) return;
  let css = '';
  const label = tweakcnPresets.get(name);
  if (!reset) {
    const palette = $('#theme-palette').value;
    const basicColors = $('#theme-basic').checked;
    try {
      if (name === customTheme) {
        css = buildPreviewTheme($('#theme-css').value, palette, basicColors);
      } else {
        themeStatus.textContent = `Loading ${label} from tweakcn…`;
        css = renderPreviewTheme(await loadTweakcnTheme(name), palette, basicColors);
      }
    } catch (error) {
      if (request === themeRequest) {
        themeStatus.textContent = label ? `Could not load ${label}. Click Apply theme to retry.` : error.message;
      }
      return;
    }
  }
  if (request !== themeRequest || themeTarget.value !== selection) return;
  const visible = new Set(themePreviews());
  const previews = targets.filter(({ d, iframe, origin }) => visible.has(d) && d.iframe === iframe && previewOrigin(d) === origin).map(({ d }) => d);
  if (!previews.length) { themeStatus.textContent = ''; return; }
  for (const d of previews) {
    d.themeCss = css;
    if (d.ready) configure(d);
  }
  const waiting = previews.filter(d => !d.ready).length;
  const count = previews.length === 1 ? '1 preview' : previews.length + ' previews';
  themeStatus.textContent = (reset ? 'Theme reset for ' : `${label || 'Theme'} set for `) + count + '.'
    + (!reset && waiting ? ` Waiting for ${waiting} to connect.` : '');
}

function applyNamedTheme() {
  if (themePreset.value && themePreset.value !== customTheme) changeTheme();
}

fillThemePresets();
$('#theme-drawer').addEventListener('toggle', () => {
  refreshTweakcnPresets().then(fillThemePresets).catch(() => {});
}, { once: true });
themeTarget.addEventListener('change', clearThemePreset);
themePreset.addEventListener('change', () => {
  themeRequest++;
  themeStatus.textContent = '';
  updateThemeControls();
  applyNamedTheme();
});
$('#theme-palette').addEventListener('change', applyNamedTheme);
$('#theme-basic').addEventListener('change', applyNamedTheme);
$('#apply-theme').addEventListener('click', () => changeTheme());
$('#reset-theme').addEventListener('click', () => { clearThemePreset(); changeTheme(true); });

/* -------------------------------- guided demo -------------------------------- */
// The demo plays itself. A pointer moves to each control and uses it, a ring marks that control, and a
// message sits beside it. All three are drawn on top of the page; the actions run the same code a person's
// clicks would.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dev = id => DEVICES.find(d => d.id === id);
const play = (id, m) => post(dev(id), 'demo', m);
const calmMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tourPointer = $('#tour-cursor');
const within = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// ?tour-pace=0.3 shortens the reading time and the pause after each step, for tests. Waits a step needs are unchanged.
const tourPace = within(Number(new URLSearchParams(location.search).get('tour-pace')) || 1, 0.05, 1);
let tour = 0, tourRunning = false, tourPaused = false, tourAnchor = null, tourSide = null, tourWatch = 0;
const touring = id => id === tour;

// Waits that stop when the demo is skipped and hold while it is paused. Both answer whether the demo is still on.
async function nap(id, ms) {
  for (let t = 0; t < ms || tourPaused; t += tourPaused ? 0 : 100) {
    if (!touring(id)) return false;
    await sleep(100);
  }
  return touring(id);
}
async function until(id, ready, ms = 8000) {
  for (let t = 0; touring(id) && !ready() && t < ms; t += 150) await sleep(150);
  return touring(id) && !!ready();
}

// A target is a selector or element of this page, [screen, selector] for something inside a preview, a
// rectangle, or a function that returns one of those.
const tourTarget = target => typeof target === 'function' ? target() : typeof target === 'string' ? document.querySelector(target) : target;
const inScreen = (id, selector) => () => [dev(id), selector];
function tourRect(target) {
  target = tourTarget(target);
  if (Array.isArray(target)) {
    const [d, selector] = target;
    if (!d?.iframe) return null;
    const frame = d.iframe.getBoundingClientRect();
    let el = null;
    try { el = selector && d.iframe.contentDocument?.querySelector(selector); } catch {}
    if (!el) return frame;
    const k = frame.width / d.iframe.offsetWidth, r = el.getBoundingClientRect();
    const left = Math.max(frame.left, frame.left + r.left * k), top = Math.max(frame.top, frame.top + r.top * k);
    const right = Math.min(frame.right, frame.left + r.right * k), bottom = Math.min(frame.bottom, frame.top + r.bottom * k);
    return right > left && bottom > top ? new DOMRect(left, top, right - left, bottom - top) : frame;
  }
  if (target instanceof Element) {
    const r = target.getBoundingClientRect();
    return r.width || r.height ? r : null;
  }
  return target || null;
}

// Opens the drawer a control sits in and scrolls the sidebar or the wall just far enough to show it.
async function tourReveal(id, target) {
  target = tourTarget(target);
  const el = Array.isArray(target) ? target[0]?.el : target instanceof Element ? target : null;
  if (!el) return;
  const drawer = el.closest('details.sidebar-drawer');
  if (drawer) drawer.open = true;
  if (el.closest('#sidebar')) { el.scrollIntoView({ block: 'nearest' }); return; }
  let r = cv.contains(el) && tourRect(target);
  if (!r) return;
  const view = cv.getBoundingClientRect(), pad = 30;
  const bottom = Math.min(view.bottom, innerHeight - $('#tour').offsetHeight - 40);
  const card = el.closest('.dev');
  if (card) { // show the whole screen around a control wherever the wall has room for it
    const whole = card.getBoundingClientRect();
    const wide = whole.width <= view.width - 2 * pad, tall = whole.height <= bottom - view.top - 2 * pad;
    r = new DOMRect(wide ? whole.left : r.left, tall ? whole.top : r.top, wide ? whole.width : r.width, tall ? whole.height : r.height);
  }
  const dx = r.left < view.left + pad ? r.left - view.left - pad : r.right > view.right - pad ? Math.min(r.right - view.right + pad, r.left - view.left - pad) : 0;
  const dy = r.top < view.top + pad ? r.top - view.top - pad : r.bottom > bottom - pad ? Math.min(r.bottom - bottom + pad, r.top - view.top - pad) : 0;
  if (Math.abs(dx) >= 2 || Math.abs(dy) >= 2) await scrollWall(cv.scrollLeft + dx, cv.scrollTop + dy);
}
// Scrolls the wall step by step, so it is where the demo expects by the time the pointer moves.
async function scrollWall(left, top, ms = 450) {
  const from = [cv.scrollLeft, cv.scrollTop];
  cvAllow = Date.now() + ms + 500;
  await glide(ms, t => { cv.scrollLeft = from[0] + (left - from[0]) * t; cv.scrollTop = from[1] + (top - from[1]) * t; });
  cvPos = [cv.scrollLeft, cv.scrollTop];
}

// The ring goes around the target and the message beside it, on the first side with enough room.
function tourFocus(target, side) {
  tourAnchor = target || null;
  tourSide = side || null;
  placeTour();
}
function placeTour() {
  const ring = $('#tour-ring'), box = $('#tour-callout');
  if (box.hidden) return;
  const W = innerWidth, H = innerHeight, floor = H - $('#tour').offsetHeight - 34;
  let r = tourAnchor ? tourRect(tourAnchor) : null;
  if (r && (r.right < 4 || r.left > W - 4 || r.bottom < 4 || r.top > H - 4)) r = null;
  ring.hidden = !r;
  const bw = box.offsetWidth, bh = box.offsetHeight, gap = 16;
  let side = 'none', x = (W - bw) / 2, y = floor - bh;
  if (r) {
    ring.style.transform = `translate(${Math.round(r.left - 4)}px,${Math.round(r.top - 4)}px)`;
    ring.style.width = Math.round(r.width + 8) + 'px';
    ring.style.height = Math.round(r.height + 8) + 'px';
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const beside = within(cy - bh / 2, 8, Math.max(8, floor - bh)), inline = within(cx - bw / 2, 8, Math.max(8, W - bw - 8));
    const places = {
      right: () => r.right + gap + bw <= W - 8 && [r.right + gap, beside],
      left: () => r.left - gap - bw >= 8 && [r.left - gap - bw, beside],
      below: () => r.bottom + gap + bh <= floor && [inline, r.bottom + gap],
      above: () => r.top - gap - bh >= 8 && [inline, r.top - gap - bh]
    };
    for (const name of [tourSide, 'right', 'left', 'below', 'above']) {
      const spot = name && places[name]();
      if (spot) { side = name; [x, y] = spot; break; }
    }
    const arrow = side === 'right' || side === 'left' ? within(cy - y, 16, bh - 16) : within(cx - x, 16, bw - 16);
    box.style.setProperty('--arrow', Math.round(arrow) + 'px');
  }
  box.dataset.side = side;
  box.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
}

// Runs frame(0…1) over ms. Finishes at once for reduced motion, and on a timer where animation frames do not run.
function glide(ms, frame) {
  return new Promise(done => {
    let over = false;
    const finish = () => { if (!over) { over = true; frame(1); done(); } };
    if (calmMotion.matches || ms <= 0) { finish(); return; }
    const start = performance.now();
    const tick = now => {
      if (over) return;
      const t = (now - start) / ms;
      if (t >= 1) { finish(); return; }
      frame(t * t * (3 - 2 * t));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(finish, ms + 150);
  });
}

const pointerAt = { x: 0, y: 0 };
function setPointer(x, y) {
  pointerAt.x = x; pointerAt.y = y;
  tourPointer.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
}
async function tourPoint(id, target) {
  await tourReveal(id, target);
  const resolved = tourTarget(target), r = tourRect(resolved);
  if (!r || !touring(id)) return false;
  if (tourPointer.hidden) { tourPointer.hidden = false; setPointer(innerWidth / 2, innerHeight * .6); }
  const touch = Array.isArray(resolved) && !!resolved[0].touch; // previews of touch devices show a fingertip
  if (!touch) tourPointer.classList.remove('touch');
  const from = { ...pointerAt }, to = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  await glide(within(Math.hypot(to.x - from.x, to.y - from.y) * 1.2 + 260, 380, 1050), t => setPointer(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t));
  tourPointer.classList.toggle('touch', touch);
  return touring(id);
}
async function tourClick(id, target) {
  if (!await tourPoint(id, target)) return false;
  tourPointer.classList.remove('click');
  void tourPointer.offsetWidth; // restart the ripple
  tourPointer.classList.add('click');
  return nap(id, 280);
}
async function tourScroll(t, id, section) { // the pointer rests on the preview and shows a turning wheel while it scrolls
  if (!await t.point(inScreen(id, ''))) return false;
  tourPointer.classList.add('wheel');
  tourBadge(dev(id), 'scrolling here', 'lead');
  play(id, { do: 'scroll', sel: section });
  const on = await t.nap(1300);
  tourPointer.classList.remove('wheel');
  return on;
}

// A short label on a preview saying what just happened there.
const TOUR_BADGES = {
  direct: '✓ same control', semantic: '✓ matched', revealed: '✓ opened its menu first', skip: 'already there',
  playing: '▶ playing', paused: 'paused', muted: '▶ playing muted', navigated: '✓ opened the page'
};
function tourBadge(device, text, kind = '') {
  if (!tourRunning || !device?.el || !device.body) return;
  device.body.querySelector('.tour-badge')?.remove();
  const badge = document.createElement('span');
  badge.className = 'tour-badge ' + kind;
  badge.textContent = text;
  device.body.append(badge);
  setTimeout(() => badge.remove(), 3200);
}

function setDeviceLink(d, linked) {
  if (d?.el && d.linked !== linked) d.el.querySelector('[data-a=link]').click();
}

function searchDevices(text) {
  const search = $('#device-search');
  if (search.value === text) return;
  search.value = text;
  search.dispatchEvent(new Event('input'));
}

async function tourAnnotate(t) {
  $('#panel').hidden = true;
  const phone = dev('iphone'), notes = phone.annotations;
  if (!notes) return;
  const tool = name => () => phone.el.querySelector(`.annotation-tools [data-tool=${name}]`);
  const spot = (x, y) => () => { const r = phone.iframe.getBoundingClientRect(); return new DOMRect(r.left + x * r.width, r.top + y * r.height, 0, 0); };
  if (!await t.click(() => phone.el.querySelector('.annotation-toggle'))) return;
  notes.setTool('draw');
  if (!await t.click(tool('arrow'))) return;
  notes.setTool('arrow');
  const a = { x: .24, y: .17 }, b = { x: .5, y: .36 };
  if (!await t.point(spot(a.x, a.y))) return;
  tourPointer.classList.add('down');
  const mark = notes.draw('arrow', [a, { ...a }]);
  await glide(750, k => {
    const tip = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, r = spot(tip.x, tip.y)();
    mark.points[1] = tip;
    notes.redraw();
    setPointer(r.x, r.y);
  });
  tourPointer.classList.remove('down');
  if (!await t.click(tool('note'))) return;
  notes.setTool('note');
  if (!await t.click(spot(.06, .05))) return;
  notes.note({ x: .06, y: .05 }, 'Plans table needs a sideways swipe');
}

// Drags the iPhone by its title bar to a place between the Desktop and the MacBook.
async function tourPlace(t) {
  $('#panel').hidden = true;
  setMode('row');
  if (!await t.nap(500)) return;
  pinScreens();
  const row = active().filter(d => !d.el.hidden).sort((a, b) => a.x - b.x);
  const phone = dev('iphone'), desk = dev('desktop');
  const next = row[row.indexOf(phone) + 1];
  if (!next || !row.includes(desk) || phone.x > desk.x) return;
  if (!await t.point(() => phone.el.querySelector('.dev-name'))) return;
  const frames = $('#frames'), box = phone.el.getBoundingClientRect();
  const grip = { x: pointerAt.x - box.left, y: pointerAt.y - box.top };
  tourPointer.classList.add('down');
  phone.el.classList.add('dragging');
  phone.el.style.zIndex = ++topZ;
  if (await t.nap(300)) {
    const gap = next.x - (phone.x + phone.el.offsetWidth), shift = phone.el.offsetWidth + gap;
    for (const d of row) if (d !== phone && d.x > phone.x && d.x <= desk.x) d.x -= shift;
    Object.assign(phone, { x: desk.x + desk.el.offsetWidth + gap, y: desk.y });
    frames.classList.add('tour-glide');
    placeScreens();
    scrollWall(Math.max(0, phone.x + phone.el.offsetWidth / 2 - cv.clientWidth / 2), cv.scrollTop, 900);
    await glide(1000,() => { const r = phone.el.getBoundingClientRect(); setPointer(r.left + grip.x, r.top + grip.y); });
  }
  frames.classList.remove('tour-glide');
  phone.el.classList.remove('dragging');
  tourPointer.classList.remove('down');
}

// A small tweakcn-style palette, used when the tweakcn registry cannot be reached.
const TOUR_THEME = ':root{--background:#f6e6ee;--foreground:#5b5b5b;--primary:#d04f99;--primary-foreground:#ffffff;--input:#e4c4d6;--radius:0.4rem}';
async function tourTheme() {
  themeTarget.value = 'all';
  $('#theme-palette').value = 'light';
  $('#theme-basic').checked = true;
  themePreset.value = 'bubblegum';
  updateThemeControls();
  await changeTheme();
  if (themePreviews().some(d => d.themeCss)) return;
  themePreset.value = customTheme;
  $('#theme-css').value = TOUR_THEME;
  updateThemeControls();
  await changeTheme();
}

async function tourPageSteps(t) {
  clearThemePreset();
  await changeTheme(true);
  if (!await t.click('.page-steps-option')) return;
  setPageSteps(true);
  if (!await t.until(() => pageScreens[0]?.ready) || !await t.nap(700)) return;
  t.focus(() => pageScreens[0]?.el);
  if (!await t.click(() => [pageScreens[0], '.hamburger'])) return;
  post(pageScreens[0], 'demo', { do: 'step', sel: '.hamburger' });
  if (await t.until(() => pageScreens[1]?.el)) t.focus(() => pageScreens[1]?.el);
}

async function tourStepLink(t) {
  const link = '.drawer a[href="pricing.html"]';
  if (!await t.until(() => pageScreens[1]?.ready) || !await t.nap(1000)) return; // step 2 replays the menu click after it connects
  if (!await t.click(() => [pageScreens[1], link])) return;
  post(pageScreens[1], 'demo', { do: 'step', sel: link });
  if (await t.until(() => pageScreens[2]?.el)) t.focus(() => pageScreens[2]?.el);
}

function tourCompare() {
  setPageSteps(false);
  setSitesMode(true);
  while (sitePanels.length < 2) addSite(DEMO_URL);
  if (sitePanels[0].url?.href !== DEMO_URL.href) openSite(sitePanels[0], DEMO_URL, true);
  openSite(sitePanels[1], new URL('pricing.html', DEMO_URL), true);
}

// One step: `at` is what the ring and the message attach to, `run` moves the pointer and does the work.
const demoClick = (id, sel) => async t => { if (await t.click(inScreen(id, sel))) play(id, { do: 'click', sel }); };
const demoLink = (id, sel) => async t => { if (await t.click(inScreen(id, sel))) play(id, { do: 'link', sel }); };
const STEPS = [
  {
    title: 'Click sync', at: inScreen('desktop', '.dd-btn'), wait: 4400,
    text: 'The Desktop clicks <b>Products</b>. Phones and tablets have no nav bar, so each one opens its own menu first, then Products.',
    run: demoClick('desktop', '.dd-btn')
  },
  {
    title: 'Same state, different layout', at: inScreen('desktop', '.signin.desk-only'), side: 'left', wait: 4000,
    text: '<b>Sign in</b> sits in the bar on desktops and inside the menu on phones. One click opens the same dialog everywhere.',
    run: demoClick('desktop', '.signin.desk-only')
  },
  {
    title: 'Any screen can lead', at: inScreen('iphone', '#signin .close'), wait: 3400,
    text: 'The iPhone closes the dialog this time. Touch screens show a fingertip circle as the pointer, desktops a white arrow.',
    run: demoClick('iphone', '#signin .close')
  },
  {
    title: 'Twin controls', at: inScreen('iphone', '.mob-only .mode-toggle'), wait: 4200,
    text: 'This site draws its <b>dark mode</b> button twice, once for phones and once for desktops. Samestate pairs the two by their attributes, so the desktops follow.',
    run: demoClick('iphone', '.mob-only .mode-toggle')
  },
  {
    title: 'Works both ways', at: inScreen('desktop', '.desk-only .mode-toggle'), side: 'left', wait: 3200,
    text: 'The Desktop switches dark mode off again, and every phone and tablet follows.',
    run: demoClick('desktop', '.desk-only .mode-toggle')
  },
  {
    title: 'Device identity', at: '#device-identity', wait: 3200,
    text: '<b>Phone and tablet identity</b> in Views makes phones and tablets tell the page what they are. This site then shows its app banner to phones only. It is off by default, since some sites then show phones a different page.',
    run: async t => {
      if (!await t.click('#device-identity')) return;
      if (!emulateDevices) setDeviceIdentity(true, false); // for this step only; the user's setting comes back at the end
      if (!await t.nap(2500) || !await t.until(() => active().every(d => d.ready))) return;
      t.focus(inScreen('iphone', '#app-banner'));
      if (await t.point(inScreen('iphone', '#app-banner .app-open'))) await t.point(inScreen('pixel', '#app-banner'));
    }
  },
  {
    title: 'Scroll sync', at: inScreen('desktop', ''), wait: 2800,
    text: 'Scrolling the Desktop to <b>Compare plans</b>. Screens stop at the same section even though their pages are different lengths.',
    run: t => tourScroll(t, 'desktop', '#plans')
  },
  {
    title: 'Difference report', at: '#detect', wait: 3600,
    text: '<b>Detect differences</b> measures every screen against the Desktop and lists each problem once, with the screens it affects. Clicking one outlines it on all of them, here the table that is too wide for the phones.',
    run: async t => {
      if (!await t.click('#detect')) return;
      reportView = 'issue'; // the tour shows the grouped report, without changing the saved choice
      await detect();
      if (!t.ok()) return;
      t.focus('#panel', 'left');
      const finding = () => Array.from(document.querySelectorAll('#findings .finding')).find(el => el.querySelector('.t')?.textContent.startsWith('Table is wider'));
      if (!await t.nap(1600) || !finding() || !await t.click(finding)) return;
      finding()?.click();
    }
  },
  {
    title: 'Annotations', at: () => dev('iphone').el, wait: 3000,
    text: 'The <b>✎</b> button on a preview opens drawing tools: freehand, lines, arrows and notes. Marks stay on their own preview and appear in screenshots.',
    run: tourAnnotate
  },
  {
    title: 'Video playback', at: '#play-videos', wait: 4200,
    text: '<b>Play all</b> starts the main video on every screen at once. The Sync log lists the result for each one.',
    run: async t => {
      dev('iphone').annotations?.clear();
      if (!await tourScroll(t, 'desktop', '#tour-video') || !await t.click('#play-videos')) return;
      requestPlayback(true);
      showTab('log');
    }
  },
  {
    title: 'Unlink a screen', at: () => dev('iphone').el?.querySelector('[data-a=link]'), wait: 3000,
    text: 'The chain icon unlinks a screen. The Desktop scrolls to <b>Customer stories</b> and the unlinked iPhone stays where it was.',
    run: async t => {
      requestPlayback(false);
      $('#panel').hidden = true;
      if (!await t.click(() => dev('iphone').el.querySelector('[data-a=link]'))) return;
      setDeviceLink(dev('iphone'), false);
      if (!await t.nap(500)) return;
      t.focus(() => dev('iphone').el);
      tourBadge(dev('iphone'), 'unlinked: stays put', 'miss');
      await tourScroll(t, 'desktop', '#stories');
    }
  },
  {
    title: 'Align screens', at: '#alignall', wait: 3600,
    text: 'After linking the iPhone again, <b>Align screens</b> brings every linked screen to the page and position of the one used last.',
    run: async t => {
      if (!await t.click(() => dev('iphone').el.querySelector('[data-a=link]'))) return;
      setDeviceLink(dev('iphone'), true);
      if (!await t.click('#alignall')) return;
      alignScreens();
      tourBadge(dev('iphone'), 'aligned', '');
    }
  },
  {
    title: 'Follow links', at: inScreen('desktop', '.desk > a[href="pricing.html"]'), wait: 4200,
    text: 'Following a link on one screen opens the same page on all of them. The Desktop clicks <b>Pricing</b> in its bar, and every phone and tablet opens the pricing page too.',
    run: async t => { $('#panel').hidden = true; await demoLink('desktop', '.desk > a[href="pricing.html"]')(t); }
  },
  {
    title: 'Back from any screen', at: inScreen('iphone', '.cta a[href="index.html"]'), wait: 4000,
    text: 'The iPhone follows <b>Back to overview</b>, and the other screens go back with it. <b>Links & pages</b> in the Sync drawer turns this off.',
    run: demoLink('iphone', '.cta a[href="index.html"]')
  },
  {
    title: 'Free placement', at: () => dev('iphone').el, wait: 3200,
    text: 'Drag a screen by its title bar to put it anywhere, here the iPhone between the Desktop and the MacBook. The bar under the wall scrolls sideways.',
    run: tourPlace
  },
  {
    title: 'Preview scale', at: () => dev('iphone').el?.querySelector('[data-a=scale]'), wait: 4000,
    text: 'Click a preview’s percentage to set its own scale, here 100% of its CSS pixels. <b>Physical size</b> in the same dialog matches a real phone on your monitor.',
    run: async t => {
      if (!await t.click(() => dev('iphone').el.querySelector('[data-a=scale]'))) return;
      dev('iphone').scaleOverride = 1;
      relayout();
    }
  },
  {
    title: 'Back to the grid', at: '#mode', wait: 3000,
    text: '<b>Grid</b> returns every screen to the automatic layout. <b>Lock layout</b>, lower in this drawer, keeps an arrangement in place.',
    run: async t => {
      if (!await t.click('#mode [data-v=grid]')) return;
      dev('iphone').scaleOverride = null;
      $('#mode [data-v=grid]').click();
      await scrollWall(0, 0);
    }
  },
  {
    title: 'Device catalog', at: '#device-search', wait: 4000,
    text: 'The <b>Devices</b> drawer holds 83 presets. Search by name or size, here “fold” for the foldables, or add a custom device of your own.',
    run: async t => {
      if (!await t.click('#device-search')) return;
      for (const text of ['f', 'fo', 'fol', 'fold']) {
        searchDevices(text);
        if (!await t.nap(140)) return;
      }
    }
  },
  {
    title: 'Themes', at: '#theme-preset', wait: 4600,
    text: 'Pick a <b>tweakcn</b> preset and it is applied to the previews, here Bubblegum. A theme can go on every preview, one preview, or one comparison column.',
    run: async t => {
      searchDevices('');
      if (!await t.click('#theme-preset')) return;
      await tourTheme();
    }
  },
  {
    title: 'Page steps', at: '.page-steps-option', wait: 3600,
    text: '<b>Page steps</b> lays a journey out side by side at one device size. Opening the menu in Step 1 adds Step 2 with the menu open.',
    run: tourPageSteps
  },
  {
    title: 'Follow a link', at: () => pageScreens[1]?.el, wait: 4000,
    text: 'Following <b>Pricing</b> in Step 2 adds Step 3. Earlier steps keep their own state, and each step can be dragged, rescaled or closed.',
    run: tourStepLink
  },
  {
    title: 'Compare sites', at: '#sites-toggle', side: 'below', wait: 5200,
    text: '<b>Compare sites</b> puts whole device walls side by side, each with its own address bar. Here the overview is next to the pricing page, with linked scrolling.',
    run: async t => {
      if (!await t.click('#sites-toggle')) return;
      tourCompare();
      if (await t.nap(900)) t.focus(() => sitePanels[1]?.el.querySelector('.site-address'), 'below');
    }
  },
  {
    title: 'Screenshot and Record', at: '.capture-actions', wait: 2600,
    text: '<b>Screenshot</b> saves what is on the wall as a PNG, and <b>Record</b> as a silent video. Both include comparison columns and annotations.',
    run: async t => { if (await t.point('#screenshot') && await t.nap(1100)) await t.point('#record'); }
  },
  {
    title: 'That is the tour', wait: 0,
    text: IS_EXT ? 'Keep exploring the sample site, or type your own address in the bar at the top.' : 'Click around the screens yourself, or install the Chrome extension to open any page.',
    run: () => {
      setSitesMode(false);
      restoreDeviceIdentity();
      scrollWall(0, 0);
      tourPointer.hidden = true;
      $('#tourpause').hidden = true;
      $('#skip').textContent = IS_EXT ? 'Use my own site' : 'Close';
    }
  }
];

function showStep(i) {
  const step = STEPS[i];
  $('#tourcount').textContent = (i + 1) + ' / ' + STEPS.length;
  $('#tourname').textContent = $('#tourtitle').textContent = step.title;
  $('#tourtext').innerHTML = step.text;
  document.querySelectorAll('#tourdots i').forEach((dot, k) => { dot.classList.toggle('on', k < i); dot.classList.toggle('now', k === i); });
}

function setTourPaused(paused) {
  tourPaused = paused;
  const button = $('#tourpause');
  button.textContent = paused ? 'Resume' : 'Pause';
  button.setAttribute('aria-pressed', String(paused));
  $('#tour').classList.toggle('paused', paused);
}

async function startTour() {
  setSitesMode(false);
  setPageSteps(false);
  sameDevice = false;
  layoutLocked = false;
  clearThemePreset();
  searchDevices('');
  if ($('#sidebar').hidden) $('#toggle-sidebar').click();
  unpinScreens();
  DEVICES.forEach(d => Object.assign(d, { on: !!d.starter, rot: false, linked: true, scaleOverride: null, physicalScale: null }));
  refreshViews();
  const id = ++tour;
  tourRunning = true;
  setTourPaused(false);
  tourPointer.hidden = true;
  tourPointer.className = 'tour-cursor';
  $('#tour').hidden = $('#tour-callout').hidden = $('#tourpause').hidden = false;
  $('#skip').textContent = 'Skip demo';
  $('#tourcount').textContent = '';
  $('#tourname').textContent = $('#tourtitle').textContent = 'Guided demo';
  $('#tourtext').textContent = 'Loading the sample site on every screen…';
  $('#tourdots').innerHTML = STEPS.map(() => '<i></i>').join('');
  tourFocus(null);
  clearInterval(tourWatch);
  tourWatch = setInterval(placeTour, 120); // the wall scrolls and screens move, so the ring and the message keep up
  renderLeft(); setMode('grid'); $('#panel').hidden = true;
  $('#src').value = ''; await open(DEMO_URL);
  await until(id, () => target && active().length && active().every(d => d.ready), 15000);
  if (!await nap(id, 1200)) return;
  const t = {
    ok: () => touring(id), nap: ms => nap(id, ms), until: (ready, ms) => until(id, ready, ms),
    point: target => tourPoint(id, target), click: target => tourClick(id, target), focus: tourFocus
  };
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    await tourReveal(id, step.at);
    if (!touring(id)) return;
    showStep(i);
    tourFocus(step.at, step.side);
    // Time to read the message before the pointer moves.
    if (!await nap(id, Math.min(3000, 900 + step.text.split(' ').length * 70) * tourPace)) return;
    await step.run?.(t);
    if (!await nap(id, step.wait * tourPace)) return;
    document.dispatchEvent(new CustomEvent('samestate-tour-step', { detail: { step: i + 1, title: step.title } })); // read by tests/smoke.mjs
  }
  tourFocus(null);
  tourRunning = false;
}
function endTour(clear) {
  if (tourRunning) restoreDeviceIdentity(); // skipped part-way, possibly after the identity step
  tour++;
  tourRunning = false;
  setTourPaused(false);
  clearInterval(tourWatch);
  tourAnchor = null;
  $('#tour').hidden = $('#tour-callout').hidden = $('#tour-ring').hidden = tourPointer.hidden = true;
  $('#frames').classList.remove('tour-glide');
  document.querySelectorAll('.tour-badge').forEach(badge => badge.remove());
  if (clear) { openId++; target = previewUrl = textSalt = null; $('#match-text').checked = false; buildFrames(); $('#panel').hidden = true; $('#joblog').textContent = ''; $('#src').value = ''; $('#src').focus(); findings = []; renderFindings(); $('#findings').innerHTML = '<p class="muted">Open a site, then press <b>Detect differences</b>.</p>'; }
}
$('#tourpause').onclick = () => setTourPaused(!tourPaused);
$('#skip').onclick = () => endTour(IS_EXT); // on the web demo the sample site stays open to play with
$('#demo').onclick = $('#watch').onclick = startTour;
$('#own').onclick = () => { if (IS_EXT) $('#src').focus(); else window.open(REPO + '#install', '_blank', 'noopener'); };
$('#reload').onclick = () => workspaceScreens().forEach(device => post(device, 'reload'));
$('#match-text').onchange = event => {
  textSalt = event.target.checked ? crypto.randomUUID() : null;
  workspaceScreens().filter(device => device.ready).forEach(configure);
  detect(true);
};

/* ------------------------------ message routing ------------------------------ */
const pendingSnap = new Map(), entries = new Map();
function configure(device) {
  const inspect = device !== device.site?.singleDevice;
  post(device, 'config', {
    touch: device.touch, inspect, textSalt: inspect ? textSalt : null,
    pageSteps: pageSteps && !!device.step, themeCss: device.themeCss || ''
  });
}
const reportName = device => device.site ? screenName(device) + ' · ' + device.site.url.host : screenName(device);

function handleMessage(device, message) {
  if (!message?.__samestate) return;
  if (device === device.site?.singleDevice && message.type !== 'hello') return;
  switch (message.type) {
    case 'hello': {
      device.ready = true;
      device.el.classList.add('ready');
      configure(device);
      if (device.identity !== undefined) post(device, 'identity', { name: device.identity }); // in case it changed while loading
      if (device.replayPending) {
        device.replayPending = false;
        post(device, 'replay-step', { actions: device.actions });
      }
      if (workspaceScreens().includes(device) && !(device.site ? device.site.leader?.ready : leader?.ready)) setLeader(device);
      const align = pendingAlign.get(device);
      pendingAlign.delete(device);
      // The screen was sent to the leading screen's page; now that it has loaded, match the scroll position.
      if (align) setTimeout(() => { if (device.ready) post(device, 'align', { ...align, navigate: false }); }, 700);
      break;
    }
    case 'state':
      pendingState.get(message.rid)?.(message);
      break;
    case 'aligning': { // the screen is loading the leading screen's page; finish when it says hello again
      const align = device.site ? device.site.lastAlign : lastAlign;
      if (align) pendingAlign.set(device, align);
      break;
    }
    case 'active':
      if (workspaceScreens().includes(device)) setLeader(device);
      break;
    case 'open-page':
      if (pageSteps && device.step && active().includes(device) && typeof message.url === 'string') openPage(message.url);
      break;
    case 'open-state':
      if (pageSteps && device.step && active().includes(device) && typeof message.url === 'string' && typeof message.action?.path === 'string') {
        openPage(message.url, device, message.action);
      }
      break;
    case 'step-incomplete':
      if (device.step && Number.isInteger(message.applied) && message.applied >= 0 && message.applied < device.actions.length) {
        device.actions.length = message.applied;
        if (pageSteps) $('#page-steps-status').textContent = `Step ${device.step} opened. Continue the interaction there.`;
      }
      break;
    case 'snapshot':
      pendingSnap.get(message.rid)?.(device, message.data);
      break;
    case 'result':
      addResult(message, device);
      playbackResult(message, device);
      break;
    case 'act': {
      if ((!device.site && pageSteps) || !workspaceScreens().includes(device)) return;
      if (!Object.hasOwn(KIND_SYNC, message.kind) || !SYNC[KIND_SYNC[message.kind]][1]) return;
      setLeader(device);
      if (!device.linked) return; // an unlinked screen moves on its own
      const id = ['click', 'swipe', 'media', 'navigate'].includes(message.kind) ? ++aid : 0;
      if (id) startEntry(id, device, message);
      const { type, __samestate, ...action } = message;
      for (const other of device.site ? siteScreens(device.site) : active()) {
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
  if (sitesMode) return Promise.all(sitePanels.map(site => alignSiteScreens(siteScreens(site), site.leader, site)));
  return alignSiteScreens(active(), leader);
}
async function alignSiteScreens(screens, current, site) {
  const lead = current?.ready && screens.includes(current) ? current : screens.find(d => d.ready);
  if (!lead) return;
  const rid = crypto.randomUUID(), revision = wallRevision;
  const state = await new Promise(done => {
    pendingState.set(rid, done);
    post(lead, 'state', { rid });
    setTimeout(() => done(null), 1500);
  });
  pendingState.delete(rid);
  if (!state || revision !== wallRevision || typeof state.url !== 'string') return;
  const align = { url: state.url, scroll: state.scroll };
  if (site) site.lastAlign = align;
  else lastAlign = align;
  for (const other of alignTargets(screens, lead)) {
    pendingAlign.delete(other);
    post(other, 'align', { ...align, navigate: true });
  }
}

function setLeader(device) {
  if (device?.site) {
    const site = device.site;
    if (site.leader === device) return;
    site.leader = device;
    for (const d of site.devices) d.el?.classList.toggle('leader', d === device);
    return;
  }
  if (leader === device) return;
  leader = device;
  allScreens().forEach(d => d.el?.classList.toggle('leader', d === device));
}

window.addEventListener('message', event => {
  const device = connectedScreens().find(d => d.iframe?.contentWindow === event.source);
  if (!device || event.origin !== previewOrigin(device)) return;
  if (event.origin === EXT) handleMessage(device, event.data);
  else if (event.data?.__samestateReady === true) {
    device.iframe.contentWindow.postMessage({ type: 'connect', token: device.token }, event.origin);
  }
});

if (IS_EXT) {
  const appTab = chrome.tabs.getCurrent();
  appTab.then(tab => { appTabId = tab?.id ?? null; });
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== 'redirected' || sender.id !== chrome.runtime.id || sender.tab || message.tabId !== appTabId) return;
    followRedirect(message);
    for (const site of sitePanels) followSiteRedirect(site, message).catch(() => {});
  });
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== 'samestate-preview' || !port.sender?.frameId) return;
    async function identify(message) {
      port.onMessage.removeListener(identify);
      const tab = await appTab;
      const device = connectedScreens().find(d => d.el && d.token === message.token);
      if (!device || tab?.id !== port.sender.tab?.id || port.sender.origin !== previewOrigin(device)) {
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
function requestPlayback(playing) {
  const devices = workspaceScreens().filter(d => d.ready);
  if (!devices.length) {
    $('#video-status').textContent = 'Open a video page and wait for the previews to connect.';
    return;
  }

  const id = ++aid;
  const request = { id, playing, remaining: new Set(devices), total: devices.length, applied: 0, muted: 0 };
  videoRequest = request;
  startEntry(id, null, { kind: 'media', playing });
  $('#video-status').textContent = playing ? 'Starting videos…' : 'Pausing videos…';
  for (const device of devices) {
    try {
      post(device, 'act', { kind: 'media', playing, aid: id });
    } catch {
      const result = { aid: id, status: 'unavailable' };
      addResult(result, device);
      playbackResult(result, device);
    }
  }
}

function playbackResult(message, device) {
  const request = videoRequest;
  if (!request || message.aid !== request.id || !request.remaining.delete(device)) return;
  if (['playing', 'paused', 'muted'].includes(message.status)) request.applied++;
  if (message.status === 'muted') request.muted++;
  const verb = request.playing ? 'Playing' : 'Paused';
  const muted = request.muted ? ` · ${request.muted} muted` : '';
  const pending = request.remaining.size;
  const detail = pending ? ` · ${pending} pending` : request.applied < request.total ? ' · See Sync log' : '';
  $('#video-status').textContent = `${verb} on ${request.applied}/${request.total}${muted}${detail}`;
}

// The page part of an address, for the Sync log: /pricing, /docs?page=2#setup
function pageLabel(address) {
  try { const url = new URL(address); return (url.pathname + url.search + url.hash) || '/'; } catch { return 'a page'; }
}

function startEntry(id, device, message) {
  const box = $('#log');
  box.querySelector('.muted')?.remove();
  const entry = document.createElement('div');
  entry.className = 'entry';
  const heading = document.createElement('div');
  heading.className = 'h';
  const name = message.d?.demoControl || message.d?.kind || 'control';
  if (message.kind === 'media') {
    const action = message.playing ? 'play video' : 'pause video';
    heading.textContent = device ? reportName(device) + ' · ' + action : (message.playing ? 'Play all videos' : 'Pause all videos');
  } else if (message.kind === 'navigate') {
    heading.textContent = reportName(device) + ' · open ' + pageLabel(message.url);
  } else {
    heading.textContent = message.kind === 'swipe' ? reportName(device) + ' · swipe' : reportName(device) + ' · click ' + name;
  }
  entry.appendChild(heading);
  if (device && message.kind === 'click') tourBadge(device, device.touch ? 'tapped here' : 'clicked here', 'lead');
  if (device && message.kind === 'navigate') tourBadge(device, 'followed a link', 'lead');
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
  const labels = {
    direct: 'same', semantic: 'matched', revealed: 'revealed', skip: 'skipped', none: 'no match', hidden: 'unreachable',
    navigated: 'opened', playing: 'playing', paused: 'paused', muted: 'playing muted', blocked: 'blocked by Chrome', 'no-video': 'no video', unavailable: 'unavailable'
  };
  if (!entry || !Object.hasOwn(labels, message.status)) return;
  tourBadge(device, TOUR_BADGES[message.status] || labels[message.status], Object.hasOwn(TOUR_BADGES, message.status) ? '' : 'miss');
  const row = document.createElement('div');
  row.className = 'r';
  const name = document.createElement('b');
  name.textContent = reportName(device);
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
  if (!ref) return [];
  const out = [], referenceKeys = new Map();
  // kind names the check, the same on every device, so the report can group one problem across screens.
  function add(sev, cat, dev, kind, title, detail, keys = [], refKeys = keys.map(key => referenceKeys.get(key)).filter(Boolean)) {
    out.push({ sev, cat, dev, kind, title, detail, keys, refKeys, reference: ref.dev });
  }
  const R = index(ref.data);
  for (const { dev, data } of snaps) {
    referenceKeys.clear();
    const I = index(data), vis = [...I.values()].filter(i => i.visible), n = screenName(dev);
    // ---- per-device checks
    if (data.docW > data.vw + 2) add('issue', 'Layout', dev, 'Page scrolls sideways', `Page scrolls sideways (+${data.docW - data.vw}px)`, data.overflow.length ? 'Pushed out by ' + data.overflow.map(o => q(o.name) + ' +' + o.by + 'px').join(', ') : 'Content is wider than the viewport.', data.overflow.map(o => o.key));
    if (dev.touch && !data.metaViewport) add('issue', 'Usability', dev, 'No viewport meta tag', 'No viewport meta tag', 'The page renders at desktop width and gets shrunk on phones.');
    const broken = vis.filter(i => i.cat === 'image' && i.broken); if (broken.length) add('issue', 'Images', dev, 'Broken images', `${broken.length} broken image${broken.length > 1 ? 's' : ''}`, list(broken.map(i => i.name)), broken.map(i => i.key));
    const blurry = vis.filter(i => i.cat === 'image' && i.natW && i.w > i.natW * 1.25); if (blurry.length) add('warn', 'Images', dev, 'Images stretched beyond source size', `${blurry.length} image${blurry.length > 1 ? 's' : ''} stretched beyond source size`, blurry.slice(0, 3).map(i => `${q(i.name)} ${i.natW}px shown at ${i.w}px`).join(', '), blurry.map(i => i.key));
    const trunc = vis.filter(i => i.truncated); if (trunc.length) add('warn', 'Content', dev, 'Text cut off', `${trunc.length} text element${trunc.length > 1 ? 's' : ''} cut off`, list(trunc.map(i => i.name)), trunc.map(i => i.key));
    const tiny = vis.filter(i => (i.cat === 'text' || i.cat === 'heading' || i.cat === 'link') && i.size < 12); if (tiny.length) add('warn', 'Typography', dev, 'Text under 12px', `${tiny.length} text element${tiny.length > 1 ? 's' : ''} under 12px`, list(tiny.map(i => `${i.name} (${i.size}px)`)), tiny.map(i => i.key));
    const edge = vis.filter(i => (i.cat === 'text' || i.cat === 'heading') && i.w > 60 && (i.x < 6 || i.x + i.w > data.vw - 6) && i.x + i.w <= data.vw + 2); if (edge.length) add('warn', 'Layout', dev, 'Text touches the screen edge', `${edge.length} text block${edge.length > 1 ? 's' : ''} touch the screen edge`, list(edge.map(i => i.name)), edge.map(i => i.key));
    const hiding = data.fixed.filter(f => f.hides && f.hides.length);
    for (const f of hiding) add('issue', 'Usability', dev, 'Overlay hides controls', `Overlay hides ${f.hides.length} control${f.hides.length > 1 ? 's' : ''}`, `${q(f.name || 'fixed element')} sits on top of ${list(f.hides, 4)}`, [f.key]);
    for (const f of data.fixed) if (!f.hides && !hiding.some(h => h.name === f.name)) add('warn', 'Usability', dev, 'Fixed element covers the screen', `Fixed element covers ${f.cover}% of the screen`, q(f.name || 'element'), [f.key]);
    for (const t of vis.filter(i => i.cat === 'table')) {
      if (t.wide && !t.scrollable) add('issue', 'Tables', dev, 'Table is wider than its container', 'Table is wider than its container', `${q(t.name)} overflows with no scroll wrapper.`, [t.key]);
      else if (t.wide) add('info', 'Tables', dev, 'Table needs sideways scrolling', dev.touch ? 'Table needs a sideways swipe' : 'Table needs horizontal scrolling', `${q(t.name)}: ${t.cols} columns in a scroll area.`, [t.key]);
    }
    if (dev.touch) {
      const taps = vis.filter(i => (i.cat === 'link' || i.cat === 'button' || i.cat === 'input') && !i.inline);
      const bad = taps.filter(i => Math.min(i.w, i.h) < 24), small = taps.filter(i => Math.min(i.w, i.h) >= 24 && Math.min(i.w, i.h) < 40);
      if (bad.length) add('issue', 'Input', dev, 'Tap targets under 24px', `${bad.length} tap target${bad.length > 1 ? 's' : ''} under 24px`, list(bad.map(i => `${i.name} (${i.w}×${i.h})`)), bad.map(i => i.key));
      if (small.length) add('warn', 'Input', dev, 'Tap targets under 40px', `${small.length} tap target${small.length > 1 ? 's' : ''} under 40px`, list(small.map(i => `${i.name} (${i.w}×${i.h})`)), small.map(i => i.key));
      const zoomy = vis.filter(i => i.cat === 'input' && /field/.test(i.kind || '') && i.size < 16); if (zoomy.length && dev.os === 'ios' && dev.kind === 'phone') add('info', 'Input', dev, 'Fields under 16px font', `${zoomy.length} field${zoomy.length > 1 ? 's' : ''} under 16px font`, 'iOS Safari zooms the page when these are focused.', zoomy.map(i => i.key));
      const sw = data.scrollers.filter(s => !s.table); if (sw.length) add('info', 'Input', dev, 'Swipeable areas', `${sw.length} swipeable area${sw.length > 1 ? 's' : ''}`, 'Scrolls sideways by swipe' + (sw.some(s => s.snap) ? ' with snap points.' : '.'), sw.map(s => s.key));
    } else {
      const sw = data.scrollers.filter(s => !s.table); if (sw.length) add('info', 'Input', dev, 'Sideways scroll areas', `${sw.length} sideways scroll area${sw.length > 1 ? 's' : ''}`, 'Mouse users need a scrollbar, shift-wheel or arrow buttons here.', sw.map(s => s.key));
    }
    if (dev === ref.dev) continue;
    // ---- compared with the reference device
    const rn = screenName(ref.dev);
    const matches = matchItems(R, I);
    for (const [referenceItem, item] of matches) referenceKeys.set(item.key, referenceItem.key);
    const both = [...matches].filter(([r, i]) => r.visible && i.visible);
    const matchedVisible = new Set(both.map(([, item]) => item));
    const gone = [...R.values()].filter(item => item.visible && !matches.get(item)?.visible);
    const extra = vis.filter(item => !matchedVisible.has(item));
    const navGone = gone.filter(i => i.inNav && (i.cat === 'link' || i.cat === 'button'));
    if (navGone.length) {
      if (data.menuToggle) add('info', 'Navigation', dev, 'Navigation collapses behind a menu button', `Navigation collapses behind a menu button`, `${navGone.length} item${navGone.length > 1 ? 's' : ''} visible on ${rn} move into the menu: ${list(navGone.map(i => i.name), 4)}`, [], navGone.map(i => i.key));
      else add('issue', 'Navigation', dev, 'Navigation items disappear with no menu button', `${navGone.length} navigation item${navGone.length > 1 ? 's' : ''} disappear with no menu button`, list(navGone.map(i => i.name), 4), [], navGone.map(i => i.key));
    }
    const ctlGone = gone.filter(i => !i.inNav && (i.cat === 'link' || i.cat === 'button' || i.cat === 'input'));
    if (ctlGone.length) add('warn', 'Navigation', dev, `Controls from ${rn} not visible`, `${ctlGone.length} control${ctlGone.length > 1 ? 's' : ''} from ${rn} not visible`, list(ctlGone.map(i => i.name), 4), [], ctlGone.map(i => i.key));
    const txtGone = gone.filter(i => i.cat === 'heading' || i.cat === 'text');
    if (txtGone.length) add('warn', 'Content', dev, `Text from ${rn} hidden`, `${txtGone.length} text block${txtGone.length > 1 ? 's' : ''} from ${rn} hidden`, list(txtGone.map(i => i.name)), [], txtGone.map(i => i.key));
    const imgGone = gone.filter(i => i.cat === 'image');
    if (imgGone.length) add('warn', 'Images', dev, `Images from ${rn} hidden`, `${imgGone.length} image${imgGone.length > 1 ? 's' : ''} from ${rn} hidden`, list(imgGone.map(i => i.name)), [], imgGone.map(i => i.key));
    const tblGone = gone.filter(i => i.cat === 'table');
    if (tblGone.length) add('info', 'Tables', dev, 'Table replaced by another layout', `Table replaced by another layout`, `${q(tblGone[0].name)} is shown as a table on ${rn} but not here.`, [], tblGone.map(i => i.key));
    const xs = extra.filter(i => i.cat !== 'nav');
    if (xs.length) add('info', 'Content', dev, `Elements not on ${rn}`, `${xs.length} element${xs.length > 1 ? 's' : ''} only on ${n}`, list(xs.map(i => i.name || i.cat), 4), xs.map(i => i.key));

    const differentText = both.filter(([r, i]) => r.textKey && i.textKey && r.textKey !== i.textKey);
    if (differentText.length) {
      const detail = differentText.length === 1 ? '1 matched element has different text.' : differentText.length + ' matched elements have different text.';
      add('info', 'Content', dev, 'Visible text differs from ' + rn, 'Visible text differs from ' + rn, detail, differentText.map(([, item]) => item.key));
    }
    const sized = both.filter(([r, i]) => (r.cat === 'heading' || r.cat === 'text') && Math.abs(r.size - i.size) >= 1);
    if (sized.length) { const heads = sized.filter(p => p[0].cat === 'heading').sort((a, b) => a[0].level - b[0].level); const pick = (heads.length ? heads : sized).slice(0, 3); add('info', 'Typography', dev, 'Type scale adapts', `Type scale adapts on ${sized.length} element${sized.length > 1 ? 's' : ''}`, pick.map(([r, i]) => `${q(r.name)} ${r.size}→${i.size}px`).join(', '), sized.map(p => p[1].key)); }
    const crop = both.filter(([r, i]) => r.cat === 'image' && r.h && i.h && Math.abs(r.w / r.h - i.w / i.h) / (r.w / r.h) > .08);
    if (crop.length) add('info', 'Images', dev, 'Images change shape', `${crop.length} image${crop.length > 1 ? 's' : ''} change shape`, crop.slice(0, 2).map(([r, i]) => `${q(r.name)} ${r.w}×${r.h} → ${i.w}×${i.h}`).join(', '), crop.map(p => p[1].key));
    const tcols = both.filter(([r, i]) => r.cat === 'table' && (r.cols !== i.cols || r.display !== i.display));
    for (const [r, i] of tcols) add('info', 'Tables', dev, r.display !== i.display ? 'Table restructured' : 'Table columns hidden', r.display !== i.display ? 'Table restructured' : `Table shows ${i.cols} of ${r.cols} columns`, `${q(r.name)}: ${r.display !== i.display ? 'rendered as ' + i.display + ' instead of ' + r.display : 'columns are hidden on ' + n}.`, [i.key]);
    // side-by-side → stacked
    const blocks = both.filter(([r]) => r.cat === 'heading' || r.cat === 'image').sort((a, b) => a[0].y - b[0].y || a[0].x - b[0].x);
    const overlap = (a, b) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    const stacked = [];
    for (let a = 0; a < blocks.length && stacked.length < 60; a++) for (let b = a + 1; b < Math.min(blocks.length, a + 8); b++) {
      const [ra, ia] = blocks[a], [rb, ib] = blocks[b];
      if (overlap(ra, rb) > .5 * Math.min(ra.h, rb.h) && (ra.x + ra.w <= rb.x + 2 || rb.x + rb.w <= ra.x + 2) && overlap(ia, ib) <= 0) { stacked.push(ib); break; }
    }
    if (stacked.length > (dev.kind === 'desktop' ? 1 : 0)) add('info', 'Layout', dev, 'Side-by-side elements stack', `${stacked.length} side-by-side element${stacked.length > 1 ? 's' : ''} stack vertically`, `Next to each other on ${rn}, one above the other here: ${list(stacked.map(i => i.name))}`, stacked.map(i => i.key));
    // reading order
    const rowMajor = k => (a, b) => overlap(a[k], b[k]) > .3 * Math.min(a[k].h, b[k].h) ? a[k].x - b[k].x : a[k].y - b[k].y; // same row → left to right
    const seq = both.filter(([r]) => r.cat === 'heading' || r.cat === 'image').sort(rowMajor(0));
    const dOrder = [...seq].sort(rowMajor(1)), pos = seq.map(p => dOrder.indexOf(p));
    const lis = []; const keep = new Set(); // longest increasing subsequence = elements that kept their order
    { const tails = [], prev = []; pos.forEach((v, idx) => { let lo = 0, hi = tails.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (pos[tails[mid]] < v) lo = mid + 1; else hi = mid; } prev[idx] = lo ? tails[lo - 1] : -1; tails[lo] = idx; }); let k = tails[tails.length - 1]; while (k >= 0 && k !== undefined) { keep.add(k); k = prev[k]; } }
    const moved = seq.filter((_, idx) => !keep.has(idx)).map(p => p[1]);
    if (moved.length && moved.length <= seq.length / 2 && dev.kind !== 'desktop') add('info', 'Layout', dev, 'Reading order changes', `Reading order changes for ${moved.length} element${moved.length > 1 ? 's' : ''}`, `Appear in a different sequence than on ${rn}: ${list(moved.map(i => i.name))}`, moved.map(i => i.key));
  }
  return out;
}

async function detect(quiet) {
  const devs = workspaceScreens().filter(d => d.ready); if (devs.length < 1) return;
  $('#detect span').textContent = 'Measuring…';
  const rid = crypto.randomUUID(), snaps = [];
  const scanSalt = textSalt;
  const scanPreview = openId;
  const scanWall = wallRevision;
  await new Promise(done => {
    pendingSnap.set(rid, (d, data) => { if (data) snaps.push({ dev: d, data }); if (snaps.length === devs.length) done(); });
    devs.forEach(d => post(d, 'snapshot', { rid })); setTimeout(done, 4000);
  });
  pendingSnap.delete(rid);
  if (scanSalt !== textSalt || scanPreview !== openId || scanWall !== wallRevision) return;
  snaps.sort((a, b) => a.dev.slot - b.dev.slot);
  const ref = $('#ref').value;
  findings = sitesMode ? sitePanels.flatMap(site => analyze(snaps.filter(s => s.dev.site === site), ref)) : analyze(snaps, ref);
  lastScan = { at: new Date(), screens: snaps.map(s => s.dev) };
  $('#detect span').textContent = 'Detect differences'; renderFindings(); if (quiet !== true) showTab('diff');
}
// The report lists each problem once with the screens it affects ("By issue"), or every screen's own list ("By device").
let reportView = 'issue', reportGroups = [], lastScan = null;
try { if (localStorage.getItem('samestate.reportView') === 'device') reportView = 'device'; } catch {}
const pickedScreen = new Map(); // issue group → the screen whose details are shown
const SEVERITY = { issue: 0, warn: 1, info: 2 };

// One entry per problem: its findings in screen order, the screens it affects, most severe and widespread first.
function issueGroups(list) {
  const groups = new Map();
  for (const f of list) {
    const site = f.dev.site || null;
    const key = [site ? sitePanels.indexOf(site) : '', f.sev, f.cat, f.kind].join('|');
    let group = groups.get(key);
    if (!group) groups.set(key, group = { key, site, sev: f.sev, cat: f.cat, kind: f.kind, items: [] });
    group.items.push(f);
  }
  for (const g of groups.values()) {
    g.items.sort((a, b) => a.dev.slot - b.dev.slot);
    g.screens = [...new Set(g.items.map(f => f.dev))]; // a screen can have the same problem more than once, such as two overlays
  }
  return [...groups.values()].sort((a, b) => SEVERITY[a.sev] - SEVERITY[b.sev] || b.screens.length - a.screens.length || CATS.indexOf(a.cat) - CATS.indexOf(b.cat));
}

function renderFindings() {
  const order = SEVERITY;
  const byIssue = reportView === 'issue';
  findings.forEach((f, i) => { f.i = i; });
  const groups = issueGroups(findings);
  const counted = byIssue ? groups : findings;
  const count = cat => counted.filter(item => !cat || item.cat === cat).length;
  const cats = CATS.filter(c => findings.some(f => f.cat === c));
  $('#report-bar').hidden = !findings.length;
  document.querySelectorAll('#report-view button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === reportView)));
  $('#chips').innerHTML = cats.length ? `<button class="chip ${!catFilter ? 'on' : ''}" data-cat="">All ${count()}</button>` + cats.map(c => `<button class="chip ${catFilter === c ? 'on' : ''}" data-cat="${c}">${c} ${count(c)}</button>`).join('') : '';
  $('#diffn').textContent = counted.length || '';
  const shown = findings.filter(f => !catFilter || f.cat === catFilter);
  if (!shown.length) { $('#findings').innerHTML = '<p class="muted">No differences found for this view.</p>'; return; }
  const screens = sitesMode ? workspaceScreens() : viewScreens();
  let html = '';
  if (byIssue) {
    reportGroups = groups.filter(g => !catFilter || g.cat === catFilter);
    for (const site of sitesMode ? sitePanels : [null]) {
      const own = reportGroups.filter(g => g.site === site);
      if (!own.length) continue;
      const c = s => own.filter(g => g.sev === s).length;
      const compared = 'Compared with ' + screenName(own[0].items[0].reference);
      const name = site ? `Site ${sitePanels.indexOf(site) + 1} · ${site.url.origin === EXT ? 'Demo' : site.url.host} · ${compared}` : compared;
      html += `<div class="group">${esc(name)}<small>${c('issue')} issues · ${c('warn')} warnings · ${c('info')} adaptations</small></div>`;
      for (const g of own) {
        const pick = g.screens.includes(pickedScreen.get(g.key)) ? pickedScreen.get(g.key) : g.screens[0];
        const details = g.items.filter(f => f.dev === pick).map(f => (f.title === g.kind ? '' : f.title + '. ') + f.detail);
        html += `<div class="finding ${g.sev} grouped" data-g="${reportGroups.indexOf(g)}"><div class="t">${esc(g.kind)}<span class="c">${g.cat}</span></div>`
          + `<div class="screens" role="group" aria-label="Screens with this finding">${g.screens.map((d, s) => `<button type="button" class="screen-chip${d === pick ? ' on' : ''}" data-s="${s}" aria-pressed="${d === pick}" title="Show details for ${esc(screenName(d))}">${esc(screenName(d))}</button>`).join('')}</div>`
          + details.map((detail, k) => `<div class="d">${k ? '' : `<b>${esc(screenName(pick))}:</b> `}${esc(detail)}</div>`).join('') + '</div>';
      }
    }
    $('#findings').innerHTML = html;
    return;
  }
  for (const d of screens) {
    const fs = shown.filter(f => f.dev === d).sort((a, b) => order[a.sev] - order[b.sev]); if (!fs.length) continue;
    const c = s => fs.filter(f => f.sev === s).length;
    html += `<div class="group">${esc(reportName(d))}<small>${c('issue')} issues · ${c('warn')} warnings · ${c('info')} adaptations</small></div>` +
      fs.map(f => `<div class="finding ${f.sev}" data-i="${f.i}"><div class="t">${esc(f.title)}<span class="c">${f.cat}</span></div><div class="d">${esc(f.detail)}</div></div>`).join('');
  }
  $('#findings').innerHTML = html;
}
$('#chips').addEventListener('click', e => { if (e.target.dataset.cat !== undefined) { catFilter = e.target.dataset.cat || null; renderFindings(); } });
$('#report-view').addEventListener('click', e => {
  const view = e.target.closest('button')?.dataset.view;
  if (!view || view === reportView) return;
  reportView = view;
  try { localStorage.setItem('samestate.reportView', view); } catch {}
  renderFindings();
});
// Outlines the findings in their previews, and the matching elements on the reference screen.
function showFindings(list) {
  for (const f of list) if (f.keys.length) post(f.dev, 'highlight', { keys: f.keys });
  const refKeys = [...new Set(list.flatMap(f => f.refKeys))];
  if (refKeys.length) post(list[0].reference, 'highlight', { keys: refKeys });
  const first = list[0];
  if (mode === 'focus') {
    if (first.dev.site) first.dev.site.focusDev = first.dev;
    else focusDev = first.dev;
    relayout();
  }
  cvAllow = Date.now() + 900;
  first.dev.el && first.dev.el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}
$('#findings').addEventListener('click', e => {
  const el = e.target.closest('.finding'); if (!el) return;
  if (el.dataset.g === undefined) { showFindings([findings[+el.dataset.i]]); return; }
  const group = reportGroups[+el.dataset.g], chip = e.target.closest('.screen-chip');
  if (!chip) { showFindings(group.items); return; } // the whole issue, on every screen it affects
  const screen = group.screens[+chip.dataset.s];
  pickedScreen.set(group.key, screen);
  renderFindings();
  showFindings(group.items.filter(f => f.dev === screen));
});
$('#detect').onclick = () => detect();
function showTab(t) { $('#panel').hidden = false; if (mode === 'focus') relayout(); document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $('#pane-diff').hidden = t !== 'diff'; $('#pane-log').hidden = t !== 'log'; }
document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.tab) showTab(b.dataset.tab); });
$('#closepanel').onclick = () => { $('#panel').hidden = true; if (mode === 'focus') relayout(); };
document.querySelector('.right-tools').addEventListener('click', e => { const b = e.target.closest('[data-panel]'); if (!b) return; const t = b.dataset.panel, open = !$('#panel').hidden && !$('#pane-' + t).hidden; if (open) $('#closepanel').onclick(); else showTab(t); });

/* ----------------------------------- boot ----------------------------------- */
const refreshDevicePicker = mountDevicePicker(DEVICES, {
  toggle: toggleDevice,
  isSelected: selectedDevice,
  add(preset) {
    const d = previewDevice(preset, nextDeviceSlot++);
    DEVICES.push(d);
    toggleDevice(d, true);
    fillSharedDevices();
    sitePanels.forEach(fillSiteDevices);
  },
  remove(d) {
    selectDevice(d, false);
    for (const site of sitePanels) {
      const preview = site.devices.find(device => device.id === d.id);
      if (!preview) continue;
      removeFrame(preview);
      site.devices.splice(site.devices.indexOf(preview), 1);
    }
    DEVICES.splice(DEVICES.indexOf(d), 1);
    fillSharedDevices();
    sitePanels.forEach(fillSiteDevices);
    refreshViews();
  }
});
fillSharedDevices();
renderLeft();
refreshThemeTargets();
if (!IS_EXT) { document.body.classList.add('web'); $('#src').placeholder = 'Live demo on a sample site — install the extension to open any page'; $('#own').textContent = 'Get the Chrome extension'; }
// The extension starts on the default site, which the manifest already has access to, so no prompt is
// needed. The web demo can only show the bundled sample site, so it starts with the tour.
const DEFAULT_SITE = 'https://claude.com/';
async function openDefault() {
  const url = new URL(DEFAULT_SITE);
  let allowed = false;
  try { allowed = await chrome.permissions.contains({ origins: [originPattern(url)] }); } catch {}
  if (target || openId) return; // the user already opened something
  if (allowed) return open(url, true);
  $('#src').value = DEFAULT_SITE;
  $('#joblog').textContent = `Press Enter to open ${url.host}.`;
}
if (IS_EXT) openDefault(); else startTour();
