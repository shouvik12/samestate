/* Outline, element measurements and linked guidance. Reads one preview through the agent bridge. */
(() => {
  'use strict';
  const pane = $('#pane-outline'), select = $('#outline-screen'), status = $('#outline-status');
  const list = $('#outline-list'), inspector = $('#outline-measurements');
  let devices = [], device = null, data = null, measurement = null, readId = 0, measureId = 0;
  const state = d => d.outlineState ??= { headings: false, landmarks: false, focus: false, pick: false, selected: null };
  function sendState(d = device) { if (d?.ready) post(d, 'outline-state', { state: state(d) }); }
  const isOpen = () => !$('#panel').hidden && !pane.hidden;
  function updateControls() {
    for (const key of ['headings', 'landmarks', 'focus']) $('#outline-' + key + '-overlay').checked = !!device && state(device)[key];
    const picking = !!device && state(device).pick;
    $('#outline-pick').setAttribute('aria-pressed', String(picking)); $('#outline-pick').textContent = picking ? 'Cancel pick' : 'Pick element';
    $('#outline-pick').disabled = !device?.ready;
    $('#outline-export').disabled = !data && !measurement;
  }
  function screens() {
    devices = workspaceScreens();
    const wanted = devices.includes(device) ? device : referenceScreen() || devices[0] || null;
    select.innerHTML = devices.map((d, i) => `<option value="${i}"${d === wanted ? ' selected' : ''}>${esc(reportName(d))}${d.ready ? '' : ' · loading'}</option>`).join('');
    if (wanted !== device) { if (device) { state(device).pick = false; sendState(device); } device = wanted; data = measurement = null; }
    updateControls();
  }
  function guidance(items) {
    return (items || []).map(item => {
      let href = '';
      try { const url = new URL(item.source); if (url.protocol === 'https:' && url.hostname === 'www.w3.org' && url.pathname.startsWith('/WAI/')) href = url.href; } catch {}
      const kind = item.kind === 'check' ? 'Check' : item.kind === 'review' ? 'Human review' : 'Best practice';
      return `<div class="outline-suggestion"><small>${kind}</small><b>${esc(item.title)}</b><p>${esc(item.detail)}</p>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">W3C guidance ↗</a>` : ''}</div>`;
    }).join('');
  }
  function renderList() {
    $('#outline-page-info').innerHTML = data ? `<b>${esc(data.title || '(untitled page)')}</b><span>${esc(data.url)}</span>` : '';
    if (!data) { list.innerHTML = '<p class="muted">Refresh to read this preview’s outline.</p>'; $('#outline-page-suggestions').innerHTML = ''; return; }
    const mode = $('#outline-mode').value, all = data[mode] || [];
    const items = $('#outline-issues-only').checked ? all.filter(i => i.suggestions.length) : all;
    $('#outline-page-suggestions').innerHTML = guidance(data.suggestions);
    list.innerHTML = `<p class="outline-count">${items.length}/${all.length} ${mode === 'focus' ? 'focus stops' : mode} shown${data.truncated ? ' · scan limit reached (800 items per list)' : ''}</p>`
      + (items.length ? '<ol class="outline-items">' + items.map(item => `<li style="--outline-depth:${mode === 'headings' ? Math.min(5, item.level - 1) : 0}"><button type="button" data-outline-key="${esc(item.key)}" aria-pressed="${measurement?.key === item.key}"><code>${esc(mode === 'headings' ? 'h' + item.level : mode === 'focus' ? '#' + item.order + ' ' + item.role : item.role)}</code><span>${esc(item.name || '(unnamed)')}<small>${item.hidden ? '<em>Not visible</em>' : ''}${item.atHidden ? '<em>Hidden from AT</em>' : ''}${mode === 'headings' && !/^h[1-6]$/.test(item.tag) ? `<em>aria-level: ${item.level}</em>` : ''}${item.suggestions.length ? `<em class="suggestions">${item.suggestions.length} suggestion${item.suggestions.length === 1 ? '' : 's'}</em>` : ''}</small></span></button>${guidance(item.suggestions)}</li>`).join('') + '</ol>' : '<p class="muted">No items in this view. Change the outline or turn off Suggestions only.</p>');
  }
  const px = n => Number.isFinite(n) ? n + 'px' : 'Not measured';
  function renderMeasurements() {
    if (!measurement) { inspector.innerHTML = '<p class="muted">Pick an element in a preview, or choose an item in the outline below.</p>'; return; }
    const m = measurement, edgeText = e => e ? `${e.top} / ${e.right} / ${e.bottom} / ${e.left}px` : 'Not measured';
    const metric = (title, value) => `<div><dt>${esc(title)}</dt><dd>${esc(value)}</dd></div>`;
    inspector.innerHTML = `<p class="outline-element"><code>&lt;${esc(m.tag)}&gt;</code> ${esc(m.name || '(unnamed)')}<small>${esc(m.role)}${m.hidden ? ' · not visible' : ''}${m.atHidden ? ' · hidden from assistive technology' : ''}</small></p>
      <dl class="outline-metrics">${metric('Width × height', `${px(m.rect.width)} × ${px(m.rect.height)}`)}${metric('Page x / y', `${px(m.rect.x)} / ${px(m.rect.y)}`)}${metric('Margin · T/R/B/L', edgeText(m.margin))}${metric('Padding · T/R/B/L', edgeText(m.padding))}${metric('Border · T/R/B/L', edgeText(m.border))}${metric('Display / gap', `${m.display} / ${m.gap}`)}${metric('Font size / line height', `${px(m.typography.fontSize)} / ${m.typography.lineHeight === null ? 'normal (not resolved)' : px(m.typography.lineHeight)}`)}${metric('Weight / letter spacing', `${m.typography.fontWeight} / ${m.typography.letterSpacing}`)}${metric('Text contrast', m.colors.contrast === null ? 'Not measured' : `${m.colors.contrast}:1 · typical target ${m.colors.contrastTarget}:1`)}${metric('Estimated chars / line', m.typography.charsPerLine === null ? 'Not measured' : String(m.typography.charsPerLine))}</dl>
      <details class="outline-css"><summary>Computed styles & viewport distances</summary><p>${esc(m.typography.fontFamily)}</p><p>Text: ${esc(m.colors.text)}<br>Background: ${esc(m.colors.background)}<br>Box sizing: ${esc(m.boxSizing)}</p><p>Viewport edges · left ${px(m.viewport.left)} · top ${px(m.viewport.top)} · right ${px(m.viewport.right)} · bottom ${px(m.viewport.bottom)}. Negative means outside the viewport.</p></details>
      ${m.colors.contrast === null ? '<p class="outline-limit">Contrast is unavailable for hidden content, text without its own text node, opacity, and backgrounds involving images or gradients. Verify the rendered result.</p>' : ''}
      ${guidance(m.suggestions)}${m.suggestions.length ? '' : '<p class="outline-limit">No suggestions from the implemented checks for this element. This is not a complete accessibility assessment.</p>'}`;
  }
  async function refresh() {
    screens();
    const d = device, sequence = ++readId, loads = d?.loads;
    measureId++;
    data = measurement = null; renderList(); renderMeasurements(); updateControls();
    if (!d?.ready) { status.textContent = 'Open a site and wait for this preview to load.'; return; }
    if (mode === 'focus' && (d.site ? d.site.focusDev : focusDev) !== d) {
      if (d.site) d.site.focusDev = d; else focusDev = d;
      relayout(); await new Promise(resolve => setTimeout(resolve, 60));
      if (sequence !== readId || device !== d) return;
    }
    state(d).pick = false; state(d).selected = null; sendState(d); updateControls();
    status.textContent = 'Reading headings, landmarks and focus order…';
    const answer = await ask(d, 'outline-read', {}, 5000);
    if (sequence !== readId || device !== d) return;
    if (!d.el || loads !== d.loads) { status.textContent = 'The preview changed while reading. Refresh to inspect it again.'; return; }
    data = answer?.data || null;
    status.textContent = data ? `${reportName(d)} · ${data.viewport.width} × ${data.viewport.height} CSS px · ${data.headings.length} headings · ${data.landmarks.length} landmarks · ${data.focus.length} focus stops${data.truncated ? ' · list limit reached' : ''}` : 'This preview did not answer. Refresh once it has loaded.';
    renderList(); updateControls(); sendState();
  }
  async function measure(key) {
    if (!device?.ready) return;
    const d = device, sequence = ++measureId, loads = d.loads;
    status.textContent = 'Measuring the selected element…';
    const answer = await ask(d, 'outline-measure', { key, highlight: true, reveal: true }, 4000);
    if (sequence !== measureId || device !== d || loads !== d.loads) return;
    measurement = answer?.data || null;
    if (measurement) { state(d).selected = measurement.key; status.textContent = `Measured ${measurement.tag} in ${reportName(d)}. Values are CSS pixels.`; }
    else status.textContent = 'The element is no longer available. Refresh the outline and select it again.';
    renderMeasurements(); updateControls();
    list.querySelectorAll('[data-outline-key]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.outlineKey === measurement?.key)));
  }
  function stopPicking() {
    for (const d of workspaceScreens()) if (d.outlineState?.pick) { d.outlineState.pick = false; sendState(d); }
    updateControls();
  }
  async function open({ fromTour = false } = {}) { if (tourRunning && !fromTour) await endTour(false); screens(); return refresh(); }
  $('#open-outline').addEventListener('click', () => showTab('outline'));
  select.addEventListener('focus', screens);
  select.addEventListener('change', () => { stopPicking(); device = devices[Number(select.value)] || null; data = measurement = null; updateControls(); refresh(); });
  $('#outline-refresh').addEventListener('click', refresh);
  $('#outline-mode').addEventListener('change', renderList);
  $('#outline-issues-only').addEventListener('change', renderList);
  for (const key of ['headings', 'landmarks', 'focus']) $('#outline-' + key + '-overlay').addEventListener('change', event => { if (device) { state(device)[key] = event.target.checked; sendState(); } });
  $('#outline-clear').addEventListener('click', () => { for (const d of workspaceScreens()) if (d.outlineState) { d.outlineState = { headings: false, landmarks: false, focus: false, pick: false, selected: null }; sendState(d); } updateControls(); });
  $('#outline-pick').addEventListener('click', () => {
    if (!device?.ready) return;
    state(device).pick = !state(device).pick; sendState(); updateControls();
    status.textContent = state(device).pick ? 'Click an element in the selected preview. The pick does not activate its control. Press Escape in the preview, or Cancel pick, to stop.' : 'Element picking cancelled.';
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && workspaceScreens().some(d => d.outlineState?.pick)) { event.preventDefault(); stopPicking(); status.textContent = 'Element picking cancelled.'; }
  }, true);
  list.addEventListener('click', event => { const button = event.target.closest('[data-outline-key]'); if (button) measure(button.dataset.outlineKey); });
  $('#outline-export').addEventListener('click', () => {
    if (!data && !measurement) return;
    const report = { format: 'samestate-outline', version: 1, at: new Date().toISOString(), screen: device ? reportName(device) : null, outline: data, measurement, limitations: 'DOM-derived outline and computed CSS measurements. Verify keyboard order, screen-reader interpretation, visual filters and WCAG exceptions manually.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'samestate-outline-' + Date.now() + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
  });
  new MutationObserver(() => { if (!isOpen()) stopPicking(); }).observe($('#panel'), { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  window.samestateOutline = {
    open,
    get: () => JSON.parse(JSON.stringify({ screen: device?.id || null, data, measurement })),
    loaded(d) {
      if (d.outlineState) { d.outlineState.selected = null; d.outlineState.pick = false; }
      if (d === device) { readId++; measureId++; data = measurement = null; renderMeasurements(); if (isOpen()) setTimeout(refresh, 100); }
    },
    picked(d, result) {
      if (d !== device || !state(d).pick) return;
      measureId++; state(d).pick = false;
      measurement = result || null;
      if (result) state(d).selected = result.key;
      status.textContent = result ? `Measured ${result.tag} in ${reportName(d)}. The control was not activated.` : 'Element picking cancelled.';
      renderMeasurements(); updateControls();
    }
  };
})();
