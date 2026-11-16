/* The promo video's stage. promo/record.mjs opens the real web build (docs/index.html) as the top-level page, as a
   user would, and runs this script in it: the app becomes a window on a dark stage, with titles, captions, a cursor
   and camera moves added around it, and the app's own functions drive what happens.
   Cuts sit on the music's bar lines: 128 BPM, one bar = 1.875 s, 16 bars = 30 s. */
(() => {
  'use strict';
  const FORMAT = window.PROMO_FORMAT === 'portrait' ? 'portrait' : 'landscape';
  const L = FORMAT === 'landscape'
    ? { W: 1920, H: 1080, app: [1600, 760], win: { x: 110, y: 186, w: 1700, h: 808 }, caption: { top: 60, size: 66 }, title: 150, end: 120, cursor: 44, mode: 'row' }
    : { W: 1080, H: 1920, app: [1000, 1400], win: { x: 40, y: 470, w: 1000, h: 1400 }, caption: { top: 170, size: 84 }, title: 150, end: 110, cursor: 60, mode: 'grid' };
  const [AW, AH] = L.app, WIN = L.win, BAR = 60 / 128 * 4, R = 22;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const screen = id => DEVICES.find(d => d.id === id);

  // ---------------------------------------------------------------- stage
  const style = document.createElement('style');
  style.textContent = `
    html{width:${L.W}px;height:${L.H}px;overflow:hidden;background:radial-gradient(60% 45% at 50% 38%,#18284a 0%,#0b1020 55%,#07090f 100%) #07090f}
    body{position:absolute;left:0;top:0;width:${AW}px;height:${AH}px;margin:0;transform-origin:0 0;z-index:1;will-change:transform,clip-path}
    #canvas:not([hidden]){display:flex;flex-direction:column;justify-content:center}
    #frames{margin:0 auto}
    .promo{font-family:-apple-system,"SF Pro Display","Helvetica Neue",system-ui,sans-serif;color:#f5f7fb;-webkit-font-smoothing:antialiased;position:absolute;pointer-events:none}
    .promo-shadow{left:${WIN.x}px;top:${WIN.y}px;width:${WIN.w}px;height:${WIN.h}px;border-radius:${R}px;box-shadow:0 40px 120px #000d,0 0 0 1px #ffffff1f;z-index:0}
    .promo-glow{inset:0;width:${L.W}px;height:${L.H}px;background:radial-gradient(30% 25% at 72% 72%,#a78bfa1f,transparent 70%),radial-gradient(28% 22% at 24% 64%,#6ea8ff1f,transparent 70%);z-index:0}
    .promo-grad{background:linear-gradient(90deg,#6ea8ff,#a78bfa 50%,#f472b6);-webkit-background-clip:text;background-clip:text;color:transparent}
    .promo-caption{left:0;width:${L.W}px;top:${L.caption.top}px;padding:0 60px;box-sizing:border-box;text-align:center;font-size:${L.caption.size}px;font-weight:700;letter-spacing:-.025em;line-height:1.08;z-index:3}
    .promo-caption>span{display:inline-block;opacity:0;transform:translateY(24px);filter:blur(6px);transition:opacity .55s,transform .7s cubic-bezier(.2,.8,.2,1),filter .55s}
    .promo-caption>span.in{opacity:1;transform:none;filter:none}
    .promo-caption>span.out{opacity:0;transform:translateY(-18px);filter:blur(6px);transition-duration:.35s}
    .promo-card{left:0;top:0;width:${L.W}px;height:${L.H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;z-index:3}
    .promo-card h1{margin:0;font-weight:800;letter-spacing:-.04em;line-height:1;font-size:${L.title}px}
    .promo-line{display:block;opacity:0;transform:translateY(40px) scale(.98);filter:blur(10px);transition:opacity .6s,transform .8s cubic-bezier(.2,.8,.2,1),filter .6s}
    .promo-line.in{opacity:1;transform:none;filter:none}
    .promo-line.out{opacity:0;transform:scale(1.04);filter:blur(10px);transition-duration:.45s}
    .promo-brand{display:flex;align-items:center;justify-content:center;gap:.45em;font-weight:700;letter-spacing:-.02em}
    .promo-logo{display:inline-flex;gap:.12em;align-items:flex-end}
    .promo-logo i{display:block;border-radius:.12em;background:linear-gradient(180deg,#6ea8ff,#a78bfa)}
    .promo-logo i:nth-child(1){width:.32em;height:.62em}.promo-logo i:nth-child(2){width:.5em;height:.82em}.promo-logo i:nth-child(3){width:.24em;height:.48em}
    .promo-pill{display:inline-block;padding:.45em 1em;border-radius:999px;background:#ffffff14;border:1px solid #ffffff26;font-weight:600}
    .promo-cursor{left:0;top:0;width:0;height:0;z-index:4;opacity:0;transition:transform .75s cubic-bezier(.65,0,.35,1),opacity .3s}
    .promo-cursor svg{position:absolute;left:-6px;top:-4px;filter:drop-shadow(0 4px 8px #000a);transition:transform .12s}
    .promo-cursor .ring{position:absolute;border-radius:50%;border:3px solid #fff;opacity:0;width:${L.cursor * 1.4}px;height:${L.cursor * 1.4}px;left:${-L.cursor * 0.7}px;top:${-L.cursor * 0.7}px}
    .promo-cursor.click .ring{animation:promo-ripple .6s ease-out}
    .promo-cursor.click svg{transform:scale(.86)}
    @keyframes promo-ripple{from{opacity:.95;transform:scale(.2)}to{opacity:0;transform:scale(1.4)}}`;
  document.head.append(style);
  const add = (cls, html = '') => { const el = document.createElement('div'); el.className = 'promo ' + cls; el.innerHTML = html; document.documentElement.append(el); return el; };
  const glow = add('promo-glow');
  const shadow = add('promo-shadow');
  const captionBox = add('promo-caption');
  const titleCard = add('promo-card', '<h1></h1>');
  const endCard = add('promo-card');
  const cursor = add('promo-cursor', `<svg width="${L.cursor}" height="${L.cursor}" viewBox="0 0 24 24"><path d="M4 2l15 11.6h-7.4L8.4 21z" fill="#fff" stroke="#0b1020" stroke-width="1.4" stroke-linejoin="round"/></svg><span class="ring"></span>`);
  void glow;

  // ---------------------------------------------------------------- camera
  // The app page is the window's content. The camera scales and moves it, and clips it to the window's rounded
  // rectangle, so zooming in never spills outside the window. Each frame sets both, so they always agree.
  const baseScale = WIN.w / AW;
  let view = { s: baseScale, x: 0, y: 0 }, intro = 1, tween = 0;
  let placed = { s: baseScale, tx: WIN.x, ty: WIN.y }; // the body's transform right now
  function frame(v, amount = intro) {
    const grow = 1 - 0.1 * amount, lift = 70 * amount;
    const s = v.s * grow, cx = WIN.x + WIN.w / 2, cy = WIN.y + WIN.h / 2;
    const tx = cx + (WIN.x + v.x - cx) * grow, ty = cy + (WIN.y + v.y - cy) * grow + lift;
    placed = { s, tx, ty };
    document.body.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
    // The window rectangle, in the app's own coordinates.
    const wx = (cx + (WIN.x - cx) * grow - tx) / s, wy = (cy + (WIN.y - cy) * grow + lift - ty) / s;
    const ww = WIN.w * grow / s, wh = WIN.h * grow / s;
    document.body.style.clipPath = `inset(${wy}px ${AW - wx - ww}px ${AH - wy - wh}px ${wx}px round ${R / s}px)`;
    shadow.style.transform = `translate(0,${lift}px) scale(${grow})`;
  }
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function animate(seconds, step) {
    const id = ++tween, start = performance.now();
    return new Promise(done => {
      const tick = now => {
        if (id !== tween) return done();
        const t = Math.min(1, (now - start) / (seconds * 1000 || 1));
        step(ease(t));
        if (t < 1) requestAnimationFrame(tick); else done();
      };
      requestAnimationFrame(tick);
    });
  }
  // Fits an app rectangle into the window; null shows the whole app.
  function camera(rect, seconds = 1, pad = 40) {
    let s = baseScale, x = 0, y = 0;
    if (rect) {
      s = Math.max(baseScale, Math.min(WIN.w / (rect.width + pad * 2), WIN.h / (rect.height + pad * 2), baseScale * 2.6));
      x = Math.min(0, Math.max(WIN.w - AW * s, WIN.w / 2 - (rect.left + rect.width / 2) * s));
      y = Math.min(0, Math.max(WIN.h - AH * s, WIN.h / 2 - (rect.top + rect.height / 2) * s));
    }
    const from = { ...view }, to = { s, x, y };
    return animate(seconds, k => { view = { s: from.s + (to.s - from.s) * k, x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }; frame(view); });
  }
  function reveal(show, seconds) {
    const from = intro, to = show ? 0 : 1;
    document.body.style.transition = `opacity ${seconds}s`;
    document.body.style.opacity = show ? 1 : 0;
    shadow.style.transition = `opacity ${seconds}s`;
    shadow.style.opacity = show ? 1 : 0;
    return animate(seconds, k => { intro = from + (to - from) * k; frame(view); });
  }
  // Positions the browser reports include the body's transform (stage pixels); the camera works in the app's own
  // coordinates, so they are converted back.
  const rectOf = el => {
    const r = el.getBoundingClientRect(), { s, tx, ty } = placed;
    const left = (r.left - tx) / s, top = (r.top - ty) / s, width = r.width / s, height = r.height / s;
    return { left, top, width, height, right: left + width, bottom: top + height };
  };
  const union = rects => {
    const left = Math.min(...rects.map(r => r.left)), top = Math.min(...rects.map(r => r.top));
    return { left, top, width: Math.max(...rects.map(r => r.right)) - left, height: Math.max(...rects.map(r => r.bottom)) - top };
  };
  const screenRect = id => rectOf(screen(id).el);

  // Where something shows on the stage: an element in a preview, or in the app. The browser's positions already
  // include the camera, so they are stage pixels.
  function stagePoint(target) {
    if (Array.isArray(target)) {
      const d = screen(target[0]);
      const f = d.iframe.getBoundingClientRect(), k = f.width / d.iframe.offsetWidth;
      const r = d.iframe.contentDocument.querySelector(target[1]).getBoundingClientRect();
      return { x: f.left + (r.left + r.width / 2) * k, y: f.top + (r.top + r.height / 2) * k };
    }
    const r = (typeof target === 'string' ? document.querySelector(target) : target).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function point(target, seconds = 0.75) {
    const p = stagePoint(target);
    cursor.style.transitionDuration = `${seconds}s, .3s`;
    cursor.style.opacity = 1;
    cursor.style.transform = `translate(${p.x}px,${p.y}px)`;
  }
  function click() {
    cursor.classList.remove('click'); void cursor.offsetWidth; cursor.classList.add('click');
    setTimeout(() => cursor.classList.remove('click'), 650);
  }
  const hideCursor = () => { cursor.style.opacity = 0; };

  // ---------------------------------------------------------------- text
  let captionTimer;
  function caption(html) {
    for (const old of captionBox.children) { old.classList.remove('in'); old.classList.add('out'); }
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => {
      captionBox.replaceChildren();
      if (!html) return;
      const span = document.createElement('span');
      span.innerHTML = html;
      captionBox.append(span);
      requestAnimationFrame(() => requestAnimationFrame(() => span.classList.add('in')));
    }, 300);
  }
  function line(parent, html) {
    const el = document.createElement('div');
    el.className = 'promo-line';
    el.innerHTML = html;
    parent.append(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    return el;
  }
  const brand = size => `<div class="promo-brand" style="font-size:${size}px"><span class="promo-logo"><i></i><i></i><i></i></span>Samestate</div>`;

  // ---------------------------------------------------------------- preparing the app
  async function until(test, ms = 15000) {
    for (let t = 0; t < ms && !test(); t += 100) await wait(100);
  }
  async function prepare() {
    document.body.style.opacity = 0;
    shadow.style.opacity = 0;
    frame(view, 1);
    await until(() => tourRunning);
    endTour(false);
    await until(() => target && active().length && active().every(d => d.ready));
    // Four screens read best at video size: two phones, a tablet and a desktop.
    for (const id of ['nexus7', 'macbook', 'android']) selectDevice(screen(id), false);
    refreshDevicePicker();
    $('#toggle-sidebar').click();
    $('#panel').hidden = true;
    setMode(L.mode);
    $('#align [data-v=center]').click();
    // The largest zoom at which every screen fits on the wall.
    for (let z = 100; z >= 30; z -= 2) {
      setZoom(z);
      await wait(20);
      if (cv.scrollWidth <= cv.clientWidth + 1 && cv.scrollHeight <= cv.clientHeight + 1) break;
    }
    // Comparison columns load now, so they appear at once later.
    setSitesMode(true);
    openSite(sitePanels[1], new URL('pricing.html', DEMO_URL), true);
    await until(() => sitePanels.every(s => s.devices.filter(d => d.on).every(d => d.ready)));
    setSitesMode(false);
    await until(() => active().every(d => d.ready));
    for (const d of [...active(), ...sitePanels.flatMap(s => s.devices)]) { try { d.iframe.contentDocument.querySelector('#cookies')?.remove(); } catch {} }
    tourRunning = true; // shows the per-screen result labels ("✓ opened its menu first") without the guided demo's overlays
    await wait(600);
    return { zoom, screens: active().map(d => d.id), ready: active().every(d => d.ready), fits: cv.scrollWidth <= cv.clientWidth + 1 };
  }

  // ---------------------------------------------------------------- the show
  const at = bars => bars * BAR * 1000;
  async function show() {
    const t0 = performance.now();
    const until = async ms => { const left = ms - (performance.now() - t0); if (left > 0) await wait(left); };
    const h1 = titleCard.querySelector('h1');

    // Bars 1-2: title on black.
    await until(250);
    const a = line(h1, 'Every screen.');
    await until(1500);
    const b = line(h1, '<span class="promo-grad">One click.</span>');
    await until(2700);
    const c = line(titleCard, `<div style="margin-top:${L.title * 0.35}px">${brand(L.title * 0.3)}</div>`);
    await until(at(2) - 300);
    for (const el of [a, b, c]) { el.classList.remove('in'); el.classList.add('out'); }

    // Bars 3-4: the drop. The real app, every screen at once.
    await until(at(2));
    reveal(true, 1.1);
    await until(at(2) + 500);
    caption('Your site on <span class="promo-grad">every screen</span>. At once.');

    // Bars 5-6: click sync.
    await until(at(4));
    caption('Click once. <span class="promo-grad">Every screen follows.</span>');
    point(['desktop', '.dd-btn']);
    await until(at(4) + 900);
    click();
    play('desktop', { do: 'click', sel: '.dd-btn' });
    await until(at(5) + 200);
    camera(FORMAT === 'landscape' ? union([screenRect('desktop'), screenRect('pixel')]) : union([screenRect('iphone'), screenRect('pixel')]), 0.9, 24);
    hideCursor();

    // Bars 7-8: a control drawn twice, dark mode from a phone.
    await until(at(6));
    camera(null, 0.8);
    // Closes the menus the click opened, on every screen, between scenes.
    for (const d of active()) {
      const w = d.iframe.contentWindow;
      try { w.setDrawer?.(false); w.document.querySelectorAll('.dd-menu,.acc-panel').forEach(m => { m.hidden = true; m.previousElementSibling?.setAttribute('aria-expanded', 'false'); }); } catch {}
    }
    caption('Even when <span class="promo-grad">the layout changes</span>.');
    await until(at(6) + 900);
    point(['iphone', '.mob-only .mode-toggle']);
    await until(at(6) + 1700);
    click();
    play('iphone', { do: 'click', sel: '.mob-only .mode-toggle' });
    await until(at(7) + 200);
    hideCursor();
    camera(union([screenRect('iphone'), screenRect('desktop')]), 0.9, 24);
    // Measure now, quietly, so the report is ready when its scene starts.
    play('desktop', { do: 'scroll', sel: '#plans' });
    await until(at(7) + 900);
    detect(true);

    // Bars 9-10: the difference report.
    await until(at(8));
    caption('See what breaks. <span class="promo-grad">Instantly.</span>');
    camera(null, 0.7);
    showTab('diff');
    await until(at(8) + 900);
    const finding = [...document.querySelectorAll('#findings .finding')].find(el => el.querySelector('.t')?.textContent.startsWith('Table is wider'));
    if (finding) {
      point(finding, 0.6);
      await until(at(8) + 1700);
      click();
      finding.click();
      await until(at(9) + 100);
      camera(screenRect('iphone'), 0.9, 16); // the clicked issue is outlined on the phone
    }
    hideCursor();

    // Bars 11-12: compare sites.
    await until(at(10));
    camera(null, 0.7);
    $('#panel').hidden = true;
    play('iphone', { do: 'click', sel: '.mob-only .mode-toggle' }); // back to light
    setSitesMode(true);
    caption('Compare pages <span class="promo-grad">side by side</span>.');
    await until(at(11));
    for (const site of sitePanels) site.preview.scrollTo({ top: 120, behavior: 'smooth' });

    // Bars 13-14: quick montage.
    await until(at(12));
    for (const site of sitePanels) site.preview.scrollTo({ top: 0 });
    setSitesMode(false);
    const theme = buildPreviewTheme(TOUR_THEME, 'light', true);
    for (const d of active()) { d.themeCss = theme; configure(d); }
    caption('<span class="promo-grad">Themes.</span>');
    await until(at(12) + 940);
    for (const d of active()) { d.themeCss = ''; configure(d); }
    play('desktop', { do: 'scroll', sel: '#tour-video' });
    setTimeout(() => requestPlayback(true), 350);
    caption('<span class="promo-grad">Video.</span>');
    await until(at(13));
    caption('<span class="promo-grad">Notes.</span>');
    camera(screenRect('iphone'), 0.6, 20);
    const notes = screen('iphone').annotations;
    notes.draw('arrow', [{ x: 0.2, y: 0.22 }, { x: 0.55, y: 0.44 }]);
    notes.note({ x: 0.08, y: 0.1 }, 'Looks great here');
    await until(at(13) + 940);
    camera(null, 0.6);
    caption('<span class="promo-grad">Reports.</span>');
    showTab('diff');
    $('#report-export').open = true;

    // Bars 15-16: end card.
    await until(at(14));
    caption('');
    reveal(false, 0.8);
    await until(at(14) + 350);
    line(endCard, brand(L.end));
    await until(at(14) + 900);
    line(endCard, `<div style="font-size:${L.end * 0.42}px;font-weight:700;letter-spacing:-.02em;margin-top:${L.end * 0.25}px">One interaction. <span class="promo-grad">Every device.</span></div>`);
    await until(at(15) + 100);
    line(endCard, `<div style="margin-top:${L.end * 0.4}px;font-size:${L.end * 0.24}px"><span class="promo-pill">Free Chrome extension</span></div>`);
    await until(at(15) + 600);
    line(endCard, `<div style="margin-top:${L.end * 0.22}px;font-size:${L.end * 0.2}px;color:#9aa6c2;font-weight:500">github.com/shouvik12/samestate</div>`);
    await until(at(16));
    return performance.now() - t0;
  }

  window.promo = { prepare, show, format: FORMAT };
})();
