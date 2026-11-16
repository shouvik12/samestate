// Interface theme and day/night mode. Loaded in <head> so the saved choice applies before the page is drawn;
// app.js wires the controls in the top bar. Colors live in app.css under data-ui-theme and data-ui-mode.
(() => {
  'use strict';
  const THEMES = { samestate: 'Samestate', neutral: 'Neutral', clay: 'Clay', teal: 'Teal', hive: 'Hive' };
  const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
  const root = document.documentElement;
  function apply(theme, mode) {
    root.dataset.uiTheme = Object.hasOwn(THEMES, theme) ? theme : 'samestate';
    root.dataset.uiMode = mode === 'light' ? 'light' : 'dark';
  }
  function save(theme, mode) {
    apply(theme, mode);
    try { localStorage.setItem('samestate.uiTheme', root.dataset.uiTheme); localStorage.setItem('samestate.uiMode', root.dataset.uiMode); } catch {}
  }
  const restore = () => apply(read('samestate.uiTheme', 'samestate'), read('samestate.uiMode', 'dark'));
  restore();
  // preview() shows a theme without saving it (the guided demo uses it); restore() returns to the saved choice.
  window.samestateUiTheme = { THEMES, save, preview: apply, restore, get theme() { return root.dataset.uiTheme; }, get mode() { return root.dataset.uiMode; } };
})();
