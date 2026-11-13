/* Saves the current setup (screens, layout, views, sites, themes and notes) under a name, and restores it later.
   The setup in use when the Samestate tab closes is kept as "Last session". Everything stays in this browser. */
(() => {
  'use strict';
  const KEY = 'samestate.workspaces', LAST = 'samestate.lastSession', VERSION = 1, LIMIT = 30;
  const MODES = ['grid', 'row', 'focus'], ALIGNS = ['flex-start', 'center', 'flex-end'];
  const form = $('#workspace-form'), nameInput = $('#workspace-name'), list = $('#workspace-list'), status = $('#workspace-status');
  let restoring = false;

  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const say = text => { status.textContent = text; status.hidden = !text; };
  const finite = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi ? n : null;

  // The bundled sample site is saved by page name, so a workspace still opens it where Samestate is served from elsewhere.
  const portable = url => url.origin === EXT ? 'demo:' + url.pathname.slice(DEMO_PATH.length) : url.href;
  function unport(text) {
    try { return typeof text !== 'string' ? null : text.startsWith('demo:') ? new URL(text.slice(5) || 'index.html', DEMO_URL) : new URL(text); } catch { return null; }
  }
  const openable = url => url && (url.origin === EXT ? url.pathname.startsWith(DEMO_PATH) : /^https?:$/.test(url.protocol) && !url.username && !url.password);

  function collect() {
    const marks = {};
    const keep = (key, d) => {
      if (!d.el) return;
      const notes = d.annotations?.snapshot() || [];
      if (d.themeCss || notes.length) marks[key] = { themeCss: d.themeCss || '', notes };
    };
    DEVICES.forEach(d => keep('screen:' + d.id, d));
    pageScreens.forEach((d, i) => keep('step:' + i, d));
    sitePanels.forEach((site, i) => site.devices.forEach(d => keep(`site:${i}:${d.id}`, d)));
    return {
      version: VERSION,
      site: previewUrl ? portable(new URL(previewUrl)) : null,
      screens: DEVICES.filter(d => d.on).map(d => ({ id: d.id, rot: d.rot, linked: d.linked, scale: d.scaleOverride, physical: d.physicalScale, x: d.x, y: d.y })),
      layout: {
        mode, wallMode: sitesMode ? wallModeBeforeSites : pageSteps ? deviceWallMode : mode,
        zoom: Math.round(zoom * 100), align: $('#align .on')?.dataset.v, locked: layoutLocked,
        free: freePlacement.devices, freeSteps: freePlacement.steps, focus: focusDev?.id || null, calibration: calibrationWidthMm
      },
      views: {
        sameDevice, sharedDevice: sharedDeviceId, pageSteps,
        pages: pageScreens.map(d => ({ url: portable(new URL(d.pageUrl)), actions: d.actions || [], x: d.x, y: d.y }))
      },
      sync: Object.fromEntries(Object.entries(SYNC).map(([kind, [, on]]) => [kind, on])),
      reference: $('#ref').value,
      compare: sitesMode,
      sites: sitePanels.filter(site => site.url).map(site => ({ url: portable(site.url), view: site.picker.value })),
      marks
    };
  }

  function summary(setup) {
    const site = unport(setup.site);
    const where = !site ? 'No site' : site.origin === EXT ? 'Sample site' : site.host;
    const parts = [where, setup.screens.length + (setup.screens.length === 1 ? ' screen' : ' screens')];
    if (setup.views?.pageSteps) parts.push(setup.views.pages.length + ' page steps');
    if (setup.compare) parts.push(setup.sites.length + ' sites compared');
    return parts.join(' · ');
  }

  function applyMarks(marks) {
    for (const [key, saved] of Object.entries(marks && typeof marks === 'object' ? marks : {})) {
      const [kind, a, b] = key.split(':');
      const d = kind === 'screen' ? DEVICES.find(device => device.id === a)
        : kind === 'step' ? pageScreens[Number(a)]
        : kind === 'site' ? sitePanels[Number(a)]?.devices.find(device => device.id === b) : null;
      if (!d?.el) continue;
      if (typeof saved?.themeCss === 'string') { d.themeCss = saved.themeCss; if (d.ready) configure(d); }
      d.annotations?.restore(saved?.notes);
    }
  }

  async function restore(setup, label) {
    if (restoring || setup?.version !== VERSION || !Array.isArray(setup.screens)) { if (!restoring) say('This workspace cannot be opened.'); return; }
    const site = unport(setup.site);
    const sites = setup.compare && Array.isArray(setup.sites) ? setup.sites.slice(0, 6).map(s => ({ url: unport(s.url), view: s.view })).filter(s => openable(s.url)) : [];
    const external = [site, ...sites.map(s => s.url)].filter(url => openable(url) && url.origin !== EXT);
    if (external.length && !IS_EXT) { say(`This workspace opens ${external[0].host}. Use the Chrome extension to open it.`); return; }
    restoring = true;
    try {
      if (external.length) {
        // One request for every site, while the click still counts as the user's gesture. Each site's bare and
        // www host are asked for together, as when opening a site, so a redirect between them needs no second prompt.
        const granted = await chrome.permissions.request({ origins: [...new Set(external.flatMap(twinOrigins))] });
        if (!granted) { say('Allow site access in Chrome to open this workspace.'); return; }
      }
      say(`Opening ${label}…`);
      endTour(false);
      setSitesMode(false);
      setPageSteps(false);

      const saved = new Map(setup.screens.map(s => [s.id, s]));
      const missing = setup.screens.filter(s => !DEVICES.some(d => d.id === s.id)).length;
      for (const d of DEVICES) {
        const s = saved.get(d.id) || {};
        const physical = s.physical && typeof s.physical.presetId === 'string' && finite(s.physical.mmPerViewportPx, 0.001, 10) ? s.physical : null;
        Object.assign(d, { on: saved.has(d.id), rot: !!s.rot, linked: s.linked !== false, scaleOverride: finite(s.scale, 0.01, 2), physicalScale: physical, x: finite(s.x, 0, 1e5), y: finite(s.y, 0, 1e5) });
      }
      const views = setup.views || {};
      sameDevice = !!views.sameDevice;
      if (DEVICES.some(d => d.id === views.sharedDevice)) sharedDeviceId = views.sharedDevice;
      fillSharedDevices();
      for (const [kind, on] of Object.entries(setup.sync || {})) if (SYNC[kind]) SYNC[kind][1] = !!on;
      renderLeft();

      const layout = setup.layout || {};
      calibrationWidthMm = finite(layout.calibration, 5, 200);
      layoutLocked = !!layout.locked;
      freePlacement.devices = !!layout.free;
      setZoom(Math.round(finite(layout.zoom, 40, 200) || 100));
      if (ALIGNS.includes(layout.align)) $(`#align [data-v="${layout.align}"]`).click();
      updateMode(MODES.includes(layout.wallMode) ? layout.wallMode : 'grid');
      focusDev = DEVICES.find(d => d.id === layout.focus) || null;

      if (openable(site)) await open(site.origin === EXT ? DEMO_URL : site, true);
      else buildFrames();

      // Page steps stay open while another view is shown, so the journey is rebuilt either way.
      const pages = Array.isArray(views.pages) ? views.pages.slice(0, 30) : [];
      if (target && pages.length) {
        setPageSteps(true);
        pages.forEach((page, i) => {
          const url = unport(page?.url);
          const d = i === 0 ? pageScreens[0] : url?.origin === target ? addPage(url.href, Array.isArray(page.actions) ? page.actions : []) : null;
          if (d) Object.assign(d, { x: finite(page.x, 0, 1e5), y: finite(page.y, 0, 1e5) });
        });
        freePlacement.steps = !!layout.freeSteps;
        refreshViews();
        if (!views.pageSteps) {
          // A step replays its clicks after it loads, and only visible controls can be clicked, so the steps stay on screen until then.
          for (let i = 0; i < 80 && pageScreens.some(d => !d.ready || d.replayPending); i++) await sleep(100);
          await sleep(pageScreens.some(d => d.actions?.length) ? 1500 : 0);
          setPageSteps(false);
        }
      }

      if (sites.length) {
        for (const column of [...sitePanels]) column.el.querySelector('.site-close').click();
        setSitesMode(true); // starts two columns on the current site
        sites.forEach((saved, i) => {
          const column = sitePanels[i] || addSite(saved.url);
          if (i < 2) openSite(column, saved.url, true);
          if ([...column.picker.options].some(option => option.value === saved.view)) column.picker.value = saved.view;
          fitSite(column);
        });
        while (sitePanels.length > sites.length) sitePanels.at(-1).el.querySelector('.site-close').click();
        for (let i = 0; i < 50 && sitePanels.some(column => column.opening); i++) await sleep(100);
        updateSiteTools();
      }

      if (MODES.includes(layout.mode)) updateMode(layout.mode);
      relayout();
      applyMarks(setup.marks);
      if ([...$('#ref').options].some(option => option.value === setup.reference)) $('#ref').value = setup.reference;
      say(`Opened ${label}.` + (missing ? ` ${missing} saved ${missing === 1 ? 'device is' : 'devices are'} no longer in your list.` : ''));
    } catch {
      say(`Could not open ${label}. Try again.`);
    } finally {
      restoring = false;
    }
  }

  function render() {
    const saved = read(KEY) || [], last = read(LAST);
    const items = [...(last?.setup ? [{ ...last, name: 'Last session', last: true }] : []), ...saved];
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'workspace-empty';
      empty.textContent = 'No saved workspaces yet. Save the current screens, layout and sites to reopen them later.';
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...items.map(item => {
      const row = document.createElement('li');
      row.className = 'workspace';
      const text = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = item.name;
      const meta = document.createElement('small');
      meta.textContent = summary(item.setup) + ' · ' + new Date(item.savedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
      text.title = meta.textContent; // the sidebar is narrow, so the summary can be cut off
      text.append(name, meta);
      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'pill';
      openButton.textContent = 'Open';
      openButton.setAttribute('aria-label', 'Open ' + item.name);
      openButton.addEventListener('click', () => restore(item.setup, item.last ? 'the last session' : `“${item.name}”`));
      row.append(text, openButton);
      if (!item.last) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'workspace-delete';
        remove.textContent = '×';
        remove.title = 'Delete ' + item.name;
        remove.setAttribute('aria-label', remove.title);
        remove.addEventListener('click', () => {
          write(KEY, (read(KEY) || []).filter(other => other.name !== item.name));
          say(`Deleted “${item.name}”.`);
          render();
        });
        row.append(remove);
      }
      return row;
    }));
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = nameInput.value.trim().slice(0, 60);
    if (!name) return;
    const saved = (read(KEY) || []).filter(item => item.name.toLowerCase() !== name.toLowerCase());
    const replaced = saved.length < (read(KEY) || []).length;
    if (!write(KEY, [{ name, savedAt: Date.now(), setup: collect() }, ...saved].slice(0, LIMIT))) { say('This browser did not allow saving.'); return; }
    nameInput.value = '';
    say(replaced ? `Updated “${name}”.` : `Saved “${name}”.`);
    render();
  });

  // The guided demo's setup is not the user's, so it is not kept as the last session.
  addEventListener('pagehide', () => { if (!restoring && !tourRunning) write(LAST, { savedAt: Date.now(), setup: collect() }); });
  $('#workspaces-drawer').addEventListener('toggle', render);
  render();
})();
