/* Exports the difference report as Markdown, CSV or a self-contained HTML page, optionally with one screenshot per finding. */
(() => {
  'use strict';
  const menu = document.querySelector('#report-export');
  const status = document.querySelector('#export-status');
  const SECTIONS = [['issue', 'Issues'], ['warn', 'Warnings'], ['info', 'Adaptations']];
  const SEVERITY_NAME = { issue: 'Issue', warn: 'Warning', info: 'Adaptation' };
  let exporting = false;

  let sayTimer = 0;
  function say(text, clearAfter = 0) {
    clearTimeout(sayTimer);
    status.textContent = text;
    status.hidden = !text;
    if (clearAfter) sayTimer = setTimeout(() => say(''), clearAfter);
  }

  const sizeOf = d => { const { w, h } = size(d); return w + ' × ' + h; };
  const pageOf = d => d.site ? d.site.url.href : d.pageUrl || previewUrl;
  const showAddress = url => { const u = new URL(url); return u.origin === EXT ? 'Samestate sample site · ' + u.pathname.split('/').pop() : u.href; };

  // What every format shares: the scan, the sites, the screens and the problems grouped across screens.
  function collect() {
    const groups = issueGroups(findings);
    const sites = sitesMode ? sitePanels.filter(site => groups.some(g => g.site === site)) : [null];
    return {
      at: lastScan?.at || new Date(),
      groups,
      parts: sites.map(site => {
        const own = groups.filter(g => g.site === site);
        const screens = (lastScan?.screens || []).filter(d => (d.site || null) === site);
        const reference = own[0]?.items[0].reference;
        const pages = [...new Set(screens.map(pageOf))].map(showAddress);
        return { site, own, screens, reference, pages };
      })
    };
  }

  const detailOf = (g, f) => (f.title === g.kind ? '' : f.title + '. ') + f.detail;
  const stamp = date => date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const counts = own => SECTIONS.map(([sev, name]) => own.filter(g => g.sev === sev).length + ' ' + name.toLowerCase()).join(' · ');

  function markdown(report) {
    const lines = ['# Samestate difference report', '', `Measured ${stamp(report.at)}.`, ''];
    for (const part of report.parts) {
      if (part.site) lines.push(`## Site ${sitePanels.indexOf(part.site) + 1}`, '');
      lines.push(`- **Page${part.pages.length > 1 ? 's' : ''}:** ${part.pages.join(', ')}`);
      lines.push(`- **Compared with:** ${screenName(part.reference)} (${sizeOf(part.reference)})`);
      lines.push(`- **Screens:** ${part.screens.map(d => `${screenName(d)} (${sizeOf(d)})`).join(', ')}`);
      lines.push(`- **Found:** ${counts(part.own)}`, '');
      const level = part.site ? '###' : '##';
      for (const [sev, name] of SECTIONS) {
        const own = part.own.filter(g => g.sev === sev);
        if (!own.length) continue;
        lines.push(`${level} ${name}`, '');
        for (const g of own) {
          lines.push(`${level}# ${g.kind}`, '', `${g.cat} · on ${g.screens.length} of ${part.screens.length} screens`, '');
          for (const f of g.items) lines.push(`- **${screenName(f.dev)}:** ${detailOf(g, f)}`);
          lines.push('');
        }
      }
    }
    return lines.join('\n');
  }

  function csv(report) {
    const cell = value => /[",\n\r]/.test(value) ? '"' + String(value).replace(/"/g, '""') + '"' : String(value);
    const rows = [['Site', 'Page', 'Severity', 'Category', 'Issue', 'Screen', 'Viewport', 'Finding', 'Details', 'Compared with']];
    for (const part of report.parts) {
      for (const g of part.own) {
        for (const f of g.items) {
          rows.push([part.site ? 'Site ' + (sitePanels.indexOf(part.site) + 1) : '', showAddress(pageOf(f.dev)), SEVERITY_NAME[g.sev], g.cat, g.kind,
            screenName(f.dev), sizeOf(f.dev), f.title, f.detail, screenName(f.reference)]);
        }
      }
    }
    return '﻿' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'; // BOM so spreadsheet apps read UTF-8
  }

  function html(report, shots) {
    const total = report.groups.length;
    let body = '';
    for (const part of report.parts) {
      body += `<section class="part">${part.site ? `<h2>Site ${sitePanels.indexOf(part.site) + 1}</h2>` : ''}<dl class="facts">`
        + `<dt>Page${part.pages.length > 1 ? 's' : ''}</dt><dd>${part.pages.map(esc).join('<br>')}</dd>`
        + `<dt>Compared with</dt><dd>${esc(screenName(part.reference))} <span class="dim">${sizeOf(part.reference)}</span></dd>`
        + `<dt>Screens</dt><dd>${part.screens.map(d => `${esc(screenName(d))} <span class="dim">${sizeOf(d)}</span>`).join('<br>')}</dd>`
        + `<dt>Found</dt><dd>${counts(part.own)}</dd></dl>`;
      for (const [sev, name] of SECTIONS) {
        const own = part.own.filter(g => g.sev === sev);
        if (!own.length) continue;
        body += `<h3>${name}</h3>`;
        for (const g of own) {
          body += `<article class="problem ${sev}"><header><h4>${esc(g.kind)}</h4><span class="cat">${g.cat}</span></header>`
            + `<p class="dim">On ${g.screens.length} of ${part.screens.length} screens</p>`;
          for (const f of g.items) {
            const shot = shots.get(f);
            body += `<div class="finding"><p><b>${esc(screenName(f.dev))}</b> <span class="dim">${sizeOf(f.dev)}</span><br>${esc(detailOf(g, f))}</p>`
              + (shot ? `<img src="${shot}" alt="${esc(screenName(f.dev))} with the finding outlined" loading="lazy">` : '') + '</div>';
          }
          body += '</article>';
        }
      }
      body += '</section>';
    }
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Samestate difference report</title>
<style>
:root{--bg:#f7f8fb;--card:#fff;--text:#18213a;--dim:#5d6886;--line:#dfe3ee;--issue:#d6354b;--warn:#c98a06;--info:#3b6fd6}
@media (prefers-color-scheme:dark){:root{--bg:#141a2b;--card:#1d2540;--text:#e8edf8;--dim:#9ba8c8;--line:#2e3a5c;--issue:#ff7a8a;--warn:#ffc35a;--info:#6ea8ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:920px;margin:0 auto;padding:32px 16px 64px}h1{margin:0 0 4px;font-size:26px}h2{margin:36px 0 8px}h3{margin:28px 0 10px;font-size:18px}
h4{margin:0;font-size:16px}.dim{color:var(--dim)}.facts{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:18px 0;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:10px}
.facts dt{color:var(--dim)}.facts dd{margin:0;overflow-wrap:anywhere}.problem{margin:10px 0;padding:12px 16px;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--info);border-radius:10px}
.problem.issue{border-left-color:var(--issue)}.problem.warn{border-left-color:var(--warn)}.problem header{display:flex;gap:10px;align-items:baseline}
.cat{margin-left:auto;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--dim)}.problem>p{margin:2px 0 8px;font-size:13px}
.finding{padding:8px 0;border-top:1px solid var(--line)}.finding p{margin:0;overflow-wrap:anywhere}
.finding img{display:block;max-width:100%;max-height:640px;margin-top:8px;border:1px solid var(--line);border-radius:8px}
</style></head><body><main>
<h1>Samestate difference report</h1><p class="dim">Measured ${esc(stamp(report.at))} · ${total} ${total === 1 ? 'problem' : 'problems'}</p>
${body}
</main></body></html>`;
  }

  function download(text, type, extension) {
    const first = sitesMode ? sitePanels[0]?.url : previewUrl && new URL(previewUrl);
    const host = !first || first.origin === EXT ? 'sample-site' : first.hostname;
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    const now = new Date(), two = n => String(n).padStart(2, '0');
    const when = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}`;
    link.download = `samestate-report-${host}-${when}.${extension}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  // Shows each affected screen alone in Focus mode, outlines the finding, and crops one captured frame to that screen.
  async function screenshots(list) {
    const shots = new Map();
    const targets = list.filter(f => f.keys.length && f.dev.el && !f.dev.site);
    if (!targets.length) return shots;
    const canvas = document.querySelector('#canvas');
    const before = { mode, focusDev };
    say('Choose this Samestate tab in Chrome to take the screenshots.');
    const stream = await wallCapture.start(canvas);
    try {
      for (const [n, f] of targets.entries()) {
        say(`Taking screenshot ${n + 1} of ${targets.length}…`);
        focusDev = f.dev;
        setMode('focus');
        await sleep(350);
        post(f.dev, 'highlight', { keys: f.keys });
        await sleep(800); // the preview scrolls to the elements and draws their outlines
        const frame = await wallCapture.frame(stream);
        try {
          const area = canvas.getBoundingClientRect(), box = f.dev.body.getBoundingClientRect(), k = frame.width / area.width;
          const x = Math.max(0, (box.left - area.left) * k), y = Math.max(0, (box.top - area.top) * k);
          const w = Math.min(frame.width - x, box.width * k), h = Math.min(frame.height - y, box.height * k);
          const fit = Math.min(1, 900 / w);
          const crop = document.createElement('canvas');
          crop.width = Math.round(w * fit);
          crop.height = Math.round(h * fit);
          crop.getContext('2d').drawImage(frame, x, y, w, h, 0, 0, crop.width, crop.height);
          shots.set(f, crop.toDataURL('image/jpeg', 0.85));
        } finally { frame.close(); }
      }
    } finally {
      wallCapture.stop(stream);
      wallCapture.clearStatus();
      focusDev = before.focusDev;
      setMode(before.mode);
    }
    return shots;
  }

  async function exportReport(format) {
    if (exporting || !findings.length) return;
    exporting = true;
    menu.open = false;
    try {
      const report = collect();
      if (format === 'md') download(markdown(report), 'text/markdown;charset=utf-8', 'md');
      else if (format === 'csv') download(csv(report), 'text/csv;charset=utf-8', 'csv');
      else {
        const shots = format === 'html-shots' ? await screenshots(report.groups.flatMap(g => g.items)) : new Map();
        download(html(report, shots), 'text/html;charset=utf-8', 'html');
      }
      say('Report download started.', 4000);
    } catch (error) {
      say(wallCapture.error(error));
    } finally {
      exporting = false;
    }
  }

  menu.addEventListener('click', event => {
    const format = event.target.closest('[data-export]')?.dataset.export;
    if (format) exportReport(format);
  });
  // Screenshots need the device wall, where Focus mode can show one screen at a time.
  menu.addEventListener('toggle', () => {
    if (!menu.open) return;
    const shotButton = menu.querySelector('[data-export=html-shots]');
    shotButton.disabled = !wallCapture.available || sitesMode;
    shotButton.title = sitesMode ? 'Turn off Compare sites to include screenshots' : wallCapture.available ? 'One screenshot per finding. Chrome asks to share this tab.' : 'Screenshots need desktop Chrome';
  });
  document.addEventListener('click', event => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
})();
