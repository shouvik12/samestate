const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const drawer = document.getElementById('drawer'), backdrop = document.getElementById('backdrop'), burger = document.querySelector('.hamburger');
function setDrawer(open) { drawer.classList.toggle('open', open); backdrop.hidden = !open; burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); }
burger.addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));
backdrop.addEventListener('click', () => setDrawer(false));
$$('.drawer a').forEach(a => a.addEventListener('click', () => setDrawer(false)));
$$('.dd-btn,.acc').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const p = b.nextElementSibling, open = p.hidden; p.hidden = !open; b.setAttribute('aria-expanded', open); }));
document.addEventListener('click', () => $$('.dd-menu').forEach(m => { m.hidden = true; m.previousElementSibling.setAttribute('aria-expanded', false); }));
const st = document.querySelector('.search-toggle'), ms = document.getElementById('m-search');
if (st) st.addEventListener('click', () => { ms.hidden = !ms.hidden; st.setAttribute('aria-expanded', !ms.hidden); if (!ms.hidden) ms.querySelector('input').focus(); });
const dlg = document.getElementById('signin');
$$('.signin').forEach(b => b.addEventListener('click', () => { setDrawer(false); dlg.showModal(); }));
$$('[role=tab]').forEach(t => t.addEventListener('click', () => { $$('[role=tab]').forEach(x => x.setAttribute('aria-selected', x === t)); $$('.price').forEach(p => p.textContent = t.dataset.bill === 'yearly' ? p.dataset.y : p.dataset.m); }));
$$('form[role=search]').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); const r = document.getElementById('search-result'); if (r) { r.hidden = false; r.textContent = 'Results for “' + f.q.value + '”: 3 articles'; } }));
const ck = document.querySelector('#cookies button'); if (ck) ck.addEventListener('click', () => ck.parentElement.remove());
document.addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });
