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
const SYNC = { click: ['Clicks & menus', true], nav: ['Links & pages', true], scroll: ['Scrolling', true], hover: ['Hover', true], media: ['Video playback', true], form: ['Typing & form fields', false] };
const KIND_SYNC = { click: 'click', navigate: 'nav', scroll: 'scroll', escroll: 'scroll', swipe: 'scroll', hover: 'hover', unhover: 'hover', media: 'media', field: 'form' };

let target = null, previewUrl = null, leader = null, zoom = 1, mode = 'grid', focusDev = null, aid = 0, findings = [], catFilter = null;
let textSalt = null, wallRevision = 0;
let videoRequest = null;
// Screen settings show one page two ways side by side: every second screen on the wall gets the other setting.
const SETTING_NAMES = {
  dark: 'Dark', light: 'Light', text200: '200% text', landscape: 'Landscape', portrait: 'Portrait',
  motion: 'Reduced motion', contrast: 'More contrast', print: 'Print', forced: 'Forced colors', reduceddata: 'Reduced data',
  transparency: 'Reduced transparency', gamut: 'Wide color', rtl: 'Right-to-left', lang: 'Language',
  protanopia: 'Protanopia', deuteranopia: 'Deuteranopia', tritanopia: 'Tritanopia', achromatopsia: 'No color', blur: 'Blurred vision'
};
let screenSettings = ''; // '', 'scheme', 'text', 'orientation', or one setting from SECOND_ONLY
// The page rewrites its own media rules for these (agent.js); vision is a filter over the preview.
const PAGE_VARIANTS = ['dark', 'light', 'text200', 'motion', 'contrast', 'print', 'forced', 'reduceddata', 'transparency', 'gamut', 'rtl', 'lang'];
const VISION = {
  protanopia: 'url(#vision-protanopia)', deuteranopia: 'url(#vision-deuteranopia)', tritanopia: 'url(#vision-tritanopia)',
  achromatopsia: 'grayscale(1)', blur: 'blur(1.5px)'
};
const SECOND_ONLY = ['motion', 'contrast', 'print', 'forced', 'reduceddata', 'transparency', 'gamut', 'rtl', 'lang', ...Object.keys(VISION)]; // every second screen gets it, the others stay as they are
let longText = false; // every preview's text about a third longer, as translations often are
function screenSetting(d) {
  if (!screenSettings || d.settingShown || d.site || d.step || d.label) return '';
  const index = DEVICES.filter(x => x.on).indexOf(d);
  if (index < 0) return '';
  const second = index % 2 === 1;
  if (screenSettings === 'scheme') return second ? 'dark' : 'light';
  if (screenSettings === 'text') return second ? 'text200' : '';
  if (SECOND_ONLY.includes(screenSettings)) return second ? screenSettings : '';
  return presetFor(d).kind === 'desktop' ? '' : second ? 'landscape' : 'portrait'; // desktops don't rotate
}
const screenVariant = d => { const setting = screenSetting(d); return PAGE_VARIANTS.includes(setting) ? setting : ''; };
const visionFilter = d => VISION[screenSetting(d)] || '';
/* --------------------------- debug menu: items --------------------------- */
// Debug tools and Simulators, for one screen (the bug button in its title bar) or every
// visible screen (Debug in the top bar). Tools run in the preview (agent.js); most simulators are a filter here.
const DEBUG_MENU = [
  { heading: 'Debug tools' },
  { group: 'Layout' },
  { id: 'layout', label: 'Layout debugging', info: 'Outlines every element and marks the ones that stick out past the right edge in red, with how far.' },
  { id: 'zindex', label: 'Show z-index', info: 'Labels positioned elements with their z-index.' },
  { id: 'reach-right', label: 'Reachability', note: 'Right hand', info: 'How easy each part of the screen is to reach with the right thumb: green is easy, red is a stretch.' },
  { id: 'reach-left', label: 'Reachability', note: 'Left hand', info: 'How easy each part of the screen is to reach with the left thumb: green is easy, red is a stretch.' },
  { id: 'rulers', label: 'Rulers and guides', info: 'Pixel rulers along the top and left. Click a ruler to add a guide there; click the same spot again to remove it.' },
  { id: 'columns', label: 'Column grid', info: 'A column grid over the page. Set columns, gutter and width in Grid settings.' },
  { id: 'baseline', label: 'Baseline grid', info: 'Horizontal lines every few pixels (8 by default, in Grid settings) to check vertical rhythm.' },
  { id: 'measure', label: 'Measure area', info: 'Drag to draw boxes that show their size and distance to the edges. The page can\'t be clicked while this is on.' },
  { id: 'peek', label: 'Peek', note: 'hold Alt', info: 'Hold Alt (Option) and hover: size, font, colors, contrast, box model, role and name. The same element lights up on the other screens.' },
  { group: 'Accessibility' },
  { id: 'contrast', label: 'Contrast checker', info: 'Marks text below WCAG AA contrast (4.5:1, or 3:1 for large text) with its ratio. Text over images and gradients is skipped.' },
  { id: 'focus', label: 'Track focus', info: 'Outlines the focused element as you Tab, with its role and accessible name.' },
  { id: 'target', label: 'Target size', info: 'Marks controls under 24px in red and under 44px in amber. Links inside a sentence are exempt.' },
  { id: 'smalltext', label: 'Small text', info: 'Marks text under 12px, and form fields under 16px (iOS zooms into those).' },
  { id: 'spacing', label: 'Text spacing', note: 'WCAG 1.4.12', info: 'Line height 1.5, letter spacing 0.12em, word spacing 0.16em and paragraph spacing 2em. Content should not get cut off.' },
  { id: 'roles', label: 'Show roles', info: 'Labels elements that have a role attribute.' },
  { id: 'aria', label: 'Show ARIA attributes', info: 'Labels elements with their aria- attributes and values.' },
  { id: 'hover', label: 'Apply all hover styles', info: 'Shows every :hover style at once. Stylesheets from other sites can\'t be read, so their hover styles are left out.' },
  { id: 'focusvisible', label: 'Apply all focus-visible styles', info: 'Shows every :focus-visible and :focus style at once. Stylesheets from other sites can\'t be read.' },
  { group: 'Content' },
  { id: 'edit', label: 'Edit content', info: 'Makes the whole page editable so you can try out copy. Changes go away on reload.' },
  { id: 'hostile', label: 'Hostile CSS', info: 'Gives plain elements ugly default styles. Components that set their own styles stay as they are.' },
  { id: 'audible', label: 'Audible changes', info: 'Beeps when the page changes, to hear updates you might not see.' },
  { id: 'readability', label: 'Readability', info: 'Grades each paragraph with the Automated Readability Index: green is easy (grade 8 or below), amber is harder, red is hard (above 12).' },
  { id: 'textlen', label: 'Measure text', info: 'Select text to see its characters, words and sentences. 45–75 characters per line reads best.' },
  { group: 'Disable' },
  { id: 'nocss', label: 'Disable CSS', info: 'Turns off the page\'s stylesheets and style attributes.' },
  { id: 'noimages', label: 'Disable images', info: 'Hides images, video, SVG and background images.' },
  { id: 'nocursor', label: 'Hide cursor', info: 'Hides the mouse cursor in the preview, to test with the keyboard.' },
  { group: 'Actions' },
  { action: 'design', single: true, label: 'Design overlay…', info: 'Put a design export over this screen to compare: opacity, difference blend, split view and offsets.' },
  { action: 'grid', label: 'Grid settings…', info: 'Columns, gutter, width and baseline for Column grid and Baseline grid.' },
  { action: 'fill-valid', label: 'Fill forms with test data', info: 'Fills every visible field with valid values: an email, a phone number, dates, names. Nothing is submitted.' },
  { action: 'fill-edge', label: 'Fill forms with edge cases', info: 'Fills fields with values that often break things: an invalid email, accented and non-Latin names, very long text, HTML.' },
  { action: 'fill-clear', label: 'Clear forms', info: 'Empties every visible field.' },
  { heading: 'Simulators' },
  { sim: '', label: 'None', info: 'No simulator.' },
  { group: 'Color blindness (red-green)' },
  { sim: 'protanomaly', label: 'Protanomaly', info: 'Weak red sensitivity. About 1% of men.' },
  { sim: 'protanopia', label: 'Protanopia', info: 'No red cones. About 1% of men.' },
  { sim: 'deuteranomaly', label: 'Deuteranomaly', info: 'Weak green sensitivity, the most common color vision deficiency. About 5% of men.' },
  { sim: 'deuteranopia', label: 'Deuteranopia', info: 'No green cones. About 1% of men.' },
  { group: 'Color blindness (blue-yellow)' },
  { sim: 'tritanomaly', label: 'Tritanomaly', info: 'Weak blue sensitivity. Rare.' },
  { sim: 'tritanopia', label: 'Tritanopia', info: 'No blue cones. Rare.' },
  { group: 'Full color blindness' },
  { sim: 'achromatomaly', label: 'Achromatomaly', info: 'Very little color.' },
  { sim: 'achromatopsia', label: 'Achromatopsia', info: 'No color at all.' },
  { group: 'Visual impairments' },
  { sim: 'cataracts', label: 'Cataracts', info: 'Cloudy, blurred, yellowed and low-contrast vision.' },
  { sim: 'glaucoma', label: 'Glaucoma', info: 'Blurred, dark edges. The clear area follows the mouse.' },
  { sim: 'farsighted', label: 'Farsightedness', info: 'Close-up details are blurred.' },
  { sim: 'astig-h', label: 'Astigmatism', note: 'Horizontal', info: 'Blur and a ghost image to the side.' },
  { sim: 'astig-v', label: 'Astigmatism', note: 'Vertical', info: 'Blur and a ghost image above and below.' },
  { sim: 'tunnel', label: 'Tunnel vision', info: 'Only the center is visible. It follows the mouse.' },
  { sim: 'macular', label: 'Macular degeneration', info: 'The center is blurred out. The spot follows the mouse.' },
  { sim: 'cmv', label: 'CMV retinitis', info: 'Dark specks across the view.' },
  { sim: 'photophobia', label: 'Photophobia', info: 'Light sensitivity: a bright, glaring screen.' },
  { group: 'Other' },
  { sim: 'sunshine', label: 'Bright sunshine', info: 'A phone in direct sunlight: washed-out colors, low contrast is lost.' },
  { sim: 'dimmed', label: 'Dimmed screen', info: 'Brightness at about 40%, like a laptop on battery or a phone at minimum.' },
  { sim: 'night', label: 'Night mode', info: 'Less blue and more red, like Night Shift.' },
];
const SIM_FILTER = {
  protanomaly: 'url(#sim-protanomaly)', protanopia: 'url(#vision-protanopia)', deuteranomaly: 'url(#sim-deuteranomaly)', deuteranopia: 'url(#vision-deuteranopia)',
  tritanomaly: 'url(#sim-tritanomaly)', tritanopia: 'url(#vision-tritanopia)', achromatomaly: 'grayscale(.7)', achromatopsia: 'grayscale(1)',
  cataracts: 'blur(1.6px) contrast(.6) brightness(1.12) sepia(.35)', farsighted: 'blur(2.2px)', 'astig-h': 'url(#sim-astig-h)', 'astig-v': 'url(#sim-astig-v)',
  photophobia: 'brightness(1.5) contrast(.8) saturate(.85)', sunshine: 'brightness(1.4) contrast(.5) saturate(.55)', dimmed: 'brightness(.4)',
  night: 'sepia(.55) saturate(1.35) hue-rotate(-12deg) brightness(.92)'
};
const SIMS = new Set(DEBUG_MENU.filter(item => item.sim).map(item => item.sim));
const TOOL_IDS = DEBUG_MENU.filter(item => item.id).map(item => item.id);
const wallDebug = { tools: new Set(), sim: '' }; // what the all-screens menu last set; screens opened later start with it
const debugTools = d => d.debug ??= new Set(wallDebug.tools);
const debugSim = d => d.sim ??= wallDebug.sim;
function showDebugState(d) {
  const button = d.el?.querySelector('[data-a=debug]');
  if (!button) return;
  const n = debugTools(d).size + (debugSim(d) ? 1 : 0) + (d.design ? 1 : 0);
  button.classList.toggle('on', n > 0);
  button.dataset.count = n || '';
  button.title = n ? `Debug tools and simulators: ${n} on` : 'Debug tools and simulators';
}
function applyDebug(d) {
  if (!d.el) return;
  d.iframe.style.filter = previewFilter(d);
  if (d.ready) configure(d);
  showDebugState(d);
}
// The Screen settings vision filter, then the screen's own simulator from the Debug menu.
const previewFilter = d => [visionFilter(d), SIM_FILTER[debugSim(d)] || ''].filter(Boolean).join(' ');
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
const IC = { debug: '<svg viewBox="0 0 24 24"><rect x="8" y="7" width="8" height="13" rx="4"/><path d="M12 7v13M9.5 7.5 8 4.5M14.5 7.5 16 4.5M4 13h4M16 13h4M5 19l3-2M19 19l-3-2M5 8l3 2M19 8l-3 2"/></svg>', link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>', rot: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="14" rx="2"/><path d="M4 17a8 8 0 0 0 8 4M20 7a8 8 0 0 0-5-4"/></svg>', rel: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg>', foc: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>' };
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
  if (d.label) return d.label;
  const setting = screenSetting(d);
  if (setting) return screenName({ ...d, settingShown: true, label: null }) + ' · ' + SETTING_NAMES[setting];
  if (d.site) return sameDevice ? d.name + ' · ' + presetFor(d).name : d.name;
  if (d.step) return 'Step ' + d.step + ' · ' + presetFor(d).name;
  if (sameDevice) return 'Screen ' + (viewScreens().indexOf(d) + 1) + ' · ' + presetFor(d).name;
  return d.name;
}

function size(d) {
  const { w, h, kind } = presetFor(d);
  if (d.fixedSize) return d.fixedSize; // a journey report screen: one step at one device's size
  if (d.sweepW) return { w: d.sweepW, h: d.rot && kind !== 'desktop' ? w : h };
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
// iPads have reported themselves as a Mac with touch since iPadOS 13.
function userAgent(ios, phone) {
  return ios
    ? phone
      ? `Mozilla/5.0 (iPhone; CPU iPhone OS ${IOS_VERSION} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${SAFARI_VERSION} Mobile/15E148 Safari/604.1`
      : `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${SAFARI_VERSION} Safari/605.1.15`
    : `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 ${phone ? 'Mobile ' : ''}Safari/537.36`;
}
// The background worker sends these to the server for page loads marked samestate-ua=<type> (see setPreviewSource).
const SERVER_AGENTS = { iphone: userAgent(true, true), ipad: userAgent(true, false), android: userAgent(false, true), 'android-tablet': userAgent(false, false) };
const uaType = identity => identity.ios ? (identity.mobile ? 'iphone' : 'ipad') : (identity.mobile ? 'android' : 'android-tablet');
function deviceIdentity(d) {
  const preset = presetFor(d);
  if (!emulateDevices || preset.kind === 'desktop') return null;
  const { w, h } = size(d);
  const ios = preset.os === 'ios', phone = preset.kind === 'phone';
  const ua = userAgent(ios, phone);
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
  d.iframe.style.filter = previewFilter(d);
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

function setPreviewSource(frame, url, d) {
  if (url.origin === EXT) frame.removeAttribute('sandbox');
  else frame.setAttribute('sandbox', PREVIEW_SANDBOX);
  frame.credentialless = url.origin !== EXT && !useSignIns; // a credentialless frame has no cookies and throwaway storage
  const identity = d && IS_EXT && url.origin !== EXT ? deviceIdentity(d) : null;
  if (identity) { url = new URL(url); url.searchParams.set('samestate-ua', uaType(identity)); } // the server gets the device's user-agent
  frame.src = url.href;
}

function addFrame(d) {
  const el = document.createElement('div');
  const closeLabel = d.step ? 'Close this step' : 'Close this preview';
  el.className = 'dev' + (d.linked ? '' : ' unlinked');
  el.innerHTML = `<div class="dev-head"><i class="dot"></i><b class="dev-name"></b><span class="dims"><span class="viewport-size" title="Page viewport in CSS pixels"></span><button type="button" data-a="scale" class="preview-scale-button" aria-haspopup="dialog" title="Change preview scale"></button></span><span class="sp"></span><button type="button" data-a="debug" class="debug-button" aria-haspopup="menu" aria-expanded="false" title="Debug tools and simulators">${IC.debug}</button><button data-a="link" title="Toggle screen link"${d.step ? ' hidden' : ''}>${IC.link}</button><button data-a="rot" title="Rotate">${IC.rot}</button><button data-a="rel" title="Reload">${IC.rel}</button><button data-a="foc" title="Focus this device">${IC.foc}</button><button type="button" data-a="close" title="${closeLabel}" aria-label="${closeLabel}">×</button></div><div class="dev-body"><div class="scaled"><div class="device-top"></div><iframe sandbox="${PREVIEW_SANDBOX}" allow="autoplay; clipboard-write"></iframe><div class="device-bottom"></div></div></div>`;
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
    if (action === 'debug') openDebugMenu(d, button);
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
  showDebugState(d);
  d.themeTargetId = d.token = crypto.randomUUID();
  d.identity = d.iframe.name = identityName(d); // before the first load
  if (d.site) {
    setPreviewSource(d.iframe, d.site.url, d);
    d.site.frames.append(el);
  } else {
    setPreviewSource(d.iframe, new URL(d.pageUrl || previewUrl), d);
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
  findings = []; lastScan = null;
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
  findings = []; lastScan = null;
  renderFindings();
  updateWall();
  applyScreenSettings();
  $('#journey').hidden = !journeyView;
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
// Previews share Chrome's cookies and storage for the site unless the user turns this off. The frame's credentialless
// state is fixed when it starts loading a page, so the screens are opened again on their current pages.
let useSignIns = true;
try { useSignIns = localStorage.getItem('samestate.signins') !== 'off'; } catch {}
async function setSignIns(on) {
  useSignIns = on;
  $('#sign-ins').checked = on;
  try { localStorage.setItem('samestate.signins', on ? 'on' : 'off'); } catch {}
  const screens = connectedScreens().filter(d => d.iframe && previewOrigin(d) && previewOrigin(d) !== EXT);
  const pages = await Promise.all(screens.map(screenAddress));
  if (useSignIns !== on) return;
  screens.forEach((d, i) => {
    if (!pages[i]) return;
    d.ready = false; d.el?.classList.remove('ready');
    setPreviewSource(d.iframe, pages[i], d);
  });
}
// The page a screen shows now (its agent knows; the frame's src is only where it started).
async function screenAddress(d) {
  let address = null;
  if (d.ready) {
    const rid = crypto.randomUUID();
    const state = await new Promise(done => { pendingState.set(rid, done); post(d, 'state', { rid }); setTimeout(() => done(null), 800); });
    pendingState.delete(rid);
    address = state?.url;
  }
  try { const url = new URL(address || d.iframe.src); url.searchParams.delete('samestate-ua'); return url; } catch { return null; }
}
$('#sign-ins').checked = useSignIns;
$('#sign-ins').addEventListener('change', event => setSignIns(event.target.checked));
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
// The web demo can retain old iframe resources after the shell reloads. Load this feature's matching agent.
if (!IS_EXT) DEMO_URL.searchParams.set('samestate-build', 'weekly-demo-20261119-final');
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
    const reply = await chrome.runtime.sendMessage({ type: 'register', origin: nextWall, sites: [...new Set(nextSites.values())], agents: SERVER_AGENTS });
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
  findings = []; lastScan = null;
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
  findings = []; lastScan = null;
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
  findings = []; lastScan = null;
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
      setPreviewSource(d.iframe, url, d);
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
        themeStatus.textContent = name === 'clean-green' ? `Loading ${label}…` : `Loading ${label} from tweakcn…`;
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
let tourStep = 0, tourPhase = 'idle', tourManual = false, tourAdvance = false, tourNavigation = 0;
const touring = id => id === tour;

// Waits that stop when the demo is skipped and hold while it is paused. Both answer whether the demo is still on.
async function nap(id, ms) {
  for (let t = 0; t < ms || tourPaused; t += tourPaused ? 0 : 100) {
    if (!touring(id)) return false;
    if (tourAdvance && ['waiting', 'advancing'].includes(tourPhase)) return true;
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
  if (el.closest('#sidebar') || el.closest('#panel') || el.closest('dialog[open]')) { el.scrollIntoView({ block: 'nearest' }); return; }
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
  if (Math.abs(dx) >= 2 || Math.abs(dy) >= 2) await scrollWall(cv.scrollLeft + dx, cv.scrollTop + dy, 450, () => touring(id));
}
// Scrolls the wall step by step, so it is where the demo expects by the time the pointer moves.
async function scrollWall(left, top, ms = 450, ok = () => true) {
  const from = [cv.scrollLeft, cv.scrollTop];
  cvAllow = Date.now() + ms + 500;
  await glide(ms, t => { if (ok()) { cv.scrollLeft = from[0] + (left - from[0]) * t; cv.scrollTop = from[1] + (top - from[1]) * t; } });
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
  await glide(within(Math.hypot(to.x - from.x, to.y - from.y) * 1.2 + 260, 380, 1050), t => { if (touring(id)) setPointer(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t); });
  if (!touring(id)) return false;
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
  if (t.ok()) tourPointer.classList.remove('wheel');
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
    if (!t.ok()) return;
    const tip = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, r = spot(tip.x, tip.y)();
    mark.points[1] = tip;
    notes.redraw();
    setPointer(r.x, r.y);
  });
  if (!t.ok()) return;
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
    scrollWall(Math.max(0, phone.x + phone.el.offsetWidth / 2 - cv.clientWidth / 2), cv.scrollTop, 900, t.ok);
    await glide(1000,() => { if (t.ok()) { const r = phone.el.getBoundingClientRect(); setPointer(r.left + grip.x, r.top + grip.y); } });
  }
  if (!t.ok()) return;
  frames.classList.remove('tour-glide');
  phone.el.classList.remove('dragging');
  tourPointer.classList.remove('down');
}

// The bundled Clean Green preset keeps this demonstration available offline.
async function tourTheme() {
  themeTarget.value = 'all';
  $('#theme-palette').value = 'light';
  $('#theme-basic').checked = true;
  themePreset.value = 'clean-green';
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
const demoLink = (id, sel) => async t => {
  if (!await t.click(inScreen(id, sel))) return;
  const link = dev(id).iframe.contentDocument?.querySelector(sel);
  if (!link) return;
  const path = new URL(link.href).pathname;
  play(id, { do: 'link', sel });
  await t.until(() => active().every(d => d.ready && d.iframe.contentDocument?.readyState === 'complete' && d.iframe.contentDocument.location.pathname === path), 15000);
};
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
      await scrollWall(0, 0, 450, t.ok);
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
    text: 'Pick a <b>tweakcn</b> preset and it is applied to the previews, here the bundled Clean Green palette. A theme can go on every preview, one preview, or one comparison column.',
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
    text: '<b>Screenshot</b>, <b>Full page</b> and <b>Overview</b> support PNG, JPEG and PDF. Auto screenshots have a pace; recordings have a frame rate and split into 10 MB parts. Choose a save folder when capturing.',
    run: async t => { for (const id of ['#screenshot', '#full-page-shot', '#overview-shot', '#auto-shots', '#shot-rate', '#record-rate', '#capture-folder']) { if (!await t.point(id) || !await t.nap(350)) return; } }
  },
  {
    title: 'Day and night', at: '#ui-mode', wait: 1400,
    text: 'The sun and moon button switches Samestate between <b>day</b> and <b>night</b> mode. The menu picks Samestate (Zinc at night), Neutral, Clay, Teal, Hive or Clean Green. Your saved choice returns after this demo.',
    run: async t => {
      if (!await t.point('#ui-mode')) return;
      const mode = uiTheme.mode === 'dark' ? 'light' : 'dark';
      uiTheme.preview(uiTheme.theme, mode); showUiTheme();
      if (!await t.nap(1300) || !await t.point('#ui-theme')) return;
      for (const id of ['neutral', 'clay', 'teal', 'hive', 'clean']) {
        uiTheme.preview(id, mode); showUiTheme();
        if (!await t.nap(900)) return;
      }
    }
  },
  {
    title: 'That is the tour', wait: 0,
    text: IS_EXT ? 'Keep exploring the sample site, or type your own address in the bar at the top.' : 'Click around the screens yourself, or install the Chrome extension to open any page.',
    run: async t => {
      await window.samestateTourFeatures?.reset();
      if (!t.ok()) return;
      setSitesMode(false);
      restoreDeviceIdentity();
      restoreUiTheme();
      scrollWall(0, 0, 450, t.ok);
      tourPointer.hidden = true;
      $('#skip').textContent = IS_EXT ? 'Use my own site' : 'Close';
    }
  }
];

function showStep(i) {
  tourStep = i;
  const step = STEPS[i];
  $('#tourcount').textContent = (i + 1) + ' / ' + STEPS.length;
  $('#tourname').textContent = $('#tourtitle').textContent = step.title;
  $('#tourtext').innerHTML = step.text;
  document.querySelectorAll('#tourdots i').forEach((dot, k) => { dot.classList.toggle('on', k < i); dot.classList.toggle('now', k === i); });
  updateTourNavigation();
}

function updateTourNavigation() {
  const select = $('#tour-step');
  if (select.options.length !== STEPS.length) select.replaceChildren(...STEPS.map((step, i) => new Option(`${i + 1}. ${step.title}`, String(i))));
  select.value = String(tourStep);
  $('#tour-prev').disabled = tourStep <= 0;
  $('#tour-next').disabled = tourStep >= STEPS.length - 1;
  const preparing = ['preparing', 'advancing'].includes(tourPhase);
  $('#tourpause').disabled = preparing;
  $('#tour').setAttribute('aria-busy', String(preparing));
  $('#tour-navigation-status').textContent = preparing ? `Preparing step ${tourStep + 1}: ${STEPS[tourStep].title}.` : tourPaused ? `Paused on step ${tourStep + 1}. Use Previous or Next, or Resume for automatic playback.` : `Step ${tourStep + 1} of ${STEPS.length}: ${STEPS[tourStep].title}.`;
}

function showTourLoading(index) {
  introSkipped = true; // a jump to a step ends the intro
  window.samestateFeatureHelp?.close(false);
  window.samestateTourVoice?.stop();
  tourPhase = 'preparing';
  $('#tour').hidden = $('#tour-callout').hidden = $('#tourpause').hidden = false;
  $('#skip').textContent = 'Skip demo';
  showStep(index);
  $('#tourtext').textContent = 'Preparing this demo step…';
  tourPointer.hidden = true; tourFocus(null);
}

async function goTourStep(index) {
  if (!Number.isInteger(index) || index < 0 || index >= STEPS.length) return;
  if (!tourRunning && !window.samestateTourFeatures?.active && (window.samestateChecks?.running || window.samestateTest?.busy || window.wallCapture?.busy || sweepRun || pendingSnap.size)) return;
  if (tourRunning && tourPhase === 'waiting' && index === tourStep + 1) {
    // The current step has finished: keep its live state and advance immediately.
    tourManual = true; tourAdvance = true; setTourPaused(false);
    showTourLoading(index); tourPhase = 'advancing';
    return;
  }
  const cleanup = endTour(false), request = tourNavigation;
  tourManual = true; showTourLoading(index);
  await cleanup;
  while (request === tourNavigation && pendingSnap.size) await sleep(50);
  if (request !== tourNavigation) return;
  await startTour({ index, manual: true });
}

function setTourPaused(paused) {
  tourPaused = paused;
  window.samestateTourVoice?.pause(paused);
  const button = $('#tourpause');
  button.textContent = paused ? 'Resume' : 'Pause';
  button.setAttribute('aria-pressed', String(paused));
  $('#tour').classList.toggle('paused', paused);
  updateTourNavigation();
}

// The demo opens with 5–7 seconds of logo and purpose while the sample site loads behind it. Its length follows the
// intro narration (clamped to 5–7 s); Pause holds it, and Skip intro, clicking it or a jump to a step ends it.
const INTRO = { title: 'Samestate' };
let introSkipped = false;
async function playIntro(id) {
  const el = $('#tour-intro'), clip = window.samestateDemoNarration?.clips.find(c => c.title === INTRO.title);
  const ms = Math.min(7000, Math.max(5000, (clip?.duration || 6) * 1000 + 250)) * tourPace;
  introSkipped = false;
  el.style.setProperty('--intro-ms', Math.round(ms) + 'ms');
  el.classList.remove('leaving', 'paused');
  el.hidden = false; void el.offsetWidth; el.classList.add('playing');
  $('#tour-callout').hidden = true;
  window.samestateTourVoice?.start(INTRO);
  const voice = () => window.samestateTourVoice?.get() || {};
  let end = ms, waitedForSound = false;
  for (let t = 0; (t < end || tourPaused) && !introSkipped; t += tourPaused ? 0 : 100) {
    if (!touring(id)) break;
    el.classList.toggle('paused', tourPaused);
    const v = voice();
    if (v.blocked) waitedForSound = true;
    else if (waitedForSound && v.title === INTRO.title && !v.paused) {
      // The browser held the narration until the visitor clicked; give the intro its full length from here.
      waitedForSound = false;
      end = t + ms;
      const bar = el.querySelector('.tour-intro-progress i');
      bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    }
    await sleep(100);
  }
  if (introSkipped || !touring(id)) window.samestateTourVoice?.stop();
  el.classList.add('leaving');
  await sleep(introSkipped ? 0 : 350);
  el.hidden = true; el.classList.remove('playing', 'leaving', 'paused');
  if (touring(id)) $('#tour-callout').hidden = false;
  return touring(id);
}
$('#tour-intro-skip').addEventListener('click', () => { introSkipped = true; });
// A click on the intro skips it, except the click that turned the sound on.
$('#tour-intro').addEventListener('click', event => { if (!event.target.closest('button') && Date.now() - (window.samestateTourVoice?.get().unlockedAt || 0) > 1000) introSkipped = true; });

async function startTour(options = {}) {
  if (!tourRunning && (window.samestateChecks?.running || window.samestateTest?.busy || window.wallCapture?.busy || sweepRun || pendingSnap.size)) return;
  if (tourRunning) endTour(false);
  tourNavigation++;
  const id = ++tour;
  await window.samestateTourFeatures?.reset();
  if (!touring(id)) return;
  const index = Number.isInteger(options.index) ? within(options.index, 0, STEPS.length - 1) : 0;
  tourManual = options.manual === true; tourAdvance = false; tourPhase = 'preparing'; tourStep = index;
  window.samestateTourFeatures?.begin();
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
  tourRunning = true;
  setTourPaused(false);
  tourPointer.hidden = true;
  tourPointer.className = 'tour-cursor';
  $('#tour').hidden = $('#tour-callout').hidden = $('#tourpause').hidden = false;
  $('#skip').textContent = 'Skip demo';
  $('#tourdots').innerHTML = STEPS.map(() => '<i></i>').join('');
  showTourLoading(index);
  const intro = index === 0 && !tourManual ? playIntro(id) : null; // plays while the sample site loads
  clearInterval(tourWatch);
  tourWatch = setInterval(placeTour, 120); // the wall scrolls and screens move, so the ring and the message keep up
  renderLeft(); setMode('grid'); $('#panel').hidden = true;
  $('#src').value = ''; await open(DEMO_URL);
  await until(id, () => target && active().length && active().every(d => d.ready), 15000);
  if (intro && !await intro) return;
  if (!await nap(id, tourManual ? 150 : intro ? 300 : 1200)) return;
  const t = {
    ok: () => touring(id), nap: ms => nap(id, ms), until: (ready, ms) => until(id, ready, ms),
    point: target => tourPoint(id, target), click: target => tourClick(id, target), focus: tourFocus
  };
  if (index > 0) await window.samestateTourFeatures?.prepareStep(STEPS[index].title, t);
  if (!touring(id)) return;
  for (let i = index; i < STEPS.length; i++) {
    const step = STEPS[i];
    tourAdvance = false; tourPhase = 'reading';
    await tourReveal(id, step.at);
    if (!touring(id)) return;
    showStep(i);
    window.samestateTourVoice?.start(step);
    tourFocus(step.at, step.side);
    // Time to read the message before the pointer moves.
    if (!tourManual && !await nap(id, Math.min(3000, 900 + step.text.split(' ').length * 70) * tourPace)) return;
    tourPhase = 'running'; updateTourNavigation();
    await step.run?.(t);
    if (!touring(id)) return;
    if (tourManual && !await nap(id, Math.min(step.wait, 900))) return;
    tourPhase = 'waiting';
    if (!tourManual && !await nap(id, step.wait * tourPace)) return;
    while (touring(id) && !tourAdvance && (tourPaused || window.samestateTourVoice?.waiting)) {
      if (!await nap(id, 100)) return;
    }
    if (!touring(id)) return;
    if (tourManual && !tourAdvance) setTourPaused(true);
    if (i === STEPS.length - 1) $('#tourpause').hidden = true;
    document.dispatchEvent(new CustomEvent('samestate-tour-step', { detail: { step: i + 1, title: step.title } })); // read by tests/smoke.mjs
    if (!await nap(id, 0)) return; // Pause holds this step's explanation, including after an async tool finishes.
  }
  tourFocus(null);
  tourRunning = false; tourPhase = 'complete'; updateTourNavigation();
}
function endTour(clear) {
  window.samestateFeatureHelp?.close(false);
  window.samestateTourVoice?.stop();
  if (tourRunning) { restoreDeviceIdentity(); restoreUiTheme(); } // skipped part-way, possibly after the identity or theme step
  const ended = ++tour;
  tourNavigation++; tourAdvance = false; tourPhase = 'idle';
  const cleanup = window.samestateTourFeatures?.reset();
  tourRunning = false;
  setTourPaused(false);
  clearInterval(tourWatch);
  tourAnchor = null;
  $('#tour').hidden = $('#tour-callout').hidden = $('#tour-ring').hidden = tourPointer.hidden = true;
  introSkipped = true; $('#tour-intro').hidden = true;
  $('#frames').classList.remove('tour-glide');
  document.querySelectorAll('.dev.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.tour-badge').forEach(badge => badge.remove());
  return Promise.resolve(cleanup).then(() => {
    if (clear && tour === ended) { openId++; target = previewUrl = textSalt = null; $('#match-text').checked = false; buildFrames(); $('#panel').hidden = true; $('#joblog').textContent = ''; $('#src').value = ''; $('#src').focus(); findings = []; lastScan = null; renderFindings(); $('#findings').innerHTML = '<p class="muted">Open a site, then press <b>Detect differences</b>.</p>'; }
  });
}
$('#tourpause').onclick = () => { if (tourPaused) tourManual = false; setTourPaused(!tourPaused); };
$('#tour-prev').onclick = () => goTourStep(tourStep - 1);
// During the intro, Next (or the right arrow) ends the intro and starts step 1 instead of jumping past it.
const introShowing = () => !$('#tour-intro').hidden && !introSkipped;
$('#tour-next').onclick = () => { if (introShowing()) introSkipped = true; else goTourStep(tourStep + 1); };
$('#tour-step').addEventListener('input', event => event.stopPropagation());
$('#tour-step').addEventListener('change', event => { event.stopPropagation(); goTourStep(Number(event.target.value)); });
$('#tour').addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('select,input,textarea,[contenteditable]')) return;
  const index = event.key === 'ArrowLeft' ? tourStep - 1 : event.key === 'ArrowRight' ? tourStep + 1 : event.key === 'Home' ? 0 : event.key === 'End' ? STEPS.length - 1 : null;
  if (index !== null) { event.preventDefault(); if (event.key === 'ArrowRight' && introShowing()) introSkipped = true; else goTourStep(index); }
});
let tourSwipe = null;
$('#tour').addEventListener('pointerdown', event => { tourSwipe = !event.target.closest('button,select,input,a') && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null; });
$('#tour').addEventListener('pointercancel', () => { tourSwipe = null; });
$('#tour').addEventListener('pointerup', event => {
  const start = tourSwipe; tourSwipe = null;
  if (!start || start.id !== event.pointerId) return;
  const dx = event.clientX - start.x, dy = event.clientY - start.y;
  if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.5) goTourStep(tourStep + (dx < 0 ? 1 : -1));
});
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
const pendingTest = new Map(); // test runs (testrun.js): answers to look and step, by request id
let testRecorder = null; // set by testrun.js while it records clicks and pages
function configure(device) {
  const inspect = device !== device.site?.singleDevice;
  post(device, 'config', {
    touch: device.touch, inspect, textSalt: inspect ? textSalt : null,
    pageSteps: pageSteps && !!device.step, themeCss: device.themeCss || '',
    longText: inspect && longText, variant: inspect ? screenVariant(device) : '',
    debug: [...debugTools(device)], sim: SIMS.has(debugSim(device)) ? debugSim(device) : '',
    lang: $('#screen-lang').value.trim(), grid: gridSettings, outline: device.outlineState || null
  });
}
const reportName = device => device.site ? screenName(device) + ' · ' + device.site.url.host : screenName(device);

function handleMessage(device, message) {
  if (!message?.__samestate) return;
  if (device === device.site?.singleDevice && message.type !== 'hello') return;
  switch (message.type) {
    case 'hello': {
      device.ready = true;
      device.loads = (device.loads || 0) + 1; // test runs wait for a screen that left its page to load the next one
      device.el.classList.add('ready');
      window.samestateOutline?.loaded(device);
      configure(device);
      if (device.design) post(device, 'design', { design: device.design });
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
    case 'outlined': case 'element-measured':
    case 'found': case 'breakpoints': case 'fingerprint': case 'page-size': case 'scrolled':
      if (typeof message.rid === 'string') asks.get(message.rid)?.(message);
      break;
    case 'inspection-pick':
      window.samestateOutline?.picked(device, message.data);
      break;
    case 'console':
      noteConsole(device, message);
      break;
    case 'filled':
      break; // forms were filled; the fields show it
    case 'peek':
      for (const other of device.site ? siteScreens(device.site) : active()) if (other !== device && other.ready && message.d) post(other, 'peek-twin', { d: message.d });
      break;
    case 'changed':
      if (debugTools(device).has('audible')) beep(device);
      break;
    case 'snapshot':
      pendingSnap.get(message.rid)?.(device, message.data);
      break;
    case 'looked':
    case 'stepped':
      if (typeof message.rid === 'string') pendingTest.get(message.rid)?.(message);
      break;
    case 'fixed':
      if (Number.isInteger(message.count)) fixCounts.set(message.id, (fixCounts.get(message.id) || 0) + message.count);
      break;
    case 'result':
      addResult(message, device);
      playbackResult(message, device);
      break;
    case 'act': {
      if ((!device.site && pageSteps) || !workspaceScreens().includes(device)) return;
      if (!Object.hasOwn(KIND_SYNC, message.kind) || !SYNC[KIND_SYNC[message.kind]][1]) return;
      setLeader(device);
      testRecorder?.(device, message);
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
const CATS = ['Content', 'Images', 'Typography', 'Layout', 'Tables', 'Navigation', 'Input', 'Usability', 'Accessibility', 'Errors', 'Meta', 'Network', 'Performance', 'Widths'];
// Network findings use resource timing sizes from each preview; request and response contents are never read.
const API_TYPES = new Set(['fetch', 'xmlhttprequest']);
const kb = bytes => !bytes ? '0 KB' : bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.ceil(bytes / 1024) + ' KB';
const weight = requests => requests.reduce((sum, r) => sum + r.bytes, 0);
const requestPath = url => url.replace(/^https?:\/\/[^/]+/, '') || '/';
const fileName = url => requestPath(url).split('/').filter(Boolean).pop() || '/';
const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
// Repeat requests for one address (video ranges, polling) count together, largest first.
const byAddress = requests => {
  const merged = new Map();
  for (const r of requests) if (r.bytes) { const e = merged.get(r.url) || { url: r.url, bytes: 0, n: 0 }; e.bytes += r.bytes; e.n++; merged.set(r.url, e); }
  return [...merged.values()].sort((a, b) => b.bytes - a.bytes);
};
const times = r => r.n > 1 ? ` (${r.n} requests)` : '';
const more = (arr, n = 3) => arr.slice(0, n).join(', ') + (arr.length > n ? ` +${arr.length - n} more` : '');
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
// Indexes of the longest run that keeps its order (longest increasing subsequence).
function keptInOrder(values) {
  const tails = [], prev = [], keep = new Set();
  values.forEach((v, idx) => { let lo = 0, hi = tails.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (values[tails[mid]] < v) lo = mid + 1; else hi = mid; } prev[idx] = lo ? tails[lo - 1] : -1; tails[lo] = idx; });
  for (let k = tails[tails.length - 1]; k !== undefined && k >= 0; k = prev[k]) keep.add(k);
  return keep;
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
    // ---- page weight
    const requests = data.requests || [], total = weight(requests), sizeOf = new Map(requests.map(r => [r.url, r.bytes]));
    const imageLabel = i => q(i.src ? fileName(i.src) : i.name) + (i.src && sizeOf.get(i.src) ? ` (${kb(sizeOf.get(i.src))})` : '');
    if (requests.length) {
      const api = requests.filter(r => API_TYPES.has(r.type)), origin = new URL(requests[0].url).origin;
      const unsized = requests.filter(r => !r.bytes && !r.url.startsWith(origin + '/')).length; // other sites hide sizes without Timing-Allow-Origin
      add('info', 'Network', dev, 'Page weight', `Downloads ${kb(total)} in ${plural(requests.length, 'request')}`,
        `${plural(api.length, 'API call')}` + (unsized ? `. ${plural(unsized, 'request')} to other sites ${unsized === 1 ? 'has' : 'have'} no size, so the real total is higher.` : '.'));
      const bigApi = api.filter(r => r.bytes >= 100 * 1024);
      if (bigApi.length) add('info', 'Network', dev, 'Large API responses', `${plural(bigApi.length, 'API response')} over 100 KB`, more(byAddress(bigApi).map(r => `${q(requestPath(r.url))} ${kb(r.bytes)}${times(r)}`)));
    }
    const images = [...I.values()].filter(i => i.cat === 'image' && i.loaded);
    const unseen = images.filter(i => !i.boxed);
    if (unseen.length) add('warn', 'Network', dev, 'Hidden images still downloaded', `${plural(unseen.length, 'hidden image')} still downloaded`, 'Hidden on this screen but loaded anyway: ' + more(unseen.map(imageLabel)));
    const ratio = dev.kind === 'phone' ? 3 : 2; // the sharpest screens of each kind
    const oversized = vis.filter(i => i.cat === 'image' && i.loaded && i.natW && !/\.svg$/i.test(i.src || '') && i.natW > i.w * ratio * 1.5 && i.natW - i.w * ratio >= 400);
    if (oversized.length) add('warn', 'Network', dev, 'Images larger than shown', `${plural(oversized.length, 'image')} much larger than shown`, more(oversized.map(i => `${imageLabel(i)} ${i.natW}px wide, shown at ${i.w}px (${Math.round(i.w * ratio)}px covers a ${ratio}× screen)`)), oversized.map(i => i.key));
    // ---- accessibility
    const hiddenFocus = data.hiddenFocus || [];
    if (hiddenFocus.length) {
      const where = Object.entries(hiddenFocus.reduce((n, h) => ({ ...n, [h.reason]: (n[h.reason] || 0) + 1 }), {})).map(([reason, n]) => `${n} in ${reason === 'transparent' ? 'a transparent layer' : reason === 'off-screen panel' ? 'an off-screen panel' : 'a ' + reason}`);
      add('warn', 'Accessibility', dev, 'Keyboard reaches hidden controls', `${plural(hiddenFocus.length, 'hidden control')} reachable with Tab`, `${where.join(', ')}: ${list(hiddenFocus.map(h => h.kind), 4)}. Keyboard users land on controls they can't see.`);
    }
    const tabbable = vis.filter(i => Number.isInteger(i.dom) && !i.pinned).sort((a, b) => a.dom - b.dom).slice(0, 300);
    const visual = [...tabbable].sort((a, b) => {
      const rows = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y), cols = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (rows > .3 * Math.min(a.h, b.h)) return cols > 0 ? a.dom - b.dom : a.x - b.x; // overlapping boxes have no visual order of their own
      return a.y - b.y;
    });
    const kept = keptInOrder(visual.map(i => i.dom));
    const jumps = visual.filter((_, k) => !kept.has(k));
    if (tabbable.length >= 4 && jumps.length && jumps.length <= tabbable.length / 2) add('warn', 'Accessibility', dev, 'Tab order differs from what you see', `Tab order skips around for ${plural(jumps.length, 'control')}`, `The Tab key reaches these in a different order than they appear: ${list(jumps.map(i => i.name))}`, jumps.map(i => i.key));
    const lowContrast = vis.filter(i => i.contrast && i.contrast < (i.large ? 3 : 4.5)).sort((a, b) => a.contrast - b.contrast);
    if (lowContrast.length) add(lowContrast.some(i => i.contrast < (i.large ? 2 : 3)) ? 'issue' : 'warn', 'Accessibility', dev, 'Low contrast text', `${plural(lowContrast.length, 'text element')} below WCAG contrast`,
      more(lowContrast.map(i => `${q(i.name)} ${i.contrast}:1, needs ${i.large ? 3 : 4.5}:1`)) + '. Text over images and gradients is not checked.', lowContrast.map(i => i.key));
    const noAlt = vis.filter(i => i.cat === 'image' && i.noAlt);
    if (noAlt.length) add('issue', 'Accessibility', dev, 'Images without alt text', `${plural(noAlt.length, 'image')} without alt text`, 'Screen readers read out the file name or skip them. Use alt="" for decorative images.', noAlt.map(i => i.key));
    const unnamed = vis.filter(i => i.unnamed && (i.cat === 'link' || i.cat === 'button' || i.cat === 'input'));
    if (unnamed.length) add('issue', 'Accessibility', dev, 'Controls without a name', `${plural(unnamed.length, 'control')} without an accessible name`, `${list(unnamed.map(i => i.kind || i.cat), 4)}: screen readers announce only the role. Add visible text, a label or aria-label.`, unnamed.map(i => i.key));
    const headings = vis.filter(i => i.cat === 'heading');
    if (!headings.some(h => h.level === 1)) add('warn', 'Accessibility', dev, 'No main heading', 'No visible main heading (h1)', headings.length ? `The first heading on this screen is an h${headings[0].level}.` : 'This screen shows no headings, so screen reader users cannot jump through the page.');
    const skips = headings.filter((h, k) => k > 0 && h.level > headings[k - 1].level + 1);
    if (skips.length) add('warn', 'Accessibility', dev, 'Heading levels skip', `Heading levels skip ${plural(skips.length, 'time')}`, more(skips.map(h => `h${headings[headings.indexOf(h) - 1].level} → h${h.level}`)), skips.map(i => i.key));
    if (data.lang === false) add('warn', 'Accessibility', dev, 'Page has no language', 'Page has no language set', 'Add lang to the html element so screen readers pronounce the page correctly.');
    if (dev.touch && data.zoomBlocked) add('issue', 'Accessibility', dev, 'Zoom is turned off', 'Pinch zoom is turned off', 'The viewport tag sets user-scalable=no or a maximum-scale under 2, so people who need larger text cannot zoom.');
    // ---- links (with Check links on)
    const links = data.links;
    if (links?.broken.length) add('issue', 'Navigation', dev, 'Broken links', `${plural(links.broken.length, 'broken link')}`, more(links.broken.map(b => `${q(requestPath(b.url))} answers ${b.status}`)), links.broken.map(b => b.key));
    if (links && links.checked < links.total) add('info', 'Navigation', dev, 'Links not checked', `${plural(links.total - links.checked, 'link')} not checked in time`, `Checked ${links.checked} of ${links.total} links on this site.`);
    // ---- Web Vitals
    const v = data.vitals;
    if (v) {
      const sec = ms => (ms / 1000).toFixed(1) + ' s';
      const hidden = v.drawn === false && !v.cls; // Chrome was not drawing this preview, so shifts would not have been recorded
      add('info', 'Performance', dev, 'Web Vitals', `LCP ${v.lcp ? sec(v.lcp) : 'not measured'} · CLS ${hidden ? 'not measured' : v.cls.toFixed(2)} · slowest interaction ${v.inp ? v.inp + ' ms' : 'none yet'}`,
        (hidden ? 'Chrome is not drawing this preview while it is out of view, so it records no paints or layout shifts. Scroll it into view and detect again. ' : '')
        + 'LCP is measured while every preview loads at once, and previews off screen paint late, so it is shown here but never flagged. Layout shifts and interactions are flagged.', v.shifted);
      if (v.cls > .1) add(v.cls > .25 ? 'issue' : 'warn', 'Performance', dev, 'Layout shifts', `Layout shifts by ${v.cls.toFixed(2)} (CLS)`, 'Good is under 0.1. Content moves after it appears: reserve space for images, ads and late content.', v.shifted);
      if (v.inp > 200) add(v.inp > 500 ? 'issue' : 'warn', 'Performance', dev, 'Slow interaction', `Slowest interaction took ${v.inp} ms`, 'Good is under 200 ms (INP): the page took this long to show the result of a click or key press here.');
    }
    // ---- outline: landmarks, links and form fields
    const o = data.outline;
    if (o) {
      const L = o.landmarks;
      if (!L.main) add('warn', 'Accessibility', dev, 'No main landmark', 'No main landmark', 'Add a main element (or role=main) so screen reader users can jump straight to the content.');
      else if (L.main > 1) add('warn', 'Accessibility', dev, 'More than one main landmark', `${L.main} main landmarks`, 'A page should have one main landmark.');
      if (L.banner > 1 || L.contentinfo > 1) add('info', 'Accessibility', dev, 'Repeated header or footer landmark', `${L.banner} header and ${L.contentinfo} footer landmarks`, 'A page should have at most one page-level header (banner) and footer (contentinfo).');
      if (L.navigation > 1 && o.unlabeledNav) add('warn', 'Accessibility', dev, 'Navigation landmarks without a label', `${plural(o.unlabeledNav, 'navigation landmark')} without a label`, `This screen has ${L.navigation} navigation landmarks. Give each an aria-label, like “Main” and “Footer”, so they can be told apart.`);
      if (o.vague.length) add('warn', 'Accessibility', dev, 'Links with vague text', `${plural(o.vague.length, 'link')} with vague text`, `${list(o.vague.map(v => v.phrase))}: link text should say where the link goes.`, o.vague.map(v => v.key));
      if (o.sameText.length) add('info', 'Accessibility', dev, 'Same link text, different pages', `${plural(o.sameText.length, 'link text')} used for different pages`, 'Links with the same text should go to the same page, or say how they differ.', o.sameText.map(v => v.key));
      if (o.placeholderOnly.length) add('warn', 'Accessibility', dev, 'Fields labelled only by a placeholder', `${plural(o.placeholderOnly.length, 'field')} labelled only by a placeholder`, 'The placeholder disappears once someone types. Add a visible label.', o.placeholderOnly);
      if (o.autocomplete.length) add('warn', 'Usability', dev, 'Unknown autocomplete values', `${plural(o.autocomplete.length, 'field')} with an unknown autocomplete value`, `${list(o.autocomplete.map(a => a.token))}: browsers ignore it, so autofill and password managers can't help.`, o.autocomplete.map(a => a.key));
      if (o.positiveTabindex.length) add('warn', 'Accessibility', dev, 'Positive tabindex', `${plural(o.positiveTabindex.length, 'element')} with a positive tabindex`, 'Tab visits these first, out of the page order. Use tabindex="0", or change the order in the HTML.', o.positiveTabindex);
    }
    // ---- line length (WCAG 1.4.8: at most 80 characters)
    const longLines = vis.filter(i => i.cpl > 80).sort((a, b) => b.cpl - a.cpl);
    if (longLines.length) add('warn', 'Typography', dev, 'Lines too long', `${plural(longLines.length, 'paragraph')} with lines over 80 characters`, more(longLines.map(i => `${q(i.name)} about ${i.cpl} per line`)) + '. 45–75 characters is easiest to read; limit the width, for example max-width: 70ch.', longLines.map(i => i.key));
    // ---- errors from the page
    const errs = data.errors || [], jsErrors = errs.filter(e => e.kind !== 'resource'), failed = errs.filter(e => e.kind === 'resource');
    const refErrors = (ref.data.errors || []).filter(e => e.kind !== 'resource').length;
    if (jsErrors.length) add('issue', 'Errors', dev, 'JavaScript errors', `${plural(jsErrors.reduce((n, e) => n + e.count, 0), 'JavaScript error')}`, more(jsErrors.map(e => q(e.message)), 2) + (dev !== ref.dev && !refErrors ? ` None on ${screenName(ref.dev)}.` : '') + ' See the Console panel.');
    if (failed.length) add('warn', 'Errors', dev, 'Files that failed to load', `${plural(failed.length, 'file')} failed to load`, more(failed.map(e => q(e.message.replace(/^\w+ failed to load:? (\(\d+\): )?/, ''))), 3));
    // ---- meta tags, once: they belong to the page, not the screen size
    if (dev === ref.dev && data.meta) for (const f of metaFindings(data.meta)) add(f.sev, 'Meta', dev, f.kind, f.title, f.detail);
    if (dev === ref.dev) continue;
    // ---- compared with the reference device
    const rn = screenName(ref.dev);
    const refRequests = ref.data.requests || [], refTotal = weight(refRequests);
    if ((dev.kind === 'phone' || dev.kind === 'tablet') && ref.dev.kind === 'desktop' && refTotal >= 300 * 1024 && total >= refTotal * .85) {
      const largest = byAddress(requests).map(r => `${q(fileName(r.url))} ${kb(r.bytes)}${times(r)}`);
      add('warn', 'Network', dev, `Downloads as much as ${rn}`, `Downloads ${Math.round(total / refTotal * 100)}% of what ${rn} does`, `${kb(total)} here, ${kb(refTotal)} on ${rn}. Largest: ${more(largest)}`);
    }
    const matches = matchItems(R, I);
    for (const [referenceItem, item] of matches) referenceKeys.set(item.key, referenceItem.key);
    // ---- above the fold: what the reference shows on its first screen, this screen makes you scroll to
    if (ref.data.vh && data.vh) {
      const firstScreen = ([r, i], cats) => cats.includes(r.cat) && !r.inNav && !r.inline && r.y + r.h <= ref.data.vh && i.y + i.h > data.vh;
      const below = [...matches].filter(([r, i]) => r.visible && i.visible && r.w * r.h >= 1800 && firstScreen([r, i], ['button', 'link', 'input']));
      const heading = [...matches].find(([r, i]) => r.visible && i.visible && r.level === 1 && firstScreen([r, i], ['heading']));
      const screens = i => i.y < data.vh ? 'cut off by the bottom of the screen' : (i.y / data.vh).toFixed(1) + ' screens down';
      if (below.length) add('warn', 'Layout', dev, 'Key controls below the fold', `${plural(below.length, 'control')} from ${rn}'s first screen ${below.length === 1 ? 'needs' : 'need'} scrolling`, more(below.map(([, i]) => `${q(i.name)} ${screens(i)}`)), below.map(p => p[1].key));
      if (heading) add('info', 'Layout', dev, 'Main heading below the fold', 'Main heading below the fold', `On ${rn} it is on the first screen; here it is ${screens(heading[1])}.`, [heading[1].key]);
    }
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
  if (sweepRun || journeyRunning) return; // screens are being resized; their own report replaces this one
  const devs = workspaceScreens();
  if (!devs.length) return;
  $('#detect span').textContent = 'Measuring…';
  const scanSalt = textSalt;
  const scanPreview = openId;
  const scanWall = wallRevision;
  const ready = devs.filter(d => d.ready);
  const links = $('#check-links').checked;
  const measured = ready.length ? await snapshotScreens(ready, links ? 9000 : 4000, { links }) : new Map();
  if (scanSalt !== textSalt || scanPreview !== openId || scanWall !== wallRevision || sweepRun || journeyRunning) { $('#detect span').textContent = 'Detect differences'; return; }
  const snaps = [...measured].map(([dev, data]) => ({ dev, data })).sort((a, b) => a.dev.slot - b.dev.slot);
  const ref = $('#ref').value;
  findings = sitesMode ? sitePanels.flatMap(site => analyze(snaps.filter(s => s.dev.site === site), ref)) : analyze(snaps, ref);
  const metaFrom = snaps.find(s => s.dev.id === ref) || snaps[0];
  if (metaFrom?.data?.meta) { lastMeta = metaFrom.data.meta; renderMeta(); }
  lastScan = { at: new Date(), screens: snaps.map(s => s.dev), missing: devs.filter(d => !measured.has(d)), links };
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

// Screens the last scan could not measure (no answer in time). Without this a partial scan reads as a clean one.
function scanNote() {
  const missing = lastScan?.missing || [];
  if (!missing.length) return '';
  const names = missing.map(d => esc(reportName(d)));
  return `<p class="scan-note"><b>Not measured:</b> ${names.slice(0, 6).join(', ')}${names.length > 6 ? ` +${names.length - 6} more` : ''}. ${missing.length === 1 ? 'It' : 'They'} did not answer in time, so ${missing.length === 1 ? 'it is' : 'they are'} not in this report. <button type="button" class="link" data-rescan>Detect again</button></p>`;
}
function renderFindings() {
  const order = SEVERITY;
  renderBaseline(compareBaseline());
  const byIssue = reportView === 'issue';
  findings.forEach((f, i) => { f.i = i; });
  const groups = issueGroups(findings);
  const counted = byIssue ? groups : findings;
  const count = cat => counted.filter(item => !cat || item.cat === cat).length;
  const cats = CATS.filter(c => findings.some(f => f.cat === c));
  if (catFilter && !cats.includes(catFilter)) catFilter = null; // a filter left over from another scan
  $('#report-bar').hidden = !findings.length;
  document.querySelectorAll('#report-view button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === reportView)));
  $('#chips').innerHTML = cats.length ? `<button class="chip ${!catFilter ? 'on' : ''}" data-cat="">All ${count()}</button>` + cats.map(c => `<button class="chip ${catFilter === c ? 'on' : ''}" data-cat="${c}">${c} ${count(c)}</button>`).join('') : '';
  $('#diffn').textContent = counted.length || '';
  const shown = findings.filter(f => (!catFilter || f.cat === catFilter) && (!newOnly || f.isNew));
  const note = scanNote();
  if (!shown.length) { $('#findings').innerHTML = note + `<p class="muted">No differences found ${note ? 'on the screens that were measured' : 'for this view'}.</p>`; return; }
  const screens = sitesMode ? workspaceScreens() : viewScreens();
  let html = note;
  if (byIssue) {
    reportGroups = groups.filter(g => (!catFilter || g.cat === catFilter) && (!newOnly || g.items.some(f => f.isNew)));
    for (const site of sitesMode ? sitePanels : [null]) {
      const own = reportGroups.filter(g => g.site === site);
      if (!own.length) continue;
      const c = s => own.filter(g => g.sev === s).length;
      const reference = own[0].items[0].reference;
      const compared = (reference.journeyRef ? 'Each step compared with ' + reference.journeyRef : 'Compared with ' + screenName(reference)) + (own[0].cat === 'Widths' ? ' · width sweep' : '');
      const name = site ? `Site ${sitePanels.indexOf(site) + 1} · ${site.url.origin === EXT ? 'Demo' : site.url.host} · ${compared}` : compared;
      html += `<div class="group">${esc(name)}<small>${c('issue')} issues · ${c('warn')} warnings · ${c('info')} adaptations</small></div>`;
      for (const g of own) {
        const pick = g.screens.includes(pickedScreen.get(g.key)) ? pickedScreen.get(g.key) : g.screens[0];
        const details = g.items.filter(f => f.dev === pick).map(f => (f.title === g.kind ? '' : f.title + '. ') + f.detail);
        const fresh = g.items.filter(f => f.isNew).length;
        html += `<div class="finding ${g.sev} grouped" data-g="${reportGroups.indexOf(g)}"><div class="t">${esc(g.kind)}${fresh ? `<span class="new-tag">New${fresh < g.items.length ? ' on ' + fresh : ''}</span>` : ''}<span class="c">${g.cat}</span></div>`
          + `<div class="screens" role="group" aria-label="Screens with this finding">${g.screens.map((d, s) => `<button type="button" class="screen-chip${d === pick ? ' on' : ''}" data-s="${s}" aria-pressed="${d === pick}" title="Show details for ${esc(screenName(d))}">${esc(screenName(d))}</button>`).join('')}</div>`
          + details.map((detail, k) => `<div class="d">${k ? '' : `<b>${esc(screenName(pick))}:</b> `}${esc(detail)}</div>`).join('') + fixHtml(g.kind, g.items) + '</div>';
      }
    }
    $('#findings').innerHTML = html;
    return;
  }
  for (const d of screens) {
    const fs = shown.filter(f => f.dev === d).sort((a, b) => order[a.sev] - order[b.sev]); if (!fs.length) continue;
    const c = s => fs.filter(f => f.sev === s).length;
    html += `<div class="group">${esc(reportName(d))}<small>${c('issue')} issues · ${c('warn')} warnings · ${c('info')} adaptations</small></div>` +
      fs.map(f => `<div class="finding ${f.sev}" data-i="${f.i}"><div class="t">${esc(f.title)}${f.isNew ? '<span class="new-tag">New</span>' : ''}<span class="c">${f.cat}</span></div><div class="d">${esc(f.detail)}</div>${fixHtml(f.kind, [f])}</div>`).join('');
  }
  $('#findings').innerHTML = html;
}
$('#findings').addEventListener('click', e => { if (e.target.closest('[data-rescan]')) detect(); });
$('#chips').addEventListener('click', e => { if (e.target.dataset.cat !== undefined) { catFilter = e.target.dataset.cat || null; renderFindings(); } });
$('#report-view').addEventListener('click', e => {
  const view = e.target.closest('button')?.dataset.view;
  if (!view || view === reportView) return;
  reportView = view;
  try { localStorage.setItem('samestate.reportView', view); } catch {}
  renderFindings();
});
/* ------------------------------ fix previews ------------------------------ */
// CSS that usually fixes a finding, set on that finding's elements in every affected preview until Undo.
const FIX_CSS = {
  'Page scrolls sideways': { 'max-width': '100%', 'box-sizing': 'border-box', 'overflow-wrap': 'anywhere' },
  'Table is wider than its container': { display: 'block', 'max-width': '100%', 'overflow-x': 'auto' },
  'Text cut off': { 'white-space': 'normal', 'text-overflow': 'clip', '-webkit-line-clamp': 'unset', overflow: 'visible' },
  'Tap targets under 24px': { 'min-width': '44px', 'min-height': '44px', display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center' },
  'Tap targets under 40px': { 'min-width': '44px', 'min-height': '44px', display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center' },
  'Text under 12px': { 'font-size': '12px' },
  'Fields under 16px font': { 'font-size': '16px' },
  'Text touches the screen edge': { 'padding-inline': '16px', 'box-sizing': 'border-box' },
  'Images stretched beyond source size': { 'max-width': '100%', height: 'auto', 'object-fit': 'contain' }
};
const FIX_ADVICE = [
  ['Hidden images still downloaded', 'Add loading="lazy" to these images, or use <picture> with a media query so this screen never fetches them.'],
  ['Images larger than shown', 'Add srcset with smaller widths and a sizes attribute, so each screen downloads the size it shows.'],
  ['Downloads as much as', 'Load below-the-fold images lazily, split scripts this screen doesn’t run, and send smaller images to narrow screens.'],
  ['Large API responses', 'Ask the API for only the fields this screen shows, or page the results.'],
  ['Keyboard reaches hidden controls', 'Add the inert attribute (or visibility: hidden) to menus and panels while they are closed.'],
  ['Tab order differs from what you see', 'Match the HTML order to the visual order instead of reordering with CSS order, flex-direction or grid placement.'],
  ['Key controls below the fold', 'Move the main action up on small screens, or shorten what comes before it (hero image, intro text).'],
  ['Overlay hides controls', 'Give the banner a smaller footprint on phones, or add bottom padding to the page while it is shown.'],
  ['No viewport meta tag', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.']
];
const appliedFixes = new Map(), fixCounts = new Map(); // finding kind → screens with the fix on; fix id → elements changed
const fixCss = declarations => Object.entries(declarations).map(([p, v]) => `${p}: ${v};`).join(' ');
function fixHtml(kind, items) {
  const css = FIX_CSS[kind], advice = FIX_ADVICE.find(([start]) => kind.startsWith(start))?.[1];
  if (!css && !advice) return '';
  const hasElements = items.some(f => f.keys.length);
  return '<div class="fix">' + (css ? `<code>${esc(fixCss(css))}</code><button type="button" class="pill fix-btn" data-fix${hasElements ? '' : ' disabled title="No elements to change on these screens"'}>${appliedFixes.has(kind) ? 'Undo fix' : 'Preview fix'}</button>` : '')
    + (advice ? `<p>${esc(advice)}</p>` : '') + '</div>';
}
function toggleFix(items) {
  const kind = items[0].kind, id = 'fix:' + kind;
  if (appliedFixes.has(kind)) {
    for (const d of appliedFixes.get(kind)) post(d, 'unfix', { id });
    appliedFixes.delete(kind);
  } else if (FIX_CSS[kind]) {
    fixCounts.delete(id);
    for (const f of items) if (f.keys.length) post(f.dev, 'fix', { id, keys: f.keys, css: FIX_CSS[kind] });
    appliedFixes.set(kind, new Set(items.map(f => f.dev)));
  }
  renderFindings();
}
function undoAllFixes() {
  for (const [kind, screens] of appliedFixes) for (const d of screens) post(d, 'unfix', { id: 'fix:' + kind });
  appliedFixes.clear();
  renderFindings();
}

/* ------------------------------ baseline ------------------------------ */
// A saved scan for this site; later scans mark what is new and list what is gone.
let newOnly = false;
const baselineKey = () => 'samestate.baseline.' + (sitesMode ? sitePanels.map(site => site.url?.origin).join('|') : target);
const findingId = f => reportName(f.dev) + '|' + f.kind;
const LINK_KINDS = new Set(['Broken links', 'Links not checked']); // only judged when Check links was on for the scan
function loadBaseline() { try { return JSON.parse(localStorage.getItem(baselineKey()) || 'null'); } catch { return null; } }
function saveBaseline() {
  const items = findings.map(f => ({ id: findingId(f), kind: f.kind, screen: reportName(f.dev), sev: f.sev }));
  try { localStorage.setItem(baselineKey(), JSON.stringify({ at: Date.now(), items })); } catch {}
  newOnly = false;
  renderFindings();
}
function clearBaseline() { try { localStorage.removeItem(baselineKey()); } catch {} newOnly = false; renderFindings(); }
function compareBaseline() {
  const baseline = lastScan && target ? loadBaseline() : null;
  for (const f of findings) f.isNew = false;
  if (!baseline) return null;
  const before = new Set(baseline.items.map(item => item.id)), now = new Set(findings.map(findingId));
  for (const f of findings) f.isNew = !before.has(findingId(f));
  const measured = new Set(lastScan.screens.map(reportName));
  const missing = new Set((lastScan.missing || []).map(reportName));
  const fixed = baseline.items.filter(item => measured.has(item.screen) && !missing.has(item.screen) && !now.has(item.id) && (lastScan.links || !LINK_KINDS.has(item.kind)));
  return { at: new Date(baseline.at), added: findings.filter(f => f.isNew).length, fixed, unchanged: findings.length - findings.filter(f => f.isNew).length };
}
function renderBaseline(state) {
  const bar = $('#baseline');
  bar.hidden = !findings.length && !state; // nothing to save, and nothing to compare with
  if (bar.hidden) return;
  const fixes = appliedFixes.size ? `<p class="fix-line">${plural(appliedFixes.size, 'fix preview')} on. <button type="button" class="link" data-baseline="recheck">Check again</button> · <button type="button" class="link" data-baseline="undo-fixes">Undo all</button></p>` : '';
  if (!state) { bar.innerHTML = `<button type="button" class="pill" data-baseline="save" title="Later scans of this site mark what is new and what is fixed">Save as baseline</button>` + fixes; return; }
  const when = state.at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const gone = state.fixed.length ? `<details><summary>${state.fixed.length} fixed</summary><ul>${state.fixed.slice(0, 40).map(item => `<li>${esc(item.kind)} <span class="muted">· ${esc(item.screen)}</span></li>`).join('')}</ul></details>` : '<span>0 fixed</span>';
  bar.innerHTML = `<div class="baseline-line"><b>Since baseline</b> <span class="muted">${esc(when)}</span></div>`
    + `<div class="baseline-line"><button type="button" class="chip${newOnly ? ' on' : ''}" data-baseline="new"${state.added ? '' : ' disabled'}>${state.added} new</button>${gone}<span>${state.unchanged} unchanged</span></div>`
    + `<div class="baseline-line"><button type="button" class="link" data-baseline="save">Replace baseline</button> · <button type="button" class="link" data-baseline="clear">Clear</button></div>` + fixes;
}
$('#baseline').addEventListener('click', e => {
  const action = e.target.closest('[data-baseline]')?.dataset.baseline;
  if (action === 'save') saveBaseline();
  else if (action === 'clear') clearBaseline();
  else if (action === 'new') { newOnly = !newOnly; renderFindings(); }
  else if (action === 'recheck') detect(true);
  else if (action === 'undo-fixes') undoAllFixes();
});

/* ------------------------------ snapshots of several screens ------------------------------ */
function snapshotScreens(screens, ms = 5000, options = {}) {
  const rid = crypto.randomUUID(), out = new Map();
  let answered = 0;
  return new Promise(done => {
    const finish = () => { pendingSnap.delete(rid); clearTimeout(timer); done(out); };
    pendingSnap.set(rid, (d, data) => { if (data) out.set(d, data); if (++answered >= screens.length) finish(); });
    const timer = setTimeout(finish, ms);
    screens.forEach(d => post(d, 'snapshot', { rid, ...options }));
  });
}
const settle = ms => new Promise(done => setTimeout(done, ms)); // a snapshot forces layout; this gives the page's resize handlers time to run

/* ------------------------------ breakpoint sweep ------------------------------ */
// Resizes the reference screen from 320px to 1920px, checks it at each width and narrows every change down to
// the pixel, so the report says where a problem starts and stops instead of which preset happens to show it.
let sweepRun = 0;
// 320–1000 every 10px, then to 1920 every 20px. Changes between two sampled widths are narrowed to the pixel; a problem that
// starts and stops between two of them (narrower than 10px, or 20px above 1000px) is not seen.
const SWEEP_WIDTHS = [...Array(69)].map((_, k) => 320 + k * 10).concat([...Array(46)].map((_, k) => 1000 + (k + 1) * 20));
async function sweepWidths() {
  const button = $('#sweep'), label = button.querySelector('span');
  if (sweepRun) { sweepRun = 0; return; } // a second press stops it
  const d = active().find(x => x.id === $('#ref').value && x.ready) || active().find(x => x.ready);
  if (!d || sitesMode) { label.textContent = sitesMode ? 'Turn off Compare sites to sweep' : 'Open a site first'; setTimeout(() => { label.textContent = 'Sweep widths'; }, 2500); return; }
  const run = sweepRun = Date.now(), scan = openId, probes = new Map(), missingWidths = new Set();
  const probe = async w => {
    if (probes.has(w)) return probes.get(w);
    if (sweepRun !== run || scan !== openId || !d.el) throw new Error('stopped');
    label.textContent = `Stop sweep · ${w}px`;
    d.sweepW = w; layout(d);
    await settle(160);
    const data = (await snapshotScreens([d], 4000)).get(d);
    const kinds = new Map();
    if (!data) missingWidths.add(w);
    if (data) {
      const probeScreen = { ...d, sweepW: w }; // the screen keeps its own kind: touch checks don't switch on and off with width
      for (const f of analyze([{ dev: probeScreen, data }], probeScreen.id)) if (!['Network', 'Performance', 'Meta', 'Errors'].includes(f.cat) && !kinds.has(f.kind)) kinds.set(f.kind, f);
    }
    probes.set(w, kinds);
    return kinds;
  };
  const same = (a, b) => a.size === b.size && [...a.keys()].every(k => b.has(k));
  button.classList.add('busy');
  try {
    for (const w of SWEEP_WIDTHS) await probe(w);
    let budget = 200; // bisect every change between two sampled widths, down to one pixel
    const bisect = async (a, b) => {
      if (b - a <= 1 || budget-- <= 0) return;
      const m = (a + b) >> 1, mid = await probe(m);
      if (!same(probes.get(a), mid)) await bisect(a, m);
      if (!same(mid, probes.get(b))) await bisect(m, b);
    };
    for (let k = 1; k < SWEEP_WIDTHS.length; k++) if (!same(probes.get(SWEEP_WIDTHS[k - 1]), probes.get(SWEEP_WIDTHS[k]))) await bisect(SWEEP_WIDTHS[k - 1], SWEEP_WIDTHS[k]);
  } catch {}
  const finished = sweepRun === run && scan === openId;
  d.sweepW = null;
  if (d.el) { layout(d); fitWall(d.site); }
  sweepRun = 0; button.classList.remove('busy'); label.textContent = 'Sweep widths';
  if (!finished) return { complete: false, widths: probes.size, missing: [...missingWidths] };
  const widths = [...probes.keys()].sort((a, b) => a - b), kinds = new Map();
  for (const w of widths) for (const [kind, f] of probes.get(w)) if (!kinds.has(kind)) kinds.set(kind, f);
  const swept = [];
  for (const [kind, sample] of kinds) {
    const ranges = [];
    for (const w of widths) {
      const on = probes.get(w).has(kind), last = ranges[ranges.length - 1];
      if (on && last && last.open) last.to = w; else if (on) ranges.push({ from: w, to: w, open: true }); else if (last) last.open = false;
    }
    const text = ranges.map(r => r.from === r.to ? r.from + 'px' : `${r.from}–${r.to}px`).join(', ');
    const reflow = kind === 'Page scrolls sideways' && ranges.some(r => r.from <= 320) ? ' At 320px this fails WCAG 1.4.10 Reflow.' : '';
    swept.push({ sev: sample.sev, cat: 'Widths', dev: d, kind, title: `${kind} at ${text}`, detail: `At ${ranges[0].from}px: ${sample.title}. ${sample.detail}${reflow}`, keys: [], refKeys: [], reference: d });
  }
  findings = [...findings.filter(f => f.cat !== 'Widths'), ...swept];
  lastScan = lastScan || { at: new Date(), screens: [d] };
  catFilter = swept.length ? 'Widths' : catFilter;
  renderFindings(); showTab('diff');
  $('#sweep-status').textContent = `Checked ${widths.length} widths from 320 to 1920px on ${screenName(d)}: ${plural(swept.length, 'finding')}.` + (missingWidths.size ? ` ${missingWidths.size} widths not measured.` : '');
  return { complete: true, widths: widths.length, missing: [...missingWidths] };
}

/* ------------------------------ journey report ------------------------------ */
// Page steps on every selected device: each step is measured at each device's size and compared with the same
// step on the reference device, so the report says which step breaks on which screens.
let journeyRunning = false;
async function journeyReport() {
  if (journeyRunning || !pageSteps || sitesMode) return;
  const steps = pageScreens.filter(d => d.el), devices = DEVICES.filter(d => d.on);
  const status = $('#page-steps-status');
  if (!steps.length || !devices.length) { status.textContent = 'Open a step and select devices first.'; return; }
  journeyRunning = true;
  const saved = sharedDeviceId, scan = openId, data = new Map(); // "step|device" → snapshot
  const refDevice = devices.find(d => d.id === 'desktop') || devices.find(d => d.kind === 'desktop') || devices[0];
  try {
    for (const [n, device] of devices.entries()) {
      if (scan !== openId || !pageSteps) throw new Error('stopped');
      status.textContent = `Checking the journey on ${device.name} (${n + 1} of ${devices.length})…`;
      sharedDeviceId = device.id; $('#shared-device').value = device.id;
      for (const d of steps) d.rot = false;
      refreshViews();
      await settle(700);
      const ready = steps.filter(d => d.ready);
      if (!ready.length) continue;
      const snaps = await snapshotScreens(ready, 6000);
      for (const [d, snap] of snaps) data.set(d.id + '|' + device.id, snap);
    }
  } catch {}
  sharedDeviceId = saved; $('#shared-device').value = saved;
  refreshViews();
  journeyRunning = false;
  if (scan !== openId || !pageSteps) { status.textContent = ''; return; }
  const screens = [], missing = [];
  const out = steps.flatMap((step, k) => {
    const snaps = devices.map((device, j) => {
      const dev = { ...step, id: step.id + '@' + device.id, kind: device.kind, os: device.os, touch: device.kind !== 'desktop', slot: k * 1000 + j, label: `Step ${step.step} · ${device.name}`, journeyRef: device.name, fixedSize: { w: device.w, h: device.h } };
      const snap = data.get(step.id + '|' + device.id);
      (snap ? screens : missing).push(dev);
      return { dev, data: snap };
    }).filter(s => s.data);
    return analyze(snaps, step.id + '@' + refDevice.id);
  });
  findings = out;
  lastScan = { at: new Date(), screens, missing };
  const broken = new Set(out.filter(f => f.sev === 'issue').map(f => f.dev.label));
  status.textContent = `Checked ${plural(steps.length, 'step')} on ${plural(devices.length, 'device')}. ${broken.size ? 'Issues on ' + [...broken].slice(0, 4).join(', ') + (broken.size > 4 ? ` +${broken.size - 4} more` : '') + '.' : 'No issues on measured previews.'}`
    + (missing.length ? ` Could not measure ${plural(missing.length, 'preview')}.` : '');
  renderFindings(); showTab('diff');
}

/* ------------------------------ screen settings and long text ------------------------------ */
function applyScreenSettings() {
  let rotated = false;
  for (const d of DEVICES) {
    if (!d.el) continue;
    const setting = screenSetting(d);
    const rot = setting === 'landscape' && d.touch;
    if ((screenSettings === 'orientation' || d.settingRot) && d.rot !== rot) { d.rot = rot; d.settingRot = rot; layout(d); rotated = true; }
    if (d.ready) configure(d);
    d.iframe.style.filter = previewFilter(d);
    const name = screenName(d);
    d.el.querySelector('.dev-name').textContent = name;
    d.iframe.title = name + ' preview';
  }
  if (rotated) fitWall();
  const reference = $('#ref');
  for (const option of reference.options) { const d = DEVICES.find(x => x.id === option.value); if (d) option.textContent = screenName(d); }
}
$('#screen-settings').addEventListener('change', event => {
  screenSettings = event.target.value;
  $('#screen-settings-help').hidden = !screenSettings;
  $('#screen-lang-row').hidden = screenSettings !== 'lang';
  findings = []; lastScan = null; renderFindings();
  applyScreenSettings();
});
$('#long-text').addEventListener('change', event => {
  longText = event.target.checked;
  for (const d of connectedScreens()) if (d.ready) configure(d);
});
$('#sweep').onclick = () => sweepWidths();
$('#journey').onclick = () => journeyReport();

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
  if (e.target.closest('[data-fix]')) { toggleFix(el.dataset.g === undefined ? [findings[+el.dataset.i]] : reportGroups[+el.dataset.g].items); return; }
  if (e.target.closest('.fix')) return; // selecting the CSS to copy it
  if (el.dataset.g === undefined) { showFindings([findings[+el.dataset.i]]); return; }
  const group = reportGroups[+el.dataset.g], chip = e.target.closest('.screen-chip');
  if (!chip) { showFindings(group.items); return; } // the whole issue, on every screen it affects
  const screen = group.screens[+chip.dataset.s];
  pickedScreen.set(group.key, screen);
  renderFindings();
  showFindings(group.items.filter(f => f.dev === screen));
});
$('#detect').onclick = () => detect();
async function showTab(t, options) {
  if (t === 'outline' && !options?.fromTour && (tourRunning || window.samestateTourFeatures?.active)) await endTour(false);
  $('#panel').hidden = false; if (mode === 'focus') relayout();
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  for (const pane of document.querySelectorAll('#panel > .pane')) pane.hidden = pane.id !== 'pane-' + t;
  if (t === 'outline') window.samestateOutline?.open(options);
  if (t === 'console') renderConsole();
  if (t === 'meta' && !lastMeta) readMeta();
}
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
$('#sign-ins-row').hidden = !IS_EXT;
// Interface theme and day/night mode (ui-theme.js applies the saved choice before the page is drawn).
const uiTheme = window.samestateUiTheme;
$('#ui-theme').innerHTML = Object.entries(uiTheme.THEMES).map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
function showUiTheme() {
  $('#ui-theme').value = uiTheme.theme;
  const button = $('#ui-mode');
  button.title = `Switch to ${uiTheme.mode === 'dark' ? 'day' : 'night'} mode`;
  button.setAttribute('aria-label', button.title);
}
// The guided demo previews themes without saving them; this puts the visitor's own choice back.
function restoreUiTheme() { uiTheme.restore(); showUiTheme(); }
$('#ui-theme').addEventListener('change', event => { uiTheme.save(event.target.value, uiTheme.mode); showUiTheme(); });
$('#ui-mode').addEventListener('click', () => { uiTheme.save(uiTheme.theme, uiTheme.mode === 'dark' ? 'light' : 'dark'); showUiTheme(); });
showUiTheme();
if (!IS_EXT) { document.body.classList.add('web'); $('#src').placeholder = 'Live demo on a sample site — install the extension to open any page'; $('#own').textContent = 'Get the Chrome extension'; }
// The extension starts on the bundled sample site, which needs no site access, so no prompt is
// needed and no outside site is requested in the manifest. The web demo starts with the tour.
async function openDefault() {
  if (target || openId) return; // the user already opened something
  await open(DEMO_URL);
}
// The toolbar icon passes the page it was clicked on. Sites Chrome already allows open straight away; for a new site
// Chrome only shows its access prompt after a click or key press, so the address is filled in for the user.
async function openClickedPage(address) {
  history.replaceState(null, '', location.pathname); // a reload starts fresh instead of reopening this page
  const url = parseAddress(address);
  if (!url) return openDefault();
  let allowed = false;
  try { allowed = await chrome.permissions.contains({ origins: [originPattern(url)] }); } catch {}
  if (target || openId) return;
  if (allowed) return open(url, true);
  $('#src').value = url.href;
  $('#src').focus();
  $('#joblog').textContent = `Press Enter to open ${url.host}. Chrome asks once for access to the site.`;
}
const clickedPage = IS_EXT && new URLSearchParams(location.search).get('open');
addEventListener('DOMContentLoaded', () => { if (clickedPage) openClickedPage(clickedPage); else if (IS_EXT) openDefault(); else startTour(); }, { once: true });

/* ------------------------------ debug menu ------------------------------ */
// The menu's items and each screen's state are defined near the top of this file (DEBUG_MENU).
let debugAudio = null, lastBeep = 0;
function beep(d) {
  const t = performance.now();
  if (!debugAudio || t - lastBeep < 90) return;
  lastBeep = t;
  const tone = debugAudio.createOscillator(), gain = debugAudio.createGain();
  tone.frequency.value = 520 + (Math.max(0, connectedScreens().indexOf(d)) % 8) * 70; // each screen its own pitch
  gain.gain.setValueAtTime(.05, debugAudio.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, debugAudio.currentTime + .08);
  tone.connect(gain).connect(debugAudio.destination);
  tone.start(); tone.stop(debugAudio.currentTime + .09);
}

const debugMenu = document.createElement('div');
debugMenu.className = 'debug-menu'; debugMenu.setAttribute('role', 'menu'); debugMenu.hidden = true; debugMenu.tabIndex = -1;
document.body.append(debugMenu);
let debugTarget = null, debugOpener = null; // a screen, or 'all'
const debugScreens = () => debugTarget === 'all' ? workspaceScreens() : debugTarget?.el ? [debugTarget] : [];
function renderDebugMenu() {
  const screens = debugScreens();
  const toolState = id => { const on = screens.filter(d => debugTools(d).has(id)).length; return on === 0 ? 'false' : on === screens.length ? 'true' : 'mixed'; };
  const simState = sim => { const on = screens.filter(d => debugSim(d) === sim).length; return on === 0 ? 'false' : on === screens.length ? 'true' : 'mixed'; };
  const title = debugTarget === 'all' ? `Every screen (${screens.length})` : screenName(debugTarget);
  debugMenu.setAttribute('aria-label', 'Debug tools and simulators: ' + title);
  debugMenu.innerHTML = `<p class="debug-for">${esc(title)}</p>` + DEBUG_MENU.map(item => {
    if (item.heading) return `<p class="debug-heading" role="presentation">${esc(item.heading)}</p>`;
    if (item.group) return `<p class="debug-group" role="presentation">${esc(item.group)}</p>`;
    if (item.action) return item.single && debugTarget === 'all' ? '' : `<button type="button" role="menuitem" data-action="${esc(item.action)}" tabindex="-1"><span class="debug-check debug-act" aria-hidden="true"></span><span class="debug-label">${esc(item.label)}</span><span class="debug-info" title="${esc(item.info)}" aria-hidden="true">i</span><span class="sr-only">. ${esc(item.info)}</span></button>`;
    const tool = !!item.id, state = tool ? toolState(item.id) : simState(item.sim);
    return `<button type="button" role="${tool ? 'menuitemcheckbox' : 'menuitemradio'}" aria-checked="${state}" data-${tool ? 'tool' : 'sim'}="${esc(tool ? item.id : item.sim)}" tabindex="-1">`
      + `<span class="debug-check" aria-hidden="true"></span><span class="debug-label">${esc(item.label)}${item.note ? ` <small>${esc(item.note)}</small>` : ''}</span>`
      + `<span class="debug-info" title="${esc(item.info)}" aria-hidden="true">i</span><span class="sr-only">. ${esc(item.info)}</span></button>`;
  }).join('');
}
function placeDebugMenu() {
  const r = debugOpener.getBoundingClientRect();
  debugMenu.style.maxHeight = Math.max(200, innerHeight - 16) + 'px';
  const h = Math.min(debugMenu.scrollHeight, innerHeight - 16), w = debugMenu.offsetWidth;
  debugMenu.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
  debugMenu.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - h - 8)) + 'px';
}
function openDebugMenu(target, opener) {
  if (!debugMenu.hidden && debugTarget === target) { closeDebugMenu(); return; }
  debugTarget = target; debugOpener = opener;
  renderDebugMenu();
  debugMenu.hidden = false;
  opener.setAttribute('aria-expanded', 'true');
  placeDebugMenu();
  (debugMenu.querySelector('[aria-checked=true]') || debugMenu.querySelector('[role^=menuitem]'))?.focus();
}
function closeDebugMenu(returnFocus = true) {
  if (debugMenu.hidden) return;
  debugMenu.hidden = true;
  debugOpener?.setAttribute('aria-expanded', 'false');
  if (returnFocus && debugOpener?.isConnected) debugOpener.focus();
  debugTarget = null;
}
function setTool(id) {
  const screens = debugScreens();
  if (!screens.length) return;
  const on = !screens.every(d => debugTools(d).has(id));
  if (id === 'audible' && on) { try { debugAudio ??= new AudioContext(); debugAudio.resume(); } catch {} }
  for (const d of screens) {
    const tools = debugTools(d);
    if (on) { tools.add(id); if (id === 'reach-right') tools.delete('reach-left'); if (id === 'reach-left') tools.delete('reach-right'); }
    else tools.delete(id);
    applyDebug(d);
  }
  if (debugTarget === 'all') {
    if (on) { wallDebug.tools.add(id); if (id.startsWith('reach-')) wallDebug.tools.delete(id === 'reach-right' ? 'reach-left' : 'reach-right'); }
    else wallDebug.tools.delete(id);
  }
}
function setSim(sim) {
  for (const d of debugScreens()) { d.sim = sim; applyDebug(d); }
  if (debugTarget === 'all') wallDebug.sim = sim;
}
debugMenu.addEventListener('click', event => {
  const item = event.target.closest('[role^=menuitem]');
  if (!item) return;
  if (item.dataset.action) { runDebugAction(item.dataset.action); return; }
  if (item.dataset.tool) setTool(item.dataset.tool); else setSim(item.dataset.sim || '');
  const focusKey = item.dataset.tool ? `[data-tool="${item.dataset.tool}"]` : `[data-sim="${item.dataset.sim}"]`;
  renderDebugMenu();
  debugMenu.querySelector(focusKey)?.focus();
});
debugMenu.addEventListener('keydown', event => {
  const items = [...debugMenu.querySelectorAll('[role^=menuitem]')], at = items.indexOf(document.activeElement);
  const go = i => { event.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
  if (event.key === 'ArrowDown') go(at + 1);
  else if (event.key === 'ArrowUp') go(at - 1);
  else if (event.key === 'Home') go(0);
  else if (event.key === 'End') go(items.length - 1);
  else if (event.key === 'Escape') { event.preventDefault(); closeDebugMenu(); }
  else if (event.key === 'Tab') closeDebugMenu(false);
});
document.addEventListener('pointerdown', event => {
  if (!debugMenu.hidden && !debugMenu.contains(event.target) && !debugOpener?.contains(event.target)) closeDebugMenu(false);
}, true);
addEventListener('resize', () => { if (!debugMenu.hidden) placeDebugMenu(); });
$('#debug-all').addEventListener('click', event => openDebugMenu('all', event.currentTarget));

/* ---------------------------- asking one screen ---------------------------- */
// A request to one preview that answers with the same rid; resolves with null if the screen does not answer.
const asks = new Map();
function ask(d, type, data = {}, ms = 4000) {
  const rid = crypto.randomUUID();
  return new Promise(resolve => {
    const timer = setTimeout(() => { asks.delete(rid); resolve(null); }, ms);
    asks.set(rid, message => { clearTimeout(timer); asks.delete(rid); resolve(message); });
    post(d, type, { ...data, rid });
  });
}
const referenceScreen = () => { const screens = workspaceScreens().filter(d => d.ready); return screens.find(d => d.id === $('#ref').value) || screens[0] || null; };

/* ------------------------------ meta checks and panel ------------------------------ */
let lastMeta = null, cardTheme = 'light';
function metaFindings(meta) {
  const out = [], add = (sev, kind, title, detail) => out.push({ sev, kind, title, detail });
  const tl = meta.title.length, dl = meta.description.length;
  if (!tl) add('issue', 'No page title', 'No page title', 'Browsers, bookmarks and search results show the title. Add a title element.');
  else if (tl > 60) add('warn', 'Title may be cut off', `Title is ${tl} characters`, 'Search results show about 60 characters.');
  else if (tl < 10) add('info', 'Very short title', `Title is ${tl} characters`, 'A short title says little in search results and tabs.');
  if (!dl) add('warn', 'No meta description', 'No meta description', 'Search results and some social cards fall back to text from the page.');
  else if (dl > 160) add('warn', 'Description may be cut off', `Description is ${dl} characters`, 'Search results show about 155–160 characters.');
  else if (dl < 50) add('info', 'Short description', `Description is ${dl} characters`, '50–160 characters works best in search results.');
  const missing = [['og:title', meta.og.title], ['og:description', meta.og.description], ['og:image', meta.og.image], ['og:url', meta.og.url], ['twitter:card', meta.twitter.card]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) add(missing.includes('og:image') ? 'warn' : 'info', 'Social card tags missing', `${plural(missing.length, 'social card tag')} missing`, missing.join(', ') + '. Shared links fall back to guesses or show no image.');
  if (meta.og.imageRelative) add('issue', 'og:image is not a full URL', 'og:image is not a full URL', 'Social sites need an absolute https:// address for the image.');
  if (meta.og.image && !meta.og.imageAlt) add('info', 'No og:image:alt', 'No og:image:alt', 'Describe the share image for screen reader users on social sites.');
  if (!meta.canonical) add('info', 'No canonical URL', 'No canonical URL', 'A link rel=canonical tells search engines which address is the real one.');
  if (!meta.hasIcon) add('info', 'No favicon link', 'No favicon link', 'Browsers try /favicon.ico; a link rel=icon makes it explicit.');
  if (/noindex/i.test(meta.robots)) add('warn', 'Page asks not to be indexed', 'Page asks not to be indexed', `The robots meta tag says “${meta.robots.slice(0, 60)}”. Fine for staging, not for a live page.`);
  if (!meta.charset) add('info', 'No charset declared', 'No charset declared', 'Add <meta charset="utf-8"> near the top of the head.');
  if (meta.duplicates.length) add('warn', 'Duplicate meta tags', `${plural(meta.duplicates.length, 'meta tag')} set more than once`, meta.duplicates.slice(0, 6).join(', ') + '. Sites read one of them, and not always the same one.');
  if (meta.jsonld.includes('invalid JSON')) add('issue', 'Invalid structured data', 'Invalid structured data', 'A JSON-LD script could not be read, so search engines ignore it.');
  return out;
}
function renderMeta() {
  const view = $('#meta-view');
  if (!lastMeta) { view.innerHTML = '<p class="muted">Open a site, then press <b>Detect differences</b> or <b>Read meta</b> to see its title, description, social cards and meta checks.</p><button type="button" class="pill" data-meta="read">Read meta</button>'; return; }
  const m = lastMeta, host = (() => { try { return new URL(m.og.url || m.url).host; } catch { return ''; } })();
  const title = m.og.title || m.twitter.title || m.title || host, desc = m.og.description || m.twitter.description || m.description;
  const image = /^https?:\/\//.test(m.og.image || m.twitter.image) ? (m.og.image || m.twitter.image) : '';
  const img = cls => image ? `<img class="${cls}" src="${esc(image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : `<div class="${cls} card-noimg">No image</div>`;
  const icon = /^https?:\/\//.test(m.icon) ? `<img class="meta-icon" src="${esc(m.icon)}" alt="" referrerpolicy="no-referrer">` : '';
  const site = m.og.siteName || host;
  const row = (k, v) => `<div class="meta-row"><span>${esc(k)}</span><b>${v}</b></div>`;
  const len = (n, max) => `<small class="${n > max ? 'over' : ''}">${n}/${max}</small>`;
  const cards = {
    Google: `<div class="card-google"><div class="g-site">${icon}<span>${esc(site)}<br><small>${esc(m.url.slice(0, 70))}</small></span></div><div class="g-title">${esc(m.title || title)}</div><div class="g-desc">${esc((m.description || desc).slice(0, 160))}${(m.description || desc).length > 160 ? '…' : ''}</div></div>`,
    X: `<div class="card-x">${img('card-img wide')}<div class="card-x-host">${esc(host)}</div><div class="card-x-title">${esc(title.slice(0, 70))}</div></div>`,
    Facebook: `<div class="card-fb">${img('card-img wide')}<div class="card-body"><small>${esc(host.toUpperCase())}</small><b>${esc(title.slice(0, 88))}</b><span>${esc(desc.slice(0, 110))}</span></div></div>`,
    LinkedIn: `<div class="card-li">${img('card-img wide')}<div class="card-body"><b>${esc(title.slice(0, 70))}</b><small>${esc(host)}</small></div></div>`,
    Slack: `<div class="card-slack"><div class="card-slack-site">${icon}${esc(site)}</div><a>${esc(title)}</a><span>${esc(desc.slice(0, 200))}</span>${image ? img('card-img slack') : ''}</div>`,
    Discord: `<div class="card-discord"><small>${esc(site)}</small><a>${esc(title)}</a><span>${esc(desc.slice(0, 200))}</span>${image ? img('card-img') : ''}</div>`,
    WhatsApp: `<div class="card-wa"><div class="card-wa-inner">${image ? img('card-img wa') : ''}<div><b>${esc(title.slice(0, 60))}</b><span>${esc(desc.slice(0, 80))}</span><small>${esc(host)}</small></div></div><a>${esc(m.url.slice(0, 60))}</a></div>`,
  };
  const checks = metaFindings(m);
  view.innerHTML = `<div class="meta-head">${icon}<div><b>${esc(m.title || 'No title')}</b> ${len(m.title.length, 60)}<br><small class="muted">${esc(m.url)}</small></div></div>`
    + row('Description', m.description ? `${esc(m.description)} ${len(m.description.length, 160)}` : '<i>none</i>')
    + row('Canonical', m.canonical ? esc(m.canonical) : '<i>none</i>') + row('Language', m.lang ? esc(m.lang) : '<i>none</i>')
    + row('Robots', m.robots ? esc(m.robots) : '<i>not set (indexable)</i>') + row('Theme color', m.themeColor ? `<span class="swatch" style="background:${esc(m.themeColor)}"></span>${esc(m.themeColor)}` : '<i>none</i>')
    + row('Web app manifest', m.manifest ? 'yes' : 'no') + row('Apple touch icon', m.appleIcon ? 'yes' : 'no')
    + row('Structured data', m.jsonld.length ? esc(m.jsonld.join(', ')) : '<i>none</i>')
    + `<h3 class="meta-h">Checks</h3>` + (checks.length ? checks.map(f => `<div class="finding ${f.sev}"><div class="t">${esc(f.title)}</div><div class="d">${esc(f.detail)}</div></div>`).join('') : '<p class="muted">No problems found.</p>')
    + `<h3 class="meta-h">Social previews <span class="report-view"><button type="button" data-card-theme="light" class="${cardTheme === 'light' ? 'on' : ''}">Light</button><button type="button" data-card-theme="dark" class="${cardTheme === 'dark' ? 'on' : ''}">Dark</button></span></h3>`
    + `<p class="muted">Approximations of how each site shows a shared link. They use og: and twitter: tags, then the title and description.</p>`
    + `<div class="cards ${cardTheme}">` + Object.entries(cards).map(([name, html]) => `<section><h4>${name}</h4>${html}</section>`).join('') + '</div>'
    + '<button type="button" class="pill" data-meta="read">Read meta again</button>';
}
async function readMeta() {
  const d = referenceScreen(); if (!d) return;
  const data = (await snapshotScreens([d], 5000)).get(d);
  if (data?.meta) { lastMeta = data.meta; renderMeta(); }
}
$('#pane-meta').addEventListener('click', event => {
  const theme = event.target.closest('[data-card-theme]');
  if (theme) { cardTheme = theme.dataset.cardTheme; renderMeta(); }
  if (event.target.closest('[data-meta=read]')) readMeta();
});
renderMeta();

/* ------------------------------ console panel ------------------------------ */
const consoleEntries = new Map(); let consoleTimer = 0;
function noteConsole(d, m) {
  if (!['log', 'info', 'warn', 'error', 'debug'].includes(m.level) || typeof m.message !== 'string') return;
  const key = m.level + '|' + m.message;
  let entry = consoleEntries.get(key);
  if (!entry) {
    if (consoleEntries.size >= 500) consoleEntries.delete(consoleEntries.keys().next().value);
    entry = { level: m.level, message: m.message, kind: m.kind, screens: new Map(), at: Date.now() }; consoleEntries.set(key, entry);
  }
  const name = reportName(d); entry.screens.set(name, (entry.screens.get(name) || 0) + 1); entry.at = Date.now();
  clearTimeout(consoleTimer); consoleTimer = setTimeout(renderConsole, 150);
}
function renderConsole() {
  const errors = [...consoleEntries.values()].filter(e => e.level === 'error').length;
  $('#console-count').textContent = errors || '';
  if ($('#pane-console').hidden) return;
  const level = $('#console-level').value;
  const shown = [...consoleEntries.values()].filter(e => level === 'all' || (level === 'log' ? ['log', 'info', 'debug'].includes(e.level) : e.level === level)).sort((a, b) => b.at - a.at);
  $('#console-list').innerHTML = shown.length ? shown.map(e => `<div class="console-entry ${e.level}"><div class="console-msg"><span class="console-level">${e.level === 'debug' ? 'log' : e.level}</span>${esc(e.message)}</div><div class="console-screens">${[...e.screens].map(([name, n]) => `<span class="chip">${esc(name)}${n > 1 ? ' ×' + n : ''}</span>`).join('')}</div></div>`).join('')
    : '<p class="muted">No messages yet. Console messages and errors from every screen show up here, once each, with the screens that sent them.</p>';
}
$('#console-level').addEventListener('change', renderConsole);
$('#console-clear').addEventListener('click', () => { consoleEntries.clear(); renderConsole(); });

/* ------------------------------ CSS breakpoints ------------------------------ */
let breakpoints = [], breakpointView = null; // { before: ids of the screens that were on }
async function findBreakpoints() {
  const d = referenceScreen(), status = $('#breakpoint-status');
  if (!d) { status.textContent = 'Open a site first.'; return; }
  status.textContent = 'Reading stylesheets…';
  const answer = await ask(d, 'breakpoints');
  breakpoints = answer?.values || [];
  $('#breakpoint-list').innerHTML = breakpoints.map(v => `<span class="chip">${v}px</span>`).join('');
  $('#breakpoint-list').hidden = $('#breakpoint-actions').hidden = $('#breakpoint-edges-row').hidden = !breakpoints.length;
  status.textContent = answer ? (breakpoints.length ? `${plural(breakpoints.length, 'width')} where the site's layout rules change. Stylesheets from other sites can't be read.` : 'No width breakpoints in the stylesheets Samestate can read.') : 'The screen did not answer. Try again.';
}
function breakpointWidths() {
  const widths = new Set(breakpoints[0] > 320 ? [320] : []);
  for (const v of breakpoints) { widths.add(v); if ($('#breakpoint-edges').checked && v - 1 >= 240) widths.add(v - 1); }
  return [...widths].sort((a, b) => a - b).slice(0, 16);
}
function openBreakpoints() {
  if (sitesMode || pageSteps) { $('#breakpoint-status').textContent = 'Turn off Compare sites and Page steps first.'; return; }
  closeBreakpoints(false);
  breakpointView = { before: DEVICES.filter(d => d.on).map(d => d.id) };
  for (const d of DEVICES.filter(x => x.on)) selectDevice(d, false);
  for (const w of breakpointWidths()) {
    const kind = w < 600 ? 'phone' : w < 1024 ? 'tablet' : 'desktop';
    const d = previewDevice(device('bp-' + w, w + 'px', w, kind === 'phone' ? 800 : kind === 'tablet' ? 1024 : 900, 'specials', { kind, os: kind === 'phone' ? 'android' : '', breakpoint: true }), nextDeviceSlot++);
    DEVICES.push(d); selectDevice(d, true);
  }
  refreshDevicePicker();
  $('#close-breakpoints').hidden = false;
  $('#breakpoint-status').textContent = `Showing ${plural(breakpointWidths().length, 'screen')}, one per breakpoint.`;
}
function closeBreakpoints(restore = true) {
  if (!breakpointView) return;
  for (const d of DEVICES.filter(x => x.breakpoint)) { selectDevice(d, false); DEVICES.splice(DEVICES.indexOf(d), 1); }
  if (restore) for (const id of breakpointView.before) { const d = DEVICES.find(x => x.id === id); if (d && !d.on) selectDevice(d, true); }
  breakpointView = null;
  refreshDevicePicker();
  $('#close-breakpoints').hidden = true;
  if (restore) $('#breakpoint-status').textContent = 'Back to your devices.';
}
$('#find-breakpoints').addEventListener('click', findBreakpoints);
$('#open-breakpoints').addEventListener('click', openBreakpoints);
$('#close-breakpoints').addEventListener('click', () => closeBreakpoints());

/* ------------------------------ page language setting ------------------------------ */
$('#screen-lang').addEventListener('change', () => { for (const d of connectedScreens()) if (d.ready) configure(d); });

/* ------------------------------ grid settings ------------------------------ */
let gridSettings = { columns: 12, gutter: 24, maxWidth: 1200, margin: 16, baseline: 8 };
try { Object.assign(gridSettings, JSON.parse(localStorage.getItem('samestate.grid') || '{}')); } catch {}
const GRID_INPUTS = { columns: '#grid-columns', gutter: '#grid-gutter', maxWidth: '#grid-max', margin: '#grid-margin', baseline: '#grid-baseline' };
function openGridSettings() {
  for (const [key, sel] of Object.entries(GRID_INPUTS)) $(sel).value = gridSettings[key];
  $('#grid-dialog').showModal();
}
$('#grid-dialog').addEventListener('input', () => {
  for (const [key, sel] of Object.entries(GRID_INPUTS)) { const v = Number($(sel).value); if (Number.isFinite(v)) gridSettings[key] = v; }
  try { localStorage.setItem('samestate.grid', JSON.stringify(gridSettings)); } catch {}
  for (const d of connectedScreens()) if (d.ready) configure(d);
});

/* ------------------------------ design overlay ------------------------------ */
let designScreen = null;
function openDesign(d) {
  designScreen = d;
  const s = d.design || { scale: 1, opacity: .5, mode: 'normal', split: 0, x: 0, y: 0, visible: true };
  $('#design-screen').textContent = screenName(d) + (d.design ? '' : ' · choose an image exported from your design tool');
  $('#design-scale').value = s.scale; $('#design-opacity').value = s.opacity; $('#design-mode').value = s.mode; $('#design-split').value = s.split;
  $('#design-x').value = s.x; $('#design-y').value = s.y; $('#design-visible').checked = s.visible !== false; $('#design-file').value = '';
  $('#design-dialog').showModal();
}
function sendDesign(d) { if (d?.ready) post(d, 'design', { design: d.design || null }); showDebugState(d); }
function readDesignControls() {
  const d = designScreen; if (!d?.design) return;
  Object.assign(d.design, { scale: Number($('#design-scale').value), opacity: Number($('#design-opacity').value), mode: $('#design-mode').value, split: Number($('#design-split').value), x: Number($('#design-x').value) || 0, y: Number($('#design-y').value) || 0, visible: $('#design-visible').checked });
  sendDesign(d);
}
$('#design-dialog').addEventListener('input', event => { if (event.target.id !== 'design-file') readDesignControls(); });
$('#design-file').addEventListener('change', () => {
  const file = $('#design-file').files[0], d = designScreen;
  if (!file || !d) return;
  if (file.size > 15 * 1024 * 1024) { $('#design-screen').textContent = 'Choose an image under 15 MB.'; return; }
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => { d.design = { src: reader.result, w: image.naturalWidth, h: image.naturalHeight }; $('#design-screen').textContent = `${screenName(d)} · ${file.name}, ${image.naturalWidth} × ${image.naturalHeight}`; readDesignControls(); };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});
$('#design-remove').addEventListener('click', () => { if (designScreen) { designScreen.design = null; sendDesign(designScreen); } $('#design-dialog').close(); });

/* ------------------------------ debug menu actions ------------------------------ */
function runDebugAction(action) {
  const screens = debugScreens();
  closeDebugMenu(false);
  if (action === 'grid') openGridSettings();
  else if (action === 'design' && screens.length === 1) openDesign(screens[0]);
  else if (action.startsWith('fill-')) for (const d of screens) if (d.ready) post(d, 'autofill', { mode: action.slice(5) });
}

/* ------------------------------ find elements ------------------------------ */
let findIndex = 0, findSelector = '';
async function findElements(step) {
  const selector = $('#find-selector').value.trim(), status = $('#find-status');
  if (!selector) { status.textContent = ''; return; }
  findIndex = selector === findSelector ? findIndex + step : 0; findSelector = selector;
  const screens = workspaceScreens().filter(d => d.ready);
  const answers = await Promise.all(screens.map(d => ask(d, 'find', { selector, index: findIndex })));
  const error = answers.find(a => a?.error)?.error;
  if (error) { status.textContent = error + '.'; return; }
  const parts = screens.map((d, i) => `${screenName(d)} ${answers[i] ? answers[i].count : '–'}`);
  const total = answers.reduce((n, a) => n + (a?.count || 0), 0);
  status.textContent = total ? `Match ${findIndex + 1} highlighted. ${parts.join(' · ')}` : 'No matches on any screen.';
}
$('#find-form').addEventListener('submit', event => { event.preventDefault(); findElements(1); });
$('#find-prev').addEventListener('click', () => findElements(-1));
$('#find-selector').addEventListener('input', () => { findSelector = ''; findIndex = 0; });
function openFind() { const drawer = $('#find-drawer'); drawer.open = true; if ($('#sidebar').hidden) $('#toggle-sidebar').click(); drawer.scrollIntoView({ block: 'nearest' }); $('#find-selector').focus(); }

/* ------------------------------ live reload ------------------------------ */
let liveTimer = 0, livePolling = false, liveLast = null;
const LOCAL_HOST = /^(localhost|127(\.\d+){3}|0\.0\.0\.0|\[::1\]|.+\.(localhost|local|test)|10(\.\d+){3}|192\.168(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2})$/i;
function reloadAll() { for (const d of workspaceScreens()) if (d.ready && d.linked) post(d, 'reload'); }
function setLiveReload(value) {
  clearInterval(liveTimer); liveTimer = 0; liveLast = null; liveReloads = []; liveIgnoreHtml = false;
  const status = $('#live-reload-status');
  if (!value) { status.textContent = ''; return; }
  if (value === 'change') {
    let host = ''; try { host = new URL(previewUrl || target).hostname; } catch {}
    if (!LOCAL_HOST.test(host)) { status.textContent = 'Watching for changes is for sites on this computer or network (localhost, .test, 192.168…). Use a timer for other sites.'; $('#live-reload').value = ''; return; }
    status.textContent = 'Watching the page, its stylesheets and scripts. CSS changes swap in place; other changes reload every screen.';
    liveTimer = setInterval(pollSite, 1500);
  } else {
    status.textContent = `Reloading every screen every ${value} seconds.`;
    liveTimer = setInterval(() => { if (!sweepRun && !journeyRunning) reloadAll(); }, Number(value) * 1000);
  }
}
let liveReloads = [], liveIgnoreHtml = false;
async function pollSite() {
  if (livePolling || sweepRun || journeyRunning) return;
  const d = leader?.ready ? leader : referenceScreen(); if (!d) return;
  livePolling = true;
  try {
    const now = await ask(d, 'fingerprint', {}, 5000);
    if (!now) return;
    const last = liveLast;
    liveLast = { screen: d.id, url: now.url, html: now.html, js: now.js, css: now.css };
    if (!last || last.screen !== d.id || last.url !== now.url) return; // a new page or screen: start comparing from here
    const time = new Date().toLocaleTimeString(), status = $('#live-reload-status');
    if (last.js !== now.js || (!liveIgnoreHtml && last.html !== now.html)) {
      liveReloads = [...liveReloads.filter(t => Date.now() - t < 30000), Date.now()];
      if (last.js === now.js && liveReloads.length > 3) { liveIgnoreHtml = true; status.textContent = "The page's HTML changes on every load, so only its stylesheets and scripts are watched now."; return; }
      status.textContent = `Changed at ${time}: reloaded every screen.`; liveLast = null; reloadAll();
    } else if (last.css !== now.css) {
      status.textContent = `CSS changed at ${time}: swapped in place.`;
      for (const s of workspaceScreens()) if (s.ready) post(s, 'reload-css');
    }
  } finally { livePolling = false; }
}
$('#live-reload').addEventListener('change', event => setLiveReload(event.target.value));

/* ------------------------------ tool and feature lookup ------------------------------ */
// Keep names, descriptions and synonyms separate from actions. Searching never runs a tool.
function commandText(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function revealToolControl(el) {
  if (!el) return;
  const pane = el.closest('#panel > .pane');
  if (pane) showTab(pane.id.slice(5));
  if (el.closest('#sidebar') && $('#sidebar').hidden) $('#toggle-sidebar').click();
  for (let parent = el.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
  const scroller = pane || el.closest('#sidebar');
  if (scroller) scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16;
}
function toolControlLabel(el) {
  const own = el.getAttribute('aria-label') || (el.matches('button') ? el.textContent.trim() : '') || el.getAttribute('title');
  if (own) return own;
  const source = el.labels?.[0] || (el.matches('button') ? el : null);
  if (!source) return '';
  const copy = source.cloneNode(true); copy.querySelectorAll('input,select,textarea,button,small,svg').forEach(n => n.remove());
  return copy.textContent.replace(/\s+/g, ' ').trim();
}
function toolAvailability(el) {
  if (!el) return 'This feature is unavailable in this build.';
  if (window.samestateChecks?.running || el.closest('[inert]')) return 'Wait for the current checks to finish.';
  if ((el.id === 'test-write' || el.closest('#test-ai') || el.id === 'sign-ins') && !IS_EXT) return 'Available in the installed Chrome extension.';
  if (el.matches(':disabled')) {
    if (el.closest('#checks-drawer')) return 'Choose check groups, or finish the current run first.';
    if (el.closest('#tests-drawer')) return 'Set up a test, or finish the current test or recording first.';
    if (/screenshot|record|shot/.test(el.id)) return 'Requires a loaded preview and supported desktop Chrome capture. Finish any active capture first.';
    return 'Configure this feature or open a preview first.';
  }
  for (let p = el; p && p !== document.body; p = p.parentElement) if (p.hidden && p.id !== 'sidebar' && p.id !== 'panel' && !p.classList.contains('pane')) return 'Available when the related mode or operation is active.';
  return '';
}
function commands() {
  const list = [], covered = new Set(), ids = new Set();
  const add = (label, hint, description, aliases, run, reason = '', id = label) => {
    if (ids.has(id)) return; ids.add(id);
    list.push({ id, label, hint, description, aliases: Array.isArray(aliases) ? aliases : [aliases || ''], run, available: !reason, reason });
  };
  const control = (label, selector, hint, description, aliases = []) => {
    const el = $(selector); covered.add(el);
    add(label, hint, description || el?.title || label, aliases, () => { revealToolControl(el); el?.click(); }, toolAvailability(el), selector);
  };
  const pageReady = () => workspaceScreens().some(d => d.ready) ? '' : 'Open a site and wait for a preview to load.';
  const drawer = (name, element, description, aliases = []) => {
    add('Open ' + name, name, description, aliases, () => { if (element) element.open = true; revealToolControl(element); element?.querySelector('summary')?.focus({ preventScroll: true }); }, '', 'drawer:' + name);
  };
  control('Outline and measurements', '#open-outline', 'Inspect', 'Headings, landmarks, keyboard focus order, element size, spacing and best-practice suggestions.', ['inspect','measurement','dimensions','padding','margin','tab order','heading','landmark','best practices','accessibility tree']);
  control('Run all checks', '#open-checks', 'Checks', 'Choose groups, run automated checks and record visual reviews in one combined report.', ['all checks','test suite','QA','regression','human review','manual review','combined results']);
  control('Detect differences', '#detect', 'Reports', 'Measure responsive layout, content, accessibility, errors and performance across devices.', ['scan','audit','accessibility','a11y','contrast','web vitals','CLS','LCP','INP']);
  control('Sweep widths', '#sweep', 'Reports', 'Find responsive problems between 320 and 1920 CSS pixels.', ['responsive','breakpoint sweep','reflow','overflow']);
  for (const [label, sel, desc, aliases] of [
    ['Screenshot','#screenshot','Save the visible device wall.',['capture','png','image']], ['Record','#record','Record the device wall as video.',['recording','webm','video']],
    ['Full-page screenshot','#full-page-shot','Scroll and stitch the full length of a preview.',['full page','capture','jpeg','pdf']], ['Overview screenshot','#overview-shot','Capture every screen on one sheet.',['all screens','capture','contact sheet']],
    ['Auto screenshots','#auto-shots','Save screenshots repeatedly at your chosen pace.',['timelapse','interval','automatic capture']], ['Save captures to folder','#capture-folder','Choose where screenshots and recording parts are saved.',['downloads','destination','save folder']]
  ]) control(label, sel, 'Capture', desc, aliases);
  control('Compare sites', '#sites-toggle', 'Views', 'Compare different websites side by side.', ['multiple sites','staging','production','side by side']);
  control('Reload every screen', '#reload', 'Navigation', 'Reload the current previews.', ['refresh all','reload all']);
  control('Day or night mode', '#ui-mode', 'Appearance', 'Switch the interface between light and dark.', ['dark mode','light mode','appearance']);
  control('Show or hide the sidebar', '#toggle-sidebar', 'Navigation', 'Toggle preview settings.', ['sidebar','settings']);
  control('Guided demo', '#demo', 'Help', 'Walk through Samestate features on the sample site.', ['tour','tutorial','help','getting started']);
  control('Find breakpoints', '#find-breakpoints', 'Views', 'Read width breakpoints from accessible stylesheets.', ['media queries','responsive css']);
  control('Open one screen per breakpoint', '#open-breakpoints', 'Views', 'Open temporary previews at the detected breakpoint widths.', ['breakpoint previews','responsive']);
  control('Back to my devices', '#close-breakpoints', 'Views', 'Restore the device selection used before breakpoint previews.', ['restore devices']);
  control('Export workspaces', '#workspace-export', 'Workspaces', 'Download saved setups as JSON.', ['backup','share setup','workspace export']);
  control('Import workspaces', '#workspace-import', 'Workspaces', 'Load setups from a workspace JSON file.', ['restore backup','workspace import']);
  control('Long text (+35%)', '#long-text', 'Reports', 'Expand preview text to test translation and content growth.', ['localization','translation','text stress']);
  control('Check links', '#check-links', 'Reports', 'Include same-origin broken-link checks in the report.', ['broken links','404','dead links']);
  add('Find elements', 'Inspect', 'Search every preview by CSS selector and move between matches.', ['CSS selector','find','search page','element search'], openFind);
  add('Grid settings', 'Debug', 'Set columns, gutters, margins and the baseline grid.', ['grid','columns','baseline','spacing'], openGridSettings);
  control('Debug menu for every screen', '#debug-all', 'Debug', 'Open debugging tools and visual simulators for the whole wall.', ['debug','simulators','overlays']);
  for (const [tab, label, description, aliases] of [
    ['diff','Differences','Review grouped findings, fixes, baselines and exports.',['report','findings','baseline','fixes']],
    ['log','Sync log','See how mirrored actions were matched across devices.',['synchronization','activity','click log']],
    ['meta','Meta and social previews','Spot metadata issues: missing values, duplicate tags, long/short titles and descriptions, and share previews.',['meta','metadata','meta data','metadata issues','too long','too short','seo','open graph','og tags','social cards','title','description','canonical','favicon','structured data']],
    ['outline','Outline panel','Inspect headings, landmarks, focus order and CSS measurements.',['outline','page structure','tab order']],
    ['checks','Combined check results','Automated findings, test steps, visual reviews and HTML/JSON export.',['combined report','check results','reviews']],
    ['console','Console','Messages and errors from every preview, grouped with a level filter.',['javascript','js errors','logs','console']]
  ]) add('Open ' + label, 'Panels', description, aliases, () => showTab(tab), '', 'panel:' + tab);
  for (const summary of document.querySelectorAll('#sidebar > .sidebar-drawer > summary')) {
    const name = summary.firstChild?.textContent.trim();
    if (name) drawer(name, summary.parentElement, 'Open ' + name + ' settings and controls.', name === 'Test runs' ? ['tests','AI','OpenRouter','record clicks','replay','test plan','api key'] : name === 'Devices' ? ['device','phone','tablet','custom devices',...DEVICES.map(d => d.name)] : name === 'Theme' ? ['theme','tweakcn','colors'] : []);
  }
  for (const [selector, category, prefix] of [['#screen-settings','Screen settings','Screen settings'],['#live-reload','Sync','Live reload'],['#ui-theme','Appearance','Interface theme'],['#theme-preset','Themes','Preview theme'],['#outline-mode','Inspect','Outline view'],['#shot-format','Capture','Screenshot format']]) {
    const el = $(selector); covered.add(el);
    for (const option of el.options) {
      if (option.disabled || !option.value && selector === '#theme-preset') continue;
      add(prefix + ': ' + option.text, category, selector === '#screen-settings' ? 'Compare the page with this setting on alternating screens.' : 'Choose ' + option.text + ' in ' + prefix + '.', [option.value, prefix, option.text, selector === '#screen-settings' ? 'emulation media preferences' : ''], () => { revealToolControl(el); el.value = option.value; el.dispatchEvent(new Event('change', { bubbles: true })); }, toolAvailability(el), selector + ':' + option.value);
    }
  }
  let debugGroup = '';
  for (const item of DEBUG_MENU) {
    if (item.group) debugGroup = item.group;
    if (item.id) add(item.label + (item.note ? ' (' + item.note + ')' : ''), 'Debug tools', item.info + ' Applies to every visible screen.', [item.id,debugGroup,item.note || ''], () => { debugTarget = 'all'; try { setTool(item.id); } finally { debugTarget = null; } }, pageReady());
    else if (item.sim !== undefined) add('Simulator: ' + item.label + (item.note ? ' (' + item.note + ')' : ''), 'Simulators', item.info + ' Applies to every visible screen.', [item.sim,debugGroup,'vision','simulation'], () => { debugTarget = 'all'; try { setSim(item.sim); } finally { debugTarget = null; } }, pageReady());
    else if (item.action && item.action !== 'grid') add(item.label.replace('…',''), 'Debug tools', item.info + (item.single ? ' Uses the reference screen.' : ' Applies to every visible screen.'), [item.action,'forms',item.single ? 'reference design image comparison' : 'autofill test data'], () => {
      if (item.single) { const d = referenceScreen(); if (d) openDesign(d); }
      else { debugTarget = 'all'; try { runDebugAction(item.action); } finally { debugTarget = null; } }
    }, pageReady());
  }
  add('Configure AI connection', 'Test runs', 'Set up OpenRouter or another OpenAI-compatible service and its API key.', ['AI','OpenRouter','api key','model','Ollama','local model'], () => { const el=$('#test-ai'); revealToolControl(el); el.open=true; $('#ai-provider').focus({preventScroll:true}); });
  add('Save workspace', 'Workspaces', 'Name and save the current preview setup.', ['save setup','save devices','workspace'], () => { revealToolControl($('#workspace-name')); $('#workspace-name').focus({preventScroll:true}); }, pageReady());
  add('Add expected-text check', 'Test runs', 'Add an assertion for text that should appear on every screen.', ['assert','expectation','text check'], () => { revealToolControl($('#test-check')); $('#test-check').focus({preventScroll:true}); });
  add('Preview scale and physical size', 'Views', 'Set a preview percentage or calibrate its physical size on your monitor.', ['actual size','millimetres','physical','calibration','DPI','scale'], () => referenceScreen()?.el.querySelector('[data-a=scale]')?.click(), pageReady());
  for (const [format,label] of [['md','Markdown'],['csv','CSV'],['html','HTML'],['html-shots','HTML with screenshots']]) {
    const el=$('[data-export="'+format+'"]');
    add('Export difference report: '+label, 'Reports', 'Save the current findings as '+label+'.', ['report export',format,'download findings'], () => {revealToolControl(el);el?.click();}, findings.length ? toolAvailability(el) : 'Run Detect differences to create a report first.', 'export:'+format);
  }
  for (const [action,label] of [['save','Save report baseline'],['clear','Clear report baseline'],['undo-fixes','Undo all preview fixes']]) {
    const el=$('[data-baseline="'+action+'"]');
    add(label, 'Reports', 'Manage saved comparison baselines or temporary CSS fixes in Differences.', ['baseline','regression','fix','undo'], ()=>{revealToolControl(el);el?.click();},el?toolAvailability(el):'Available after a report, baseline or preview fix exists.','baseline:'+action);
  }
  add('Refresh metadata', 'Panels', 'Read the reference preview’s metadata again after page changes.', ['refresh meta','read meta','update metadata'], () => { showTab('meta'); readMeta(); }, pageReady());
  // Index the actual controls too, including features added by later scripts. Do not read text-field values.
  for (const el of document.querySelectorAll('#sidebar button[id],#sidebar input[id]:not([type=hidden]):not([type=password]):not([type=file]),#sidebar select[id],#sidebar textarea[id],#panel button[id],#panel input[id]:not([type=hidden]):not([type=password]):not([type=file]),#panel select[id]')) {
    if (covered.has(el) || ['closepanel','device-search','workspace-name','test-check','find-selector','command-input'].includes(el.id)) continue;
    const label = toolControlLabel(el); if (!label) continue;
    const section = el.closest('.sidebar-drawer')?.querySelector('summary')?.firstChild?.textContent.trim();
    const category = section || (el.closest('#pane-outline') ? 'Inspect' : el.closest('#pane-console') ? 'Console' : 'Checks');
    add(label, category, el.matches('button,input[type=checkbox]') ? 'Use this control in ' + category + '.' : 'Open ' + category + ' and configure ' + label + '.', [el.id.replace(/-/g,' '), category], () => {
      revealToolControl(el);
      if (el.matches('button,input[type=checkbox]')) el.click(); else el.focus({ preventScroll: true });
    }, toolAvailability(el), '#' + el.id);
  }
  for (const [label, selector, category, desc] of [
    ['Grid layout','#mode [data-v=grid]','Layout','Arrange previews in a grid.'], ['Single-row layout','#mode [data-v=row]','Layout','Arrange previews in one horizontal row.'], ['Focus one device','#mode [data-v=focus]','Layout','Show one selected preview at a time.']
  ]) control(label, selector, category, desc);
  for (const key of Object.keys(SYNC)) {
    const el = $('#synclist input[data-sync="' + key + '"]') || [...document.querySelectorAll('#synclist input')].find(e => e.value === key || e.dataset.k === key);
    if (el) add('Sync: ' + SYNC[key][0], 'Sync', 'Toggle ' + SYNC[key][0].toLowerCase() + ' between linked screens.', [key,'mirror','synchronization'], () => { revealToolControl(el); el.click(); }, toolAvailability(el), 'sync:' + key);
  }
  add('Preview annotations', 'Inspect', 'Add notes, strokes, lines and arrows to the reference preview.', ['annotate','annotation','note','draw','arrow','mark up'], () => {
    const d = referenceScreen(), button = d?.el?.querySelector('.annotation-toggle');
    if (button) button.click();
    else if (d) { const candidate = d.el.querySelector('[aria-label*="Annotate"],[title*="Annotate"]'); candidate?.click(); }
  }, pageReady());
  for (const item of list) {
    const help = window.samestateFeatureHelpCatalog?.entry(item.id);
    if (help) item.description = help.text;
  }
  return list;
}
function commandNear(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; } else { if (++edits > 1) return false; if (a.length <= b.length) j++; if (a.length >= b.length) i++; } }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
}
let commandList = [], commandAt = 0, commandOpener = null;
function renderCommands() {
  const typed = commandText($('#command-input').value), tokens = typed.split(' ').filter(Boolean), meaningful = tokens.filter(w=>!['a','an','the','and','or','to','for','how','where','can','i','my','show','find','search','use','want'].includes(w)), words = meaningful.length ? meaningful : tokens, category = $('#command-category').value;
  const catalog = commands(), categories = [...new Set(catalog.map(c => c.hint))].sort();
  $('#command-category').innerHTML = '<option value="">All categories</option>' + categories.map(c => `<option${c === category ? ' selected' : ''}>${esc(c)}</option>`).join('');
  const score = c => {
    const label = commandText(c.label), name = commandText(c.label.split(': ').pop()), aliases = c.aliases.map(commandText), hay = commandText([c.label,c.hint,c.description,...c.aliases].join(' '));
    if (!words.length) return 0;
    if (typed === name || typed === label) return 0;
    if (aliases.includes(typed)) return 10;
    if (!words.every(w => hay.includes(w) || w.length >= 4 && hay.split(' ').some(t => t.length >= 4 && commandNear(w,t)))) return Infinity;
    return name.startsWith(typed) || label.startsWith(typed) ? 20 : label.includes(typed) ? 30 : hay.includes(typed) ? 40 : 50;
  };
  commandList = catalog.filter(c => !category || c.hint === category).map((c,i) => ({c,i,score:score(c)})).filter(r => Number.isFinite(r.score)).sort((a,b) => a.score-b.score || a.i-b.i).map(r => r.c);
  commandAt = Math.min(commandAt, Math.max(0, commandList.length-1));
  $('#command-count').textContent = typed || category ? commandList.length + (commandList.length === 1 ? ' match' : ' matches') + ' · ' + catalog.length + ' tools and features' : catalog.length + ' tools and features';
  $('#command-message').textContent = '';
  $('#command-list').innerHTML = commandList.map((c,i) => `<li role="option" id="command-${i}" aria-selected="${i===commandAt}" aria-disabled="${!c.available}" data-i="${i}"><div><span>${esc(c.label)}</span><p>${esc(c.description)}</p>${!c.available ? `<em>${esc(c.reason)}</em>` : ''}</div><small>${esc(c.hint)}</small></li>`).join('') || '<li class="command-empty" role="presentation">No matching tool. Try a name or purpose, such as “meta”, “spacing”, “recording”, or “AI”.</li>';
  if (commandList.length) $('#command-input').setAttribute('aria-activedescendant','command-'+commandAt); else $('#command-input').removeAttribute('aria-activedescendant');
  $('#command-'+commandAt)?.scrollIntoView({block:'nearest'});
}
async function openCommandBar({ fromTour = false } = {}) {
  if (window.samestateChecks?.running) return;
  if (!fromTour && (tourRunning || window.samestateTourFeatures?.active)) await endTour(false);
  commandOpener = document.activeElement; $('#command-input').value = ''; $('#command-category').value = ''; commandAt = 0; renderCommands();
  if (!$('#command-bar').open) $('#command-bar').showModal(); $('#command-input').focus();
}
function runCommand(i) {
  const c = commandList[i]; if (!c) return;
  // Availability can change while the dialog is open. Resolve the action from the current catalog.
  const current = commands().find(item => item.id === c.id);
  if (!current?.available) { commandAt=i; renderCommands(); $('#command-input').focus(); $('#command-message').textContent = current?.reason || 'This feature is no longer available. Search again.'; return; }
  $('#command-bar').close(); current.run();
}
$('#search-tools').addEventListener('click',openCommandBar);
$('#command-close').addEventListener('click',()=>$('#command-bar').close());
$('#command-input').addEventListener('input',()=>{commandAt=0;renderCommands();});
$('#command-category').addEventListener('change',()=>{commandAt=0;renderCommands();$('#command-input').focus();});
$('#command-input').addEventListener('keydown',event=>{
  if (event.key==='ArrowDown'||event.key==='ArrowUp') {event.preventDefault();commandAt=(commandAt+(event.key==='ArrowDown'?1:-1)+commandList.length)%Math.max(1,commandList.length);renderCommands();}
  else if ((event.ctrlKey||event.metaKey)&&['Home','End'].includes(event.key)) {event.preventDefault();commandAt=event.key==='Home'?0:Math.max(0,commandList.length-1);renderCommands();}
  else if (event.key==='Enter') {event.preventDefault();runCommand(commandAt);}
});
$('#command-list').addEventListener('click',event=>{const li=event.target.closest('[data-i]');if(li)runCommand(Number(li.dataset.i));});
$('#command-bar').addEventListener('close',()=>{if(commandOpener?.isConnected&&document.activeElement===document.body)commandOpener.focus();});
$('#command-bar').addEventListener('click',event=>{if(event.target===$('#command-bar'))$('#command-bar').close();});
document.addEventListener('keydown',event=>{
  const mod=event.metaKey||event.ctrlKey;
  if(window.samestateChecks?.running&&mod&&['k','f'].includes(event.key.toLowerCase())){event.preventDefault();return;}
  if(mod&&!event.shiftKey&&event.key.toLowerCase()==='k'){event.preventDefault();if($('#command-bar').open)$('#command-bar').close();else openCommandBar();}
  else if(mod&&event.shiftKey&&event.key.toLowerCase()==='f'){event.preventDefault();openFind();}
});
