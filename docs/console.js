/* Forwards a Samestate preview's console messages and uncaught errors to agent.js, which runs in an isolated world
   and cannot see them. Runs in the page's own world, registered with emulate.js for the sites open in Samestate tabs,
   and does nothing outside a Samestate preview frame. Messages stay in the browser: agent.js shows them in
   Samestate's Console panel. */
(() => {
  'use strict';
  if (window.__samestateConsole || window.top === window || window.parent !== window.top) return;
  if (!(location.ancestorOrigins?.[0] || '').startsWith('chrome-extension://')) return;
  window.__samestateConsole = true;
  const emit = (level, args, kind) => {
    let text;
    try { text = args.map(a => typeof a === 'string' ? a : a instanceof Error ? (a.stack || a.message) : JSON.stringify(a)).join(' '); } catch { text = String(args[0]); }
    try { document.dispatchEvent(new CustomEvent('samestate-console', { detail: JSON.stringify({ level, kind, text: String(text).slice(0, 500) }) })); } catch {}
  };
  for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
    const original = console[level];
    console[level] = function (...args) { emit(level, args); return original.apply(this, args); };
  }
  addEventListener('error', e => { if (e.target === window) emit('error', [e.message + (e.filename ? ` (${e.filename.split(/[?#]/)[0].split('/').pop()}:${e.lineno})` : '')], 'error'); });
  addEventListener('unhandledrejection', e => emit('error', ['Unhandled rejection: ' + (e.reason?.message || e.reason)], 'error'));
})();
