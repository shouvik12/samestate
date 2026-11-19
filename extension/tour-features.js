/* The recent-features chapter of the guided demo. Uses the real local tools on the bundled site. */
(() => {
  'use strict';
  let saved = null;
  const message = 'Samestate demo: this message came from the preview.';
  const controls = ['#outline-mode', '#outline-issues-only', '#console-level', '#find-selector', '#checks-journey-mode', '#check-links', '#test-ai', '#breakpoint-edges'];
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  function restoreStorage(key, value) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch {} }
  function modal(dialog) {
    saved?.modals.add(dialog);
    // A native modal paints above the page. Keep the tour's explanation and Skip/Pause in that layer too.
    const nodes = ['#tour', '#tour-callout', '#tour-ring', '#tour-cursor'].map($).filter(Boolean);
    for (const node of nodes) dialog.append(node);
    dialog.addEventListener('close', () => { for (const node of nodes) if (node.parentNode === dialog) document.body.append(node); }, { once: true });
  }
  function closeModals() { for (const dialog of saved?.modals || []) if (dialog.open) dialog.close(); saved?.modals.clear(); }
  async function work(promise) {
    const state = saved;
    state?.jobs.add(promise);
    try { return await promise; } finally { state?.jobs.delete(promise); }
  }
  function begin() {
    saved = {
      jobs: new Set(), modals: new Set(), settings: screenSettings, longText, live: $('#live-reload').value, form: SYNC.form[1], catFilter, newOnly,
      wall: { tools: new Set(wallDebug.tools), sim: wallDebug.sim },
      devices: new Map(DEVICES.map(d => [d, { debug: d.debug && new Set(d.debug), sim: d.sim, design: d.design, outline: d.outlineState && { ...d.outlineState } }])),
      values: controls.map(id => { const el = $(id); return [el, el.value, el.checked, el.open]; }),
      groups: [...$('#checks-groups').querySelectorAll('input')].map(el => [el, el.checked]),
      groupStorage: read('samestate.checkGroups'), aiOpen: $('#test-ai').open, baseline: null,
      findIndex, findSelector, findStatus: $('#find-status').textContent,
      ref: $('#ref').value, sharedDevice: sharedDeviceId, panelHidden: $('#panel').hidden, sweep: false, reset: null
    };
    clearEffects();
    setLiveReload(''); $('#live-reload').value = '';
  }
  function clearEffects() {
    closeModals(); closeDebugMenu(false);
    wallDebug.tools.clear(); wallDebug.sim = '';
    for (const d of connectedScreens()) {
      d.debug = new Set(); d.sim = ''; applyDebug(d);
      if (d.outlineState) { d.outlineState = { headings: false, landmarks: false, focus: false, pick: false, selected: null }; post(d, 'outline-state', { state: d.outlineState }); }
      if (d.design) { d.design = null; sendDesign(d); }
    }
    screenSettings = ''; $('#screen-settings').value = ''; longText = false; $('#long-text').checked = false; applyScreenSettings();
  }
  function reset() {
    const state = saved;
    if (!state) return Promise.resolve();
    if (state.reset) return state.reset;
    state.reset = (async () => {
      if (state.sweep) sweepRun = 0;
      await Promise.all([window.samestateChecks?.restoreDemo(), window.samestateTest?.restoreDemo()]);
      await Promise.allSettled([...state.jobs]);
      clearEffects(); closeBreakpoints(); undoAllFixes();
      if (state.baseline && read(state.baseline.key) === state.baseline.written) restoreStorage(state.baseline.key, state.baseline.before);
      for (const tool of state.wall.tools) wallDebug.tools.add(tool);
      wallDebug.sim = state.wall.sim;
      for (const d of DEVICES) {
        const previous = state.devices.get(d);
        if (!previous) continue;
        d.debug = previous.debug; d.sim = previous.sim; d.design = previous.design; d.outlineState = previous.outline;
        if (d.ready) { applyDebug(d); sendDesign(d); post(d, 'outline-state', { state: d.outlineState || {} }); }
      }
      screenSettings = state.settings; $('#screen-settings').value = state.settings;
      longText = state.longText; $('#long-text').checked = state.longText; SYNC.form[1] = state.form;
      const form = $('#synclist [data-sync=form]'); if (form) form.checked = state.form;
      for (const [el, value, checked, open] of state.values) { el.value = value; if (checked !== undefined) el.checked = checked; if (open !== undefined) el.open = open; }
      for (const [el, checked] of state.groups) el.checked = checked;
      $('#checks-groups').dispatchEvent(new Event('change', { bubbles: true }));
      restoreStorage('samestate.checkGroups', state.groupStorage);
      if ([...$('#ref').options].some(o => o.value === state.ref)) $('#ref').value = state.ref;
      sharedDeviceId = state.sharedDevice;
      applyScreenSettings(); $('#live-reload').value = state.live; setLiveReload(state.live);
      catFilter = state.catFilter; newOnly = state.newOnly; renderFindings();
      findIndex = state.findIndex; findSelector = state.findSelector; $('#find-status').textContent = state.findStatus;
      for (const d of connectedScreens()) if (d.ready) post(d, 'find', { rid: crypto.randomUUID(), selector: findSelector, index: findIndex });
      consoleEntries.delete('info|' + message); renderConsole();
      $('#panel').hidden = state.panelHidden;
      saved = null;
    })();
    return state.reset;
  }
  const point = async (t, target) => { t.focus(target); return t.point(target); };
  const change = (id, value) => { const el = $(id); if (typeof value === 'boolean') el.checked = value; else el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); };
  const test = {
    samestate: 'test', version: 1, site: 'demo:index.html',
    plan: 'Open Pricing, check its headline, return to the overview, and check its heading.',
    steps: [
      { do: 'click', target: { role: 'link', name: 'Pricing', nav: true } },
      { do: 'expect', text: 'Pay for events' },
      { do: 'click', target: { role: 'link', name: 'Back to overview' } },
      { do: 'expect', text: 'Numbers that explain themselves' }
    ]
  };
  const extras = [
    {
      title: 'Preview fixes and baselines', at: '#detect', wait: 3000,
      text: 'Save a baseline, try a suggested CSS fix and scan again. Here the wide table disappears from the report and appears under <b>fixed since the baseline</b>. Undo returns the original page.',
      run: async t => {
        searchDevices(''); catFilter = null; await work(detect(true)); if (!t.ok()) return; showTab('diff');
        const key = baselineKey(); saved.baseline = { key, before: read(key) }; saveBaseline(); saved.baseline.written = read(key);
        const group = issueGroups(findings).find(g => g.kind === 'Table is wider than its container');
        if (!group) throw new Error('The demo table finding is missing.');
        const button = () => [...$('#findings').querySelectorAll('[data-fix]')].find(b => b.closest('.finding')?.textContent.includes('Table is wider'));
        if (!await t.click(button)) return; toggleFix(group.items);
        if (!await t.nap(700)) return;
        await work(detect(true)); if (t.ok()) await point(t, '#baseline');
      }
    },
    {
      title: 'Accessibility, vitals and page weight', at: '#panel', wait: 2800,
      text: 'The report also checks names, contrast, landmarks, keyboard structure and page weight. <b>Web Vitals</b> show timing and layout shifts; unmeasured previews stay visible instead of silently passing.',
      run: async t => {
        undoAllFixes(); await work(detect(true)); if (!t.ok()) return;
        catFilter = 'Accessibility'; renderFindings(); showTab('diff'); await t.nap(1100);
        if (!t.ok()) return; catFilter = 'Network'; renderFindings(); await point(t, '#findings');
      }
    },
    {
      title: 'Sweep responsive widths', at: '#sweep', wait: 2600,
      text: '<b>Sweep widths</b> tests 320–1920px and narrows transitions to the pixel. Follow the live width counter; the result says exactly where the sample page scrolls sideways.',
      run: async t => {
        $('#ref').value = 'iphone'; if (!await t.click('#sweep')) return;
        saved.sweep = true; try { await work(sweepWidths()); } finally { if (saved) saved.sweep = false; }
        if (!t.ok()) return; $('#ref').value = 'desktop'; await point(t, '#sweep-status');
      }
    },
    {
      title: 'Screen settings and long text', at: '#screen-settings', wait: 2200,
      text: 'Compare alternating screens at <b>200% text</b>, reduced motion, more contrast, print, forced colors, RTL or another language. Longer text reveals layouts that break during translation.',
      run: async t => {
        $('#panel').hidden = true; catFilter = null;
        for (const value of ['text', 'motion', 'rtl']) { if (!await point(t, '#screen-settings')) return; change('#screen-settings', value); if (!await t.nap(1000)) return; }
        change('#screen-settings', ''); if (!await t.click('#long-text')) return;
        longText = true; $('#long-text').checked = true; applyScreenSettings();
      }
    },
    {
      title: 'Breakpoint screens', at: '#find-breakpoints', wait: 2600,
      text: 'Read breakpoints from the site’s CSS and open a screen at each boundary. Include the pixel just below each breakpoint to compare both sides, then return to your device selection.',
      run: async t => {
        clearEffects(); if (!await t.click('#find-breakpoints')) return;
        await work(findBreakpoints()); if (!t.ok()) return;
        change('#breakpoint-edges', true); if (!await t.click('#open-breakpoints')) return;
        openBreakpoints(); await t.until(() => active().length && active().every(d => d.ready));
      }
    },
    {
      title: 'Debug overlays', at: '#debug-all', wait: 2600,
      text: 'The bug menu opens tools for <b>one screen or every screen</b>: contrast, tap targets, focus tracking, text spacing, roles, ARIA and layout outlines. These overlays help a tester inspect the rendered page.',
      run: async t => {
        closeBreakpoints(); $('#ref').value = 'desktop'; if (!await t.until(() => active().every(d => d.ready))) return;
        const d = dev('iphone'); openDebugMenu(d, d.el.querySelector('[data-a=debug]'));
        for (const tool of ['contrast', 'target', 'layout']) { if (!await t.click(() => debugMenu.querySelector(`[data-tool="${tool}"]`))) return; setTool(tool); }
        await point(t, () => d.el); closeDebugMenu(false);
      }
    },
    {
      title: 'Visual simulators', at: '#debug-all', wait: 2400,
      text: 'Preview color-vision, eyesight and lighting simulations. Here <b>protanopia</b> affects every screen. Filters are visual approximations; the tester still judges appearance and interactions.',
      run: async t => {
        clearEffects(); openDebugMenu('all', $('#debug-all'));
        if (!await t.click(() => debugMenu.querySelector('[data-sim=protanopia]'))) return;
        setSim('protanopia'); closeDebugMenu(false); await point(t, () => dev('desktop').el);
      }
    },
    {
      title: 'Rulers and layout grids', at: '#debug-all', wait: 2200,
      text: 'Use rulers and guides, a column grid and a baseline grid to check alignment. Grid settings control columns, gutters, margins and baseline spacing; area and text measurement tools share the same menu.',
      run: async t => {
        clearEffects(); debugTarget = dev('iphone'); for (const tool of ['rulers', 'columns', 'baseline']) setTool(tool); debugTarget = null;
        openGridSettings(); modal($('#grid-dialog')); await point(t, '#grid-columns');
      }
    },
    {
      title: 'Design reference overlay', at: '#debug-all', wait: 2400,
      text: 'Compare one screen with a design image. Adjust <b>opacity, difference blend, split and offsets</b> to spot misalignment. The sample uses its dashboard illustration as the reference.',
      run: async t => {
        clearEffects(); const d = dev('desktop');
        const response = await work(fetch(new URL('hero-wide.svg', DEMO_URL))); const svg = await work(response.text()); if (!t.ok()) return;
        const image = d.iframe.contentDocument.querySelector('img[alt="Dashboard preview"]'), r = image.getBoundingClientRect();
        d.design = { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), w: r.width, h: r.height, scale: 1, opacity: .6, mode: 'difference', split: 35, x: r.left + 12, y: r.top + d.iframe.contentWindow.scrollY, visible: true };
        sendDesign(d); openDesign(d); modal($('#design-dialog')); await point(t, '#design-opacity');
      }
    },
    {
      title: 'Find elements across screens', at: '#find-selector', wait: 2200,
      text: 'Search a CSS selector to outline matching elements on every device. <b>Previous</b> and <b>Next</b> move between matches, making repeated headings, buttons or form fields easy to inspect.',
      run: async t => {
        clearEffects(); if (!await point(t, '#find-selector')) return;
        $('#find-selector').value = 'h1'; await work(findElements(1));
      }
    },
    {
      title: 'Forms, typing sync and live reload', at: '#synclist [data-sync=form]', wait: 2600,
      text: 'Fill test forms with normal or edge-case data, and enable <b>Typing & form fields</b> to mirror edits. Live reload can refresh a local site when its files change. Private and password fields are excluded from typing sync.',
      run: async t => {
        if (!await t.click(inScreen('desktop', '.signin.desk-only'))) return;
        play('desktop', { do: 'click', sel: '.signin.desk-only' });
        if (!await t.nap(900)) return;
        debugTarget = 'all'; runDebugAction('fill-valid'); debugTarget = null;
        change('#synclist [data-sync=form]', true); await point(t, '#synclist [data-sync=form]');
      }
    },
    {
      title: 'Search every tool', at: '#search-tools', wait: 2600,
      text: '<b>Search tools</b>, or ⌘K / Ctrl+K, finds features by name or purpose. Search for metadata: the results explain the Meta overview and show when a tool needs another step first.',
      run: async t => {
        if (!await t.click(inScreen('iphone', '#signin .close'))) return; play('iphone', { do: 'click', sel: '#signin .close' });
        if (!await t.point('#search-tools')) return; openCommandBar({ fromTour: true }); modal($('#command-bar'));
        $('#command-input').value = 'meta'; renderCommands(); await point(t, '#command-input');
      }
    },
    {
      title: 'Meta and social previews', at: '#panel', wait: 2800,
      text: 'All metadata in one overview: missing or duplicated values, title and description lengths, canonical links and social tags. Seven social previews show how the page may be shared.',
      run: async t => {
        closeModals(); showTab('meta'); await work(readMeta()); if (t.ok()) await point(t, '#meta-view');
      }
    },
    {
      title: 'Console across devices', at: '#panel', wait: 2200,
      text: 'Read logs, warnings and errors from every screen in one panel. Repeated messages are grouped with their screen names. This sample info message is emitted by each live preview.',
      run: async t => {
        showTab('console'); change('#console-level', 'all');
        for (const d of active()) post(d, 'demo', { do: 'console', sel: 'body' });
        if (await t.until(() => consoleEntries.get('info|' + message)?.screens.size === active().length)) await point(t, '#console-list');
      }
    },
    {
      title: 'Outline and measurements', at: '#open-outline', wait: 3000,
      text: '<b>Measure</b> lists headings and landmarks, including hidden states. Choose a heading to inspect its CSS size, margin, padding, typography and contrast, with linked best-practice suggestions.',
      run: async t => {
        showTab('outline', { fromTour: true });
        if (!await t.until(() => window.samestateOutline.get().data?.headings.length)) return;
        change('#outline-mode', 'headings'); change('#outline-issues-only', false); change('#outline-headings-overlay', true);
        const first = () => $('#outline-list [data-outline-key]'); if (!await t.click(first)) return; first().click();
        if (await t.until(() => !!window.samestateOutline.get().measurement)) await point(t, '#outline-measurements');
      }
    },
    {
      title: 'Keyboard order and landmarks', at: '#outline-mode', wait: 2600,
      text: 'Switch between <b>landmarks</b> and estimated <b>keyboard focus order</b>, then draw the overlay. Verify real Tab/Shift+Tab navigation yourself; the DOM estimate is a guide for human review.',
      run: async t => {
        change('#outline-headings-overlay', false); change('#outline-mode', 'landmarks'); change('#outline-landmarks-overlay', true);
        if (!await t.nap(1000)) return;
        change('#outline-landmarks-overlay', false); change('#outline-mode', 'focus'); change('#outline-focus-overlay', true); await point(t, '#outline-list');
      }
    },
    {
      title: 'Replay a saved test', at: '#test-plan', wait: 2600,
      text: 'A saved journey replays the same steps on every linked screen, with a result for each device. This bundled test opens Pricing, checks its headline, returns to the overview and checks its heading.',
      run: async t => {
        clearEffects(); $('#panel').hidden = true;
        if (!window.samestateTest.previewDemo(test)) throw new Error('The sample test could not start.');
        if (!await point(t, '#test-plan') || !await t.nap(900) || !await t.click('#test-run')) return;
        const result = await work(window.samestateTest.run()); if (!t.ok()) return;
        if (!result?.passed) throw new Error(result?.text || 'The sample test failed.'); await point(t, '#test-steps');
      }
    },
    {
      title: 'Optional AI test writing', at: '#test-ai', wait: 2800,
      text: 'In the extension, connect <b>OpenRouter</b> or another compatible provider to turn a written plan into steps. Saved tests replay without AI. The guided demo uses its bundled test and does not call an AI service.',
      run: async t => { $('#test-ai').open = true; await point(t, '#test-ai'); }
    },
    {
      title: 'Run all checks', at: '#open-checks', wait: 2800,
      text: 'Choose groups, then run them together. Live progress leads to one combined result for layout, accessibility, metadata, page errors and performance. Journeys, screen-setting scans and width sweeps are optional groups.',
      run: async t => {
        window.samestateChecks.open();
        for (const el of $('#checks-groups').querySelectorAll('input')) el.checked = ['layout', 'accessibility', 'meta', 'performance', 'visual', 'capture', 'workspaces'].includes(el.value);
        $('#checks-groups').dispatchEvent(new Event('change', { bubbles: true }));
        if (!await point(t, '#checks-groups') || !await t.nap(1000) || !await t.click('#checks-run')) return;
        const report = await work(window.samestateChecks.previewDemo()); if (!t.ok()) return;
        if (!report?.finishedAt) throw new Error('The grouped demo checks did not finish.'); await point(t, '#checks-summary');
      }
    },
    {
      title: 'Human review and combined results', at: '#checks-results', wait: 3000,
      text: '<b>Needs human review</b> stays separate from automated results. A tester opens each visual tool, records Pass/Fail/Skip and notes, then exports one HTML or JSON report. The demo leaves these decisions pending.',
      run: async t => { await point(t, '#checks-results .check-result[data-status=review]'); }
    },
    {
      title: 'Share workspaces and reports', at: '#workspaces-drawer', wait: 2800,
      text: 'Save and reopen a device setup, or <b>export/import workspaces</b> with your team. Difference reports export as Markdown, CSV or HTML; combined checks have their own HTML/JSON export.',
      run: async t => {
        $('#panel').hidden = true; if (!await point(t, '#workspace-export')) return;
        await t.nap(900); if (t.ok()) await point(t, '#workspace-import');
      }
    }
  ];
  async function prepareStep(title, t) {
    // A carousel jump starts with a fresh sample wall. Prepare just the selected step's prerequisites.
    const p = { ...t, point: async () => t.ok(), click: async () => t.ok(), focus: () => {}, nap: ms => t.nap(Math.min(ms, 300)) };
    const all = test => active().length && active().every(d => d.ready && d.iframe.contentDocument && test(d.iframe.contentDocument));
    const click = async (id, selector, ready) => {
      if (!t.ok()) return;
      play(id, { do: 'click', sel: selector });
      if (ready) await t.until(() => all(ready)); else await p.nap(300);
    };
    const scroll = async selector => { play('desktop', { do: 'scroll', sel: selector }); await t.nap(1000); };
    $('#ref').value = 'desktop';
    if (title === 'Same state, different layout') {
      await click('desktop', '.dd-btn', doc => doc.querySelector('#drawer.open') || doc.querySelector('.dd-menu:not([hidden])'));
    } else if (['Any screen can lead', 'Search every tool'].includes(title)) {
      await click('desktop', '.signin.desk-only', doc => doc.querySelector('#signin')?.open);
    } else if (title === 'Works both ways') {
      await click('iphone', '.mob-only .mode-toggle', doc => doc.documentElement.classList.contains('dark'));
    } else if (['Difference report', 'Annotations'].includes(title)) {
      await scroll('#plans');
    } else if (title === 'Unlink a screen') {
      await scroll('#tour-video');
    } else if (title === 'Align screens') {
      await scroll('#tour-video'); if (!t.ok()) return;
      setDeviceLink(dev('iphone'), false); await scroll('#stories');
    } else if (title === 'Back from any screen') {
      await demoLink('desktop', '.desk > a[href="pricing.html"]')(p);
    } else if (title === 'Back to the grid') {
      setMode('row'); pinScreens(); dev('iphone').scaleOverride = 1; relayout();
    } else if (title === 'Follow a link') {
      sharedDeviceId = 'iphone'; await tourPageSteps(p);
    } else if (title === 'Page steps') {
      sharedDeviceId = 'iphone';
    } else if (title === 'Screenshot and Record') {
      tourCompare(); await t.until(() => workspaceScreens().length && workspaceScreens().every(d => d.ready));
    } else if (title === 'Keyboard order and landmarks') {
      showTab('outline', { fromTour: true }); await t.until(() => !!window.samestateOutline.get().data);
    } else if (title === 'Optional AI test writing') {
      window.samestateTest.previewDemo(test);
    } else if (title === 'Human review and combined results') {
      await extras.find(step => step.title === 'Run all checks').run(p);
    }
  }
  const index = STEPS.findIndex(step => step.title === 'Themes');
  STEPS.splice(index, 0, ...extras);
  window.samestateTourFeatures = { begin, reset, prepareStep, titles: extras.map(s => s.title), get active() { return !!saved; } };
})();
