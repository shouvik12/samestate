'use strict';

// CSS viewport presets. See the README for the viewport references.
const DEVICE_GROUPS = {
  android: 'Android phones',
  apple: 'Apple phones',
  tablets: 'Tablets',
  specials: 'Specials',
  custom: 'My custom devices'
};

function device(id, name, w, h, group, options = {}) {
  const kind = options.kind ?? (group === 'tablets' ? 'tablet' : 'phone');
  const os = options.os ?? (group === 'apple' ? 'ios' : 'android');
  const maxScale = { phone: .62, tablet: .5, desktop: .3 }[kind];
  const scale = options.scale ?? Math.min(maxScale, 640 / w, 660 / h);
  return { id, name, w, h, group, kind, os, scale, ...options };
}

const STARTER_DEVICES = [
  device('iphone', 'iPhone 11 Pro', 375, 812, 'apple', { notch: true, starter: true }),
  device('nexus7', 'Nexus 7', 600, 960, 'tablets', { starter: true }),
  device('desktop', 'Desktop', 1920, 1080, 'specials', { kind: 'desktop', os: '', starter: true }),
  device('macbook', 'MacBook Air', 1440, 900, 'specials', { kind: 'desktop', os: '', starter: true }),
  device('android', 'Android', 420, 680, 'android', { starter: true }),
  device('pixel', 'Pixel 3 XL', 412, 847, 'android', { starter: true }),
  device('ipad', 'iPad Pro 11″', 834, 1194, 'tablets', { os: 'ios', scale: .42, starter: true }),
  device('small', 'Small mobile', 320, 568, 'specials', { os: 'ios' }),
  device('large', 'Large display', 2560, 1440, 'specials', { kind: 'desktop', os: '', scale: .22 })
];

const ANDROID_PHONES = [
  ['galaxy-s20', 'Samsung Galaxy S20', 360, 800],
  ['xiaomi-mi-11i', 'Xiaomi Mi 11i', 360, 800],
  ['huawei-p30-pro', 'Huawei P30 Pro', 360, 780],
  ['pixel-5', 'Google Pixel 5', 393, 851],
  ['oneplus-nord-2', 'OnePlus Nord 2', 412, 915],
  ['galaxy-z-flip3', 'Galaxy Z Flip3', 360, 880],
  ['oppo-find-x3-pro', 'OPPO Find X3 Pro', 360, 804],
  ['galaxy-a12', 'Galaxy A12', 360, 800],
  ['galaxy-s21-ultra', 'Galaxy S21 Ultra', 360, 800],
  ['pixel-6-pro', 'Google Pixel 6 Pro', 360, 780],
  ['xiaomi-12', 'Xiaomi 12', 360, 800],
  ['galaxy-note20-ultra', 'Galaxy Note20 Ultra', 412, 883],
  ['galaxy-s22', 'Galaxy S22', 360, 780],
  ['galaxy-s22-plus', 'Galaxy S22+', 360, 780],
  ['galaxy-s22-ultra', 'Galaxy S22 Ultra', 360, 772],
  ['pixel-8', 'Google Pixel 8', 412, 915],
  ['galaxy-s24', 'Samsung Galaxy S24', 360, 780],
  ['galaxy-s24-ultra', 'Galaxy S24 Ultra', 384, 832],
  ['galaxy-a17', 'Samsung Galaxy A17', 412, 892],
  ['galaxy-s26-ultra', 'Galaxy S26 Ultra', 412, 891],
  ['infinix-hot-70', 'Infinix Hot 70', 360, 788],
  ['motorola-razr-70-ultra', 'Motorola Razr 70 Ultra', 412, 1008],
  ['pixel-10', 'Google Pixel 10', 412, 924],
  ['pixel-10-pro', 'Google Pixel 10 Pro', 410, 912],
  ['pixel-10-fold', 'Pixel 10 Fold (Folded)', 412, 901]
];

const APPLE_PHONES = [
  ['iphone-5', 'iPhone 5', 320, 568],
  ['iphone-se-2016', 'iPhone SE (2016)', 320, 568],
  ['iphone-x', 'iPhone X', 375, 812],
  ['iphone-xr', 'iPhone XR (2018)', 414, 896],
  ['iphone-11', 'iPhone 11', 414, 896],
  ['iphone-11-pro-max', 'iPhone 11 Pro Max', 414, 896],
  ['iphone-12-mini', 'iPhone 12 Mini', 375, 812],
  ['iphone-12', 'iPhone 12 (iOS 14)', 390, 844],
  ['iphone-12-pro', 'iPhone 12 Pro', 390, 844],
  ['iphone-12-pro-max', 'iPhone 12 Pro Max', 428, 926],
  ['iphone-13-mini', 'iPhone 13 Mini', 375, 812],
  ['iphone-13', 'iPhone 13 (iOS 16)', 390, 844],
  ['iphone-13-pro', 'iPhone 13 Pro', 390, 844],
  ['iphone-13-pro-max', 'iPhone 13 Pro Max', 428, 926],
  ['iphone-14', 'iPhone 14 (iOS 16)', 390, 844],
  ['iphone-14-plus', 'iPhone 14 Plus', 428, 926],
  ['iphone-14-pro', 'iPhone 14 Pro', 393, 852],
  ['iphone-14-pro-max', 'iPhone 14 Pro Max', 430, 932],
  ['iphone-15', 'iPhone 15 (iOS 26)', 393, 852],
  ['iphone-15-plus', 'iPhone 15 Plus', 430, 932],
  ['iphone-15-pro', 'iPhone 15 Pro', 393, 852],
  ['iphone-15-pro-max', 'iPhone 15 Pro Max', 430, 932],
  ['iphone-16', 'iPhone 16 (iOS 26)', 393, 852],
  ['iphone-16-plus', 'iPhone 16 Plus', 430, 932],
  ['iphone-16-pro-max', 'iPhone 16 Pro Max', 440, 956],
  ['iphone-17', 'iPhone 17 (iOS 26)', 402, 874],
  ['iphone-air', 'iPhone Air', 420, 912],
  ['iphone-17-pro', 'iPhone 17 Pro', 402, 873],
  ['iphone-17-pro-max', 'iPhone 17 Pro Max', 440, 956],
  ['iphone-18-pro', 'iPhone 18 Pro', 402, 874],
  ['iphone-18-pro-max', 'iPhone 18 Pro Max', 440, 956],
  ['iphone-duo-folded', 'iPhone Duo (Folded)', 466, 678]
];

const DEVICE_PRESETS = [
  ...STARTER_DEVICES,
  ...ANDROID_PHONES.map(([id, name, width, height]) => device(id, name, width, height, 'android')),
  ...APPLE_PHONES.map(([id, name, width, height]) => device(id, name, width, height, 'apple', {
    notch: !['iphone-5', 'iphone-se-2016'].includes(id)
  })),
  device('iphone-duo-unfolded', 'iPhone Duo (Unfolded)', 890, 626, 'apple', { kind: 'tablet' }),
  device('ipad-mini', 'iPad Mini', 768, 1024, 'tablets', { os: 'ios' }),
  device('ipad-air-4', 'iPad Air 4', 820, 1180, 'tablets', { os: 'ios' }),
  device('galaxy-tab-s7', 'Galaxy Tab S7', 800, 1280, 'tablets'),
  device('surface-duo', 'Microsoft Surface Duo', 1114, 705, 'tablets'),
  device('apple-watch-6', 'Apple Watch Series 6', 162, 197, 'specials', { os: 'ios', frame: 'watch', scale: 1 }),
  device('galaxy-fold2', 'Galaxy Fold2 (Unfolded)', 884, 1104, 'specials', { kind: 'tablet' }),
  device('dell-latitude', 'Dell Latitude', 1440, 809, 'specials', { kind: 'desktop', os: '' }),
  device('macbook-pro-16-2021', 'MacBook Pro 16″ (2021)', 1728, 1117, 'specials', { kind: 'desktop', os: '' }),
  device('macbook-neo-2026', 'MacBook Neo (2026)', 1204, 753, 'specials', { kind: 'desktop', os: '' }),
  device('imac-24', 'Apple iMac 24″', 2048, 1152, 'specials', { kind: 'desktop', os: '' }),
  device('samsung-smart-tv', 'Samsung Smart TV', 1920, 1080, 'specials', { kind: 'desktop', os: '', frame: 'display' }),
  device('kiosk', 'Self-service kiosk', 1080, 1920, 'specials', { kind: 'tablet', frame: 'display' }),
  device('zebra-mc330', 'Zebra MC330', 480, 800, 'specials'),
  device('zebra-tc78', 'Zebra TC78', 412, 818, 'specials'),
  device('sonoff-nspanel-pro', 'Sonoff NSPanel Pro', 480, 480, 'specials', { kind: 'tablet', frame: 'display' }),
  device('generic-smartphone', 'Non-branded smartphone', 360, 800, 'specials')
];

const CUSTOM_DEVICE_KEY = 'samestate.customDevices';
const CUSTOM_FRAMES = {
  'android-phone': { kind: 'phone', os: 'android' },
  'ios-phone': { kind: 'phone', os: 'ios' },
  'android-tablet': { kind: 'tablet', os: 'android' },
  'ios-tablet': { kind: 'tablet', os: 'ios' },
  desktop: { kind: 'desktop', os: '' }
};

function customDevice(id, name, width, height, frame) {
  if (typeof id !== 'string' || !/^custom-[a-f0-9-]+$/.test(id)) return null;
  if (typeof name !== 'string' || !name.trim() || name.length > 48) return null;
  if (!Number.isInteger(width) || width < 1 || width > 8192 || !Number.isInteger(height) || height < 1 || height > 8192) return null;
  if (!Object.hasOwn(CUSTOM_FRAMES, frame)) return null;
  return device(id, name.trim(), width, height, 'custom', { ...CUSTOM_FRAMES[frame], customFrame: frame });
}

function loadCustomDevices() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_DEVICE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    const presets = new Map();
    for (const entry of saved) {
      if (!entry) continue;
      const preset = customDevice(entry.id, entry.name, entry.width, entry.height, entry.frame);
      if (preset) presets.set(preset.id, preset);
    }
    return [...presets.values()];
  } catch {
    return [];
  }
}

function saveCustomDevices(presets) {
  const saved = presets.map(preset => ({
    id: preset.id,
    name: preset.name,
    width: preset.w,
    height: preset.h,
    frame: preset.customFrame
  }));
  localStorage.setItem(CUSTOM_DEVICE_KEY, JSON.stringify(saved));
}

function mountDevicePicker(devices, { toggle, add, remove }) {
  const list = document.querySelector('#devlist');
  const search = document.querySelector('#device-search');
  const selectedOnly = document.querySelector('#selected-devices');
  const total = document.querySelector('#active-device-count');
  const empty = document.querySelector('#device-empty');
  const form = document.querySelector('#custom-device-form');
  const addButton = document.querySelector('#add-device');
  const formStatus = document.querySelector('#custom-device-status');
  const groups = new Map(Array.from(list.querySelectorAll('[data-device-group]'), drawer => [drawer.dataset.deviceGroup, drawer]));
  const rows = new Map();
  let savedOpen;

  function normalise(text) {
    return text.toLowerCase().replaceAll('+', 'plus').replaceAll('×', 'x').replace(/[^a-z0-9]+/g, '');
  }

  function refresh() {
    const query = normalise(search.value);
    const filtering = !!query || selectedOnly.checked;
    if (filtering && !savedOpen) savedOpen = new Map([...groups].map(([id, drawer]) => [id, drawer.open]));
    let visible = 0;
    let selected = 0;

    for (const [group, drawer] of groups) {
      let matches = 0;
      let count = 0;
      for (const preset of devices) {
        if (preset.group !== group) continue;
        const { row, checkbox, keywords } = rows.get(preset.id);
        const matchesFilter = keywords.includes(query) && (!selectedOnly.checked || preset.on);
        row.hidden = !matchesFilter;
        checkbox.checked = preset.on;
        matches += Number(matchesFilter);
        count += Number(preset.on);
      }
      const badge = drawer.querySelector('.drawer-count');
      badge.textContent = count || '';
      badge.setAttribute('aria-label', count + ' selected');
      drawer.hidden = filtering && matches === 0;
      if (filtering) drawer.open = matches > 0;
      else if (savedOpen) drawer.open = savedOpen.get(group);
      visible += matches;
      selected += count;
    }

    if (!filtering) savedOpen = null;
    total.textContent = selected;
    total.setAttribute('aria-label', selected + ' devices selected');
    empty.textContent = selectedOnly.checked && !selected ? 'No devices selected.' : 'No matching devices.';
    empty.hidden = visible > 0;
  }

  function renderRows() {
    rows.clear();
    for (const drawer of groups.values()) drawer.querySelector('.device-options').replaceChildren();

    for (const preset of devices) {
      const row = document.createElement('div');
      row.className = 'device-option';
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.dev = preset.id;
      const name = document.createElement('span');
      name.className = 'device-name';
      name.textContent = preset.name;
      const dimensions = document.createElement('small');
      dimensions.textContent = preset.w + '×' + preset.h;
      label.append(checkbox, name, dimensions);
      row.append(label);
      if (preset.group === 'custom') {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'device-remove';
        removeButton.dataset.removeDevice = preset.id;
        removeButton.setAttribute('aria-label', 'Remove ' + preset.name);
        removeButton.textContent = '×';
        row.append(removeButton);
      }
      groups.get(preset.group).querySelector('.device-options').append(row);
      const keywords = normalise(preset.name + ' ' + dimensions.textContent + ' ' + DEVICE_GROUPS[preset.group]);
      rows.set(preset.id, { row, checkbox, keywords });
    }
    refresh();
  }

  function setFormOpen(open) {
    form.hidden = !open;
    addButton.setAttribute('aria-expanded', String(open));
    addButton.textContent = open ? 'Cancel' : '+ Add custom device';
    formStatus.hidden = true;
    if (open) form.elements.namedItem('name').focus();
  }

  function updateSaved(presets) {
    try {
      saveCustomDevices(presets);
      return true;
    } catch {
      formStatus.textContent = 'Chrome could not save your custom devices.';
      formStatus.hidden = false;
      return false;
    }
  }

  list.addEventListener('change', event => {
    const id = event.target.dataset.dev;
    if (!id) return;
    toggle(devices.find(preset => preset.id === id), event.target.checked);
    refresh();
  });

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-device]');
    if (!button) return;
    const preset = devices.find(preset => preset.id === button.dataset.removeDevice);
    const keep = devices.filter(item => item.group === 'custom' && item !== preset);
    if (updateSaved(keep)) {
      remove(preset);
      renderRows();
      addButton.focus();
    }
  });

  search.addEventListener('input', refresh);
  selectedOnly.addEventListener('change', refresh);
  addButton.addEventListener('click', () => setFormOpen(form.hidden));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const fields = new FormData(form);
    const preset = customDevice('custom-' + crypto.randomUUID(), fields.get('name'), Number(fields.get('width')), Number(fields.get('height')), fields.get('frame'));
    if (!preset) {
      formStatus.textContent = 'Enter a name and whole-pixel dimensions between 1 and 8192.';
      formStatus.hidden = false;
      return;
    }
    if (!updateSaved([...devices.filter(item => item.group === 'custom'), preset])) return;

    add(preset);
    form.reset();
    setFormOpen(false);
    search.value = '';
    selectedOnly.checked = false;
    renderRows();
    groups.get('custom').open = true;
    rows.get(preset.id).checkbox.focus();
  });

  renderRows();
  return refresh;
}
