/* Run selected checks from the UI. Automated evidence and human decisions stay separate.
   Results live in this tab until exported; AI credentials and raw test files never enter the report. */
(() => {
  'use strict';
  const GROUPS = [
    { id: 'layout', name: 'Layout & content', note: 'Automatic · responsive layout, images, text, navigation and fields', cats: ['Layout', 'Content', 'Images', 'Typography', 'Tables', 'Navigation', 'Input'], selected: true },
    { id: 'accessibility', name: 'Accessibility & usability', note: 'Automatic · contrast, names, headings, landmarks and keyboard structure', cats: ['Accessibility', 'Usability'], selected: true },
    { id: 'meta', name: 'Meta & page errors', note: 'Automatic · metadata, social tags, JavaScript and resource errors', cats: ['Meta', 'Errors'], selected: true },
    { id: 'performance', name: 'Performance & page weight', note: 'Automatic · Web Vitals and network findings; measurement gaps stay visible', cats: ['Performance', 'Network'], selected: true },
    { id: 'links', name: 'Broken links', note: 'Automatic · same-origin HEAD requests without cookies; action links skipped' },
    { id: 'journey', name: 'Test journey', note: 'Automatic · a saved test, or a plan followed with your AI connection' },
    { id: 'settings', name: 'Screen settings & long text', note: 'Automatic + review · scan each non-vision setting and longer text' },
    { id: 'widths', name: 'Responsive width sweep', note: 'Automatic · sample 320–1920px; can take a few minutes' },
    { id: 'visual', name: 'Visual tools & interactions', note: 'Human review · debug tools, simulators, panels, forms and sync', selected: true },
    { id: 'capture', name: 'Capture & file output', note: 'Human review · screenshots, recordings and exported reports', selected: true },
    { id: 'workspaces', name: 'Workspace portability', note: 'Human review · save, reopen, export and import', selected: true }
  ];
  const LABELS = { queued: 'Queued', running: 'Running', passed: 'Passed', failed: 'Failed', warning: 'Warnings', incomplete: 'Incomplete', review: 'Needs human review', skipped: 'Skipped', stopped: 'Stopped' };
  const REVIEWS = {
    settings: [
      ['settings-look', 'Screen setting appearance', 'Compare default and changed previews: light/dark, 200% text, rotation, motion, contrast, print, forced colors, reduced data/transparency, P3, RTL and language. Check that switching back restores the page. Media-rule emulation has limits; automated findings do not establish visual correctness.', 'views'],
      ['vision-settings', 'Vision setting appearance', 'Compare the five vision settings with default previews: protanopia, deuteranopia, tritanopia, no color and blurred vision. Verify alternating screens, captures and clearing the setting. These filters are visual approximations.', 'views']
    ],
    visual: [
      ['outline-measure', 'Outline, measurements & suggestions', 'Inspect headings (including ARIA headings and hidden states), landmarks and estimated focus order. Toggle overlays, inspect a listed element or pick one, compare CSS size/spacing/type/contrast with the linked suggestions, and verify actual keyboard navigation.', 'outline'],
      ['panels', 'Meta & Console panels', 'Inspect metadata and all seven social previews in light/dark. Confirm console levels, duplicate grouping and screen names against a known message or error.', 'meta'],
      ['breakpoints', 'Breakpoint screens', 'Read CSS breakpoints, open their screens with and without the width just below each, then use Back to my devices. Cross-origin stylesheets and container queries are not included.', 'views'],
      ['layout-tools', 'Layout overlays & measurement', 'Check layout outlines, z-index, rulers/guides, column and baseline grid settings, area measurement and Alt/Option Peek. Confirm measurements and matching highlights across screens.', 'debug'],
      ['access-tools', 'Accessibility & keyboard tools', 'Check contrast, focus tracking, target size, small text, text spacing, roles, ARIA and both reachability overlays. Test Tab, arrow keys and Escape in the Debug menu.', 'debug'],
      ['content-tools', 'Content & style tools', 'Check forced hover/focus styles, edit content, hostile CSS, audible changes, readability and selected-text counts. Toggle CSS, images and cursor off and back on; verify restoration.', 'debug'],
      ['simulators', 'All 20 visual simulators', 'Check color and eyesight simulations, lighting, pointer-following effects, one-screen versus all-screen controls and mixed states. Confirm None clears the simulator and new/reloaded screens inherit the expected settings.', 'debug'],
      ['design', 'Design overlay', 'On one screen, load a design and inspect 1×/2×/3× scale, opacity, blend modes, split and offsets. Reload, confirm persistence, then remove it. Confirm it does not become an image finding.', 'debug'],
      ['find-command', 'Find elements & command bar', 'Search a valid/invalid CSS selector and move between matches across devices. Use ⌘K / Ctrl+K to find and execute an action; check keyboard selection and Escape.', 'find'],
      ['forms-sync', 'Form tools & typing sync', 'On a test page, try normal and edge-case autofill and clearing. Enable typing sync; verify text, selects and checkboxes reach matching fields without moving focus, and password/file/private fields are excluded. Switch sync off and verify it stops.', 'sync'],
      ['live-reload', 'Live reload', 'Test a timer, then local-site change detection: CSS swaps in place, HTML/script changes reload once, navigation and unchanged pages stay quiet. Turn Live reload off afterwards.', 'sync']
    ],
    capture: [
      ['screenshots', 'Screenshot files', 'Save visible-wall, full-page and all-screen overview captures in PNG, JPEG and PDF. Open each file and check dimensions, content, cropping and fixed/sticky elements. Chrome will ask you to share the Samestate tab.', 'capture'],
      ['recording', 'Automatic screenshots & recordings', 'Check screenshot pace, immediate Stop during a long interval, recording frame rate, playable 10 MB parts and saving to a chosen folder. Finish recording before marking this reviewed.', 'capture'],
      ['exports', 'Difference-report exports', 'Export Markdown, CSV, HTML and HTML with screenshots. Open the output and confirm findings, screen names and unmeasured previews are included.', 'diff']
    ],
    workspaces: [
      ['workspace-files', 'Save, restore, export & import workspaces', 'Save and reopen a setup; export/import it and check duplicate names and the 30-workspace limit. Reject invalid and empty files. Use disposable workspaces for this review.', 'workspaces']
    ]
  };
  const groupBox = $('#checks-groups'), options = $('#checks-options'), status = $('#checks-status');
  const progress = $('#checks-progress'), resultBox = $('#checks-results');
  let report = null, current = null;
  let demoPreview = null;
  let remembered = null;
  try { remembered = JSON.parse(localStorage.getItem('samestate.checkGroups') || 'null'); } catch {}
  groupBox.innerHTML = GROUPS.map(g => `<label class="checks-group"><input type="checkbox" value="${g.id}"${(Array.isArray(remembered) ? remembered.includes(g.id) : g.selected) ? ' checked' : ''}><span><b>${g.name}</b><small>${g.note}</small></span></label>`).join('');
  if (!IS_EXT) $('#checks-journey-mode option[value=ai]').disabled = true;

  const selected = () => [...groupBox.querySelectorAll('input:checked')].map(el => el.value);
  function updateSelection() {
    $('#checks-journey-options').hidden = !selected().includes('journey');
    const ai = selected().includes('journey') && $('#checks-journey-mode').value === 'ai';
    $('#checks-run').textContent = ai ? 'Run selected checks with AI' : 'Run selected checks';
    $('#checks-run').disabled = !!current || !selected().length;
    try { localStorage.setItem('samestate.checkGroups', JSON.stringify(selected())); } catch {}
  }
  function revealDrawer(drawer) {
    const sidebar = $('#sidebar');
    drawer.open = true;
    sidebar.scrollTop += drawer.getBoundingClientRect().top - sidebar.getBoundingClientRect().top;
  }
  function openSetup() {
    if ($('#sidebar').hidden) $('#toggle-sidebar').click();
    revealDrawer($('#checks-drawer'));
    showTab('checks');
  }
  function openDrawer(selector) {
    if ($('#sidebar').hidden) $('#toggle-sidebar').click();
    const element = $(selector), drawer = element?.closest('.sidebar-drawer');
    if (drawer) revealDrawer(drawer);
  }
  function reviewAction(action) {
    if (action === 'debug') $('#debug-all').click();
    else if (action === 'views') openDrawer('#screen-settings');
    else if (action === 'find') { openDrawer('#find-selector'); $('#find-selector').focus({ preventScroll: true }); }
    else if (action === 'sync') openDrawer('#synclist');
    else if (action === 'capture') openDrawer('#screenshot');
    else if (action === 'workspaces') openDrawer('#workspace-list');
    else showTab(action);
  }
  function counts() {
    const totals = Object.fromEntries(Object.keys(LABELS).map(s => [s, 0]));
    for (const row of report?.results || []) totals[row.status]++;
    return totals;
  }
  function overall() {
    if (current) return 'Running selected checks';
    const c = counts();
    if (report?.stopped) return 'Run stopped — incomplete';
    if (c.failed) return 'Issues found';
    if (c.review) return 'Needs human review';
    if (c.incomplete || c.skipped || c.stopped || c.queued) return 'Incomplete';
    if (c.warning) return 'Warnings found';
    return 'Passed';
  }
  function summary() {
    if (!report) return;
    const c = counts();
    const parts = ['passed', 'failed', 'warning', 'incomplete', 'review', 'skipped', 'stopped', 'queued'].filter(s => c[s]).map(s => `${c[s]} ${s === 'review' ? 'awaiting review' : s === 'warning' && c[s] === 1 ? 'warning' : LABELS[s].toLowerCase()}`);
    if (!current) status.textContent = `${overall()}. ${c.review} items need human review.`;
    const running = report.results.find(r => r.status === 'running');
    const live = current ? `<p>${esc(status.textContent || running?.name || 'Preparing checks…')}</p><button type="button" class="pill" data-checks-stop>Stop checks</button>` : '';
    $('#checks-summary').innerHTML = `<b>${esc(overall())}</b>${live}<span>${esc(parts.join(' · '))}</span><p class="muted">${esc(report.site)} · ${report.screens.length} screens</p>`;
    $('#checks-export-html').disabled = $('#checks-export-json').disabled = !!current;
  }
  function render() {
    if (!report) return;
    resultBox.innerHTML = report.results.map((row, i) => `<article class="check-result" data-index="${i}" data-status="${row.status}">
      <span class="check-badge">${LABELS[row.status]} · ${row.manual ? 'Human review' : 'Automated'}</span><h3>${esc(row.name)}</h3><p>${esc(row.detail || '')}</p>
      ${row.findings?.length ? `<details><summary>${row.findings.length} findings</summary><ul>${row.findings.map(f => `<li><b>${esc(f.severity)} · ${esc(f.screen)} · ${esc(f.title)}</b><br>${esc(f.detail)}</li>`).join('')}</ul></details>` : ''}
      ${row.steps?.length ? `<details><summary>Journey step results</summary><ul>${row.steps.map(s => `<li>${esc(s.action)}: ${esc(Object.entries(s.results || {}).map(([screen, r]) => `${screen}: ${r.result}${r.issues ? ` (${r.issues} issues)` : ''}`).join(' · ') || 'Not run')}</li>`).join('')}</ul></details>` : ''}
      ${row.manual ? `<div class="checks-review-actions"><button type="button" class="pill" data-review-open="${i}"${current ? ' disabled' : ''}>Open tools</button>${[['passed', 'Pass'], ['failed', 'Fail'], ['skipped', 'Skip'], ['review', 'Reset']].map(([s, label]) => `<button type="button" class="pill" data-review-status="${s}" aria-pressed="${row.status === s}"${current ? ' disabled' : ''}>${label}</button>`).join('')}</div><label class="review-notes-label">Review notes<textarea data-review-notes="${i}" maxlength="1000"${current ? ' disabled' : ''}>${esc(row.notes || '')}</textarea></label>` : ''}
    </article>`).join('');
    summary();
  }
  function snapshotReport(filter = () => true) {
    return findings.filter(filter).map(f => ({ severity: f.sev, category: f.cat, kind: f.kind, screen: reportName(f.dev), title: f.title, detail: f.detail }));
  }
  function measuredResult(row, items, scan, extra = '') {
    row.findings = items;
    const issues = items.filter(f => f.severity === 'issue').length, warnings = items.filter(f => f.severity === 'warn').length;
    const gaps = (scan?.missing || []).map(reportName);
    const noVitals = row.group === 'performance' && items.some(f => f.category === 'Performance' && /not measured|slowest interaction none yet/i.test(f.title));
    const uncheckedLinks = items.some(f => f.kind === 'Links not checked');
    row.status = issues ? 'failed' : gaps.length || !scan?.screens.length || noVitals || uncheckedLinks ? 'incomplete' : warnings ? 'warning' : 'passed';
    row.detail = `${issues} issues · ${warnings} warnings · ${scan?.screens.length || 0}/${report.screens.length} screens measured.`
      + (gaps.length ? ` Not measured: ${gaps.join(', ')}.` : '')
      + (noVitals ? ' Some Web Vitals have no measurement yet. Recheck in visible previews after actual interactions.' : '')
      + (uncheckedLinks ? ' Some links could not be checked.' : '') + (extra ? ' ' + extra : '');
  }
  function ensure(run) {
    if (run.stopped) throw new Error('Stopped by the tester.');
    if (openId !== run.openId || sitesMode || pageSteps || active().length !== run.screens.length || run.screens.some(d => !d.el || !active().includes(d))) {
      run.stopped = true;
      throw new Error('The site or device selection changed. Run checks again.');
    }
  }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function freeze(fromTour = false) {
    const nodes = [...document.querySelectorAll('#sidebar > details:not(#checks-drawer), .navbtns, #open, .right-tools > :not(#open-checks), .wall, #tour, #pane-diff, #pane-meta, #pane-console, #pane-outline')].filter(el => !fromTour || el.id !== 'tour');
    const before = nodes.map(el => [el, el.inert]);
    nodes.forEach(el => { el.inert = true; });
    options.disabled = true;
    $('#checks-select-all').disabled = $('#checks-select-none').disabled = true;
    return () => {
      before.forEach(([el, inert]) => { el.inert = inert; });
      options.disabled = false;
      $('#checks-select-all').disabled = $('#checks-select-none').disabled = false;
    };
  }
  async function freshScan(run) {
    ensure(run);
    const before = lastScan;
    await detect(true);
    ensure(run);
    if (!lastScan || lastScan === before) throw new Error('No new measurements were returned. Run this group again.');
  }
  function stop() {
    if (!current) return;
    current.stopped = true;
    current.controller.abort();
    if (sweepRun) sweepRun = 0;
    window.samestateTest?.stop();
    status.textContent = 'Stopping after the current measurement; restoring settings…';
  }
  async function start({ fromTour = false } = {}) {
    if (current) return;
    const ids = selected(), screens = active();
    const fail = message => { status.textContent = message; openSetup(); };
    if (!ids.length) return fail('Select at least one group.');
    if (sitesMode || pageSteps) return fail('Use the device wall: turn off Compare sites and Page steps first.');
    if (!target || !screens.length) return fail('Open a site and select devices first.');
    if (pendingSnap.size || sweepRun || journeyRunning || (tourRunning && !fromTour) || window.samestateTest?.busy || window.wallCapture?.busy) return fail('Finish the current demo, test, capture or sweep first.');
    const ai = ids.includes('journey') && $('#checks-journey-mode').value === 'ai';
    if (ai && !IS_EXT) return fail('AI test writing requires the Chrome extension. Saved tests work here.');
    if (ids.includes('journey') && !ai && !window.samestateTest.get().steps.length) return fail('Set up a saved test in Test runs, or choose AI and write a test plan first.');
    if (ai && !$('#test-plan').value.trim()) return fail('Write the test plan in Test runs first.');

    const run = current = { openId, screens: [...screens], stopped: false, controller: new AbortController() };
    const saved = { settings: screenSettings, longText, links: $('#check-links').checked, live: $('#live-reload').value, rotations: screens.map(d => [d, d.rot, d.settingRot]), findings, scan: lastScan, filter: catFilter };
    report = { format: 'samestate-checks', version: 1, startedAt: new Date().toISOString(), site: String(previewUrl || target), screens: screens.map(reportName), selectedGroups: ids, journeyMode: ids.includes('journey') ? ai ? 'ai' : 'saved' : null, stopped: false, results: [] };
    const jobs = [];
    const add = (group, name, execute) => {
      const row = { group, name, status: 'queued', manual: false, detail: '' };
      report.results.push(row); jobs.push({ row, execute }); return row;
    };
    // AI runs first so Chrome's permission request still belongs to the Run button's user gesture.
    if (ids.includes('journey')) add('journey', ai ? 'AI test journey' : 'Saved test journey', async row => {
      const result = await (ai ? window.samestateTest.write({ signal: run.controller.signal }) : window.samestateTest.runFromUI());
      ensure(run);
      row.status = result?.passed ? 'passed' : result?.cancelled ? 'skipped' : result?.error ? 'incomplete' : 'failed';
      row.detail = result?.error || result?.text || $('#test-status').textContent || 'The journey did not complete.';
      row.steps = result?.steps || [];
      const checks = row.steps.flatMap(s => Object.values(s.results || {}));
      if (row.status === 'passed' && checks.some(r => r.issues || r.warnings)) {
        row.status = checks.some(r => r.issues) ? 'failed' : 'warning';
        row.detail += ' Report checks found issues or warnings during the journey; inspect the step results.';
      }
    });
    let baseData = null, baseScan = null;
    for (const g of GROUPS.filter(g => ids.includes(g.id) && (g.cats || g.id === 'links'))) add(g.id, g.name, async row => {
      if (!baseData) {
        $('#check-links').checked = ids.includes('links');
        await freshScan(run);
        baseData = snapshotReport(); baseScan = lastScan;
        saved.findings = findings; saved.scan = lastScan;
      }
      const items = baseData.filter(f => g.id === 'links' ? LINK_KINDS.has(f.kind) : g.cats.includes(f.category) && !LINK_KINDS.has(f.kind));
      measuredResult(row, items, baseScan);
    });
    if (ids.includes('settings')) {
      for (const option of [...$('#screen-settings').options].filter(o => o.value && !VISION[o.value])) add('settings', 'Screen settings: ' + option.textContent, async row => {
        if (screens.length < 2) { row.status = 'incomplete'; row.detail = 'Select at least two devices so every-second-screen settings can be measured.'; return; }
        screenSettings = option.value; $('#screen-settings').value = option.value;
        longText = false; $('#long-text').checked = false;
        applyScreenSettings();
        const applied = screens.some(d => option.value === 'orientation' ? screenSetting(d) === 'landscape' : !!screenSetting(d));
        if (!applied) { row.status = 'incomplete'; row.detail = option.value === 'orientation' ? 'Select a phone or tablet in an alternating screen slot to measure landscape.' : 'This setting does not apply to these previews. Return to your regular devices before running this group.'; return; }
        await pause(950);
        await freshScan(run);
        measuredResult(row, snapshotReport(f => !['Meta', 'Errors', 'Network', 'Performance'].includes(f.cat)), lastScan, 'Measured in the alternating-screen setting. Visual correctness needs human review.');
      });
      add('settings', 'Long text (+35%)', async row => {
        screenSettings = saved.settings; $('#screen-settings').value = saved.settings;
        longText = true; $('#long-text').checked = true; applyScreenSettings(); await pause(950);
        await freshScan(run);
        measuredResult(row, snapshotReport(f => !['Meta', 'Errors', 'Network', 'Performance'].includes(f.cat)), lastScan);
      });
    }
    if (ids.includes('widths')) add('widths', 'Responsive width sweep', async row => {
      screenSettings = saved.settings; $('#screen-settings').value = saved.settings; longText = saved.longText; applyScreenSettings();
      const result = await sweepWidths();
      ensure(run);
      if (!result?.complete || result.missing.length) {
        row.status = 'incomplete'; row.detail = result?.missing.length ? `${result.missing.length} sampled widths did not answer.` : 'The sweep did not finish.';
        row.findings = snapshotReport(f => f.cat === 'Widths');
      } else measuredResult(row, snapshotReport(f => f.cat === 'Widths'), { screens, missing: [] }, `${result.widths} sampled widths; narrower gaps between samples may be missed. The sweep uses the reference screen.`);
    });
    for (const id of ids) for (const [key, name, detail, action] of REVIEWS[id] || []) report.results.push({ group: id, key, name, detail, action, status: 'review', manual: true, notes: '' });
    const unlock = freeze(fromTour);
    setLiveReload(''); $('#live-reload').value = '';
    progress.hidden = !jobs.length; progress.max = Math.max(jobs.length, 1); progress.value = 0;
    $('#checks-stop').hidden = false; updateSelection(); openSetup(); render();
    let completed = 0;
    // Keep progress useful while the existing journey/sweep runner works through its own steps.
    const observer = new MutationObserver(() => {
      const row = report.results.find(r => r.status === 'running');
      if (row?.group === 'journey') status.textContent = `Journey · ${$('#test-status').textContent}`;
      if (row?.group === 'widths') status.textContent = `Width sweep · ${$('#sweep span').textContent}`;
      summary();
    });
    observer.observe($('#test-status'), { childList: true, subtree: true, characterData: true });
    observer.observe($('#sweep'), { childList: true, subtree: true, characterData: true });
    try {
      for (const job of jobs) {
        ensure(run);
        job.row.status = 'running'; status.textContent = `${completed + 1}/${jobs.length} · ${job.row.name}…`; render();
        try { await job.execute(job.row); }
        catch (error) {
          job.row.status = run.stopped ? 'stopped' : 'incomplete'; job.row.detail = error.message;
          if (run.stopped) throw error;
        }
        completed++; progress.value = completed; render();
      }
    } catch (error) {
      report.reason = error.message;
    } finally {
      observer.disconnect();
      for (const row of report.results) if (['queued', 'running'].includes(row.status)) { row.status = 'stopped'; row.detail = report.reason || 'Stopped before this check finished.'; }
      if (openId === run.openId) {
        screenSettings = saved.settings; $('#screen-settings').value = saved.settings;
        longText = saved.longText; $('#long-text').checked = saved.longText;
        $('#check-links').checked = saved.links;
        applyScreenSettings();
        for (const [d, rot, settingRot] of saved.rotations) if (d.el) { d.rot = rot; d.settingRot = settingRot; layout(d); }
        fitWall();
        $('#screen-settings-help').hidden = !screenSettings; $('#screen-lang-row').hidden = screenSettings !== 'lang';
        findings = saved.findings; lastScan = saved.scan; catFilter = saved.filter; renderFindings();
      }
      $('#live-reload').value = saved.live; setLiveReload(saved.live);
      report.stopped = run.stopped; report.finishedAt = new Date().toISOString();
      current = null; unlock(); updateSelection(); $('#checks-stop').hidden = true;
      if (!jobs.length) progress.value = 1;
      status.textContent = `${overall()}. ${completed}/${jobs.length} automated checks finished. ${counts().review} items need human review.`;
      render(); showTab('checks');
    }
  }
  function exported() {
    if (!report) return null;
    return JSON.parse(JSON.stringify({ ...report, outcome: overall(), counts: counts(), limitations: [
      'Human review decisions are supplied by the tester, not established by automation.',
      'Automatic reports cover implemented checks; a clean report does not establish complete accessibility or visual correctness.',
      'Width sweeps sample widths. Media emulation, contrast and Web Vitals have the limits described in Samestate documentation.'
    ] }));
  }
  function download(format) {
    const data = exported(); if (!data || current) return;
    const html = format === 'html';
    const content = html ? `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Samestate — combined checks</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:1000px;margin:40px auto;padding:0 20px;color:#192333}article{border:1px solid #b7c0ce;border-radius:8px;padding:16px;margin:16px 0;overflow-wrap:anywhere}small,p{color:#46536a}li{margin:8px 0}h2{font-size:18px}pre{white-space:pre-wrap}</style><h1>Samestate checks — ${esc(data.outcome)}</h1><p>${esc(data.site)}<br>${esc(data.startedAt)} · ${data.screens.length} screens</p><p>${esc(Object.entries(data.counts).filter(([, n]) => n).map(([s, n]) => `${n} ${LABELS[s]}`).join(' · '))}</p>${data.results.map(r => `<article><small>${r.manual ? 'Human review' : 'Automated'} · ${LABELS[r.status]}</small><h2>${esc(r.name)}</h2><p>${esc(r.detail)}</p>${r.notes ? `<p><b>Tester notes:</b> ${esc(r.notes)}</p>` : ''}${r.findings?.length ? `<ul>${r.findings.map(f => `<li><b>${esc(f.severity)} · ${esc(f.screen)} · ${esc(f.title)}</b><br>${esc(f.detail)}</li>`).join('')}</ul>` : ''}${r.steps?.length ? `<pre>${esc(JSON.stringify(r.steps, null, 2))}</pre>` : ''}</article>`).join('')}<h2>Scope and limits</h2><ul>${data.limitations.map(s => `<li>${esc(s)}</li>`).join('')}</ul></html>` : JSON.stringify(data, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: html ? 'text/html' : 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `samestate-checks-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  groupBox.addEventListener('change', updateSelection);
  $('#checks-journey-mode').addEventListener('change', updateSelection);
  for (const [id, checked] of [['checks-select-all', true], ['checks-select-none', false]]) $('#' + id).addEventListener('click', () => { groupBox.querySelectorAll('input').forEach(el => { el.checked = checked; }); updateSelection(); });
  $('#open-checks').addEventListener('click', openSetup);
  $('#checks-show-results').addEventListener('click', () => showTab('checks'));
  $('#checks-configure-test').addEventListener('click', () => { openDrawer('#test-plan'); $('#test-plan').focus({ preventScroll: true }); if ($('#checks-journey-mode').value === 'ai') $('#test-ai').open = true; });
  $('#checks-run').addEventListener('click', () => start().catch(error => { status.textContent = error.message; }));
  $('#checks-stop').addEventListener('click', stop);
  $('#checks-summary').addEventListener('click', event => { if (event.target.closest('[data-checks-stop]')) stop(); });
  resultBox.addEventListener('click', event => {
    if (current) return;
    const button = event.target.closest('button'), card = button?.closest('[data-index]');
    const row = card && report?.results[Number(card.dataset.index)];
    if (!row?.manual) return;
    if (button.dataset.reviewOpen !== undefined) reviewAction(row.action);
    else if (['passed', 'failed', 'skipped', 'review'].includes(button.dataset.reviewStatus)) {
      row.status = button.dataset.reviewStatus;
      if (row.status === 'review') delete row.reviewedAt; else row.reviewedAt = new Date().toISOString();
      card.dataset.status = row.status; card.querySelector('.check-badge').textContent = `${LABELS[row.status]} · Human review`;
      card.querySelectorAll('[data-review-status]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.reviewStatus === row.status)));
      summary();
    }
  });
  resultBox.addEventListener('input', event => {
    const i = event.target.dataset.reviewNotes;
    if (!current && i !== undefined && report?.results[i]?.manual) { report.results[i].notes = event.target.value.slice(0, 1000); summary(); }
  });
  $('#checks-export-html').addEventListener('click', () => download('html'));
  $('#checks-export-json').addEventListener('click', () => download('json'));
  window.samestateChecks = {
    open: openSetup, get: exported, get running() { return !!current; }, stop,
    async previewDemo() {
      if (!tourRunning || target !== EXT || new URL(previewUrl).pathname !== DEMO_URL.pathname || current || demoPreview) return null;
      demoPreview = { report, status: status.textContent, hidden: progress.hidden, max: progress.max, value: progress.value };
      await start({ fromTour: true });
      return exported();
    },
    async restoreDemo() {
      const saved = demoPreview;
      if (!saved) return;
      stop();
      while (current) await pause(50);
      if (demoPreview !== saved) return;
      report = saved.report; demoPreview = null;
      if (report) render();
      else {
        $('#checks-summary').replaceChildren(); resultBox.replaceChildren();
        $('#checks-export-html').disabled = $('#checks-export-json').disabled = true;
      }
      status.textContent = saved.status;
      progress.hidden = saved.hidden; progress.max = saved.max; progress.value = saved.value;
    }
  };
  updateSelection();
})();
