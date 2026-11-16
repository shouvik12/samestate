# Interface Themes — Five Themes with Day and Night Mode

- A theme menu and a sun/moon button in the top bar, next to Reload, in the extension and the web demo
- **Samestate** is the original dark blue theme, unchanged, and stays the default; it gains a day mode
- **Neutral**, **Clay**, **Teal** and **Hive** are converted from four tweakcn themes (Minimal Neutral, Claude, Whatsapp and qrafthive), each with their own day and night colors
- The choice is remembered (`samestate.uiTheme` and `samestate.uiMode` in localStorage) and applied before the page is drawn
- Green, amber and red stay the same in every theme, so issue, warning and OK states read the same; device frames (status bars, browser bars, screens) keep their own colors
- `manifest.json`: `minimum_chrome_version` 110 → 111, for CSS `color-mix()`
- README: a paragraph under **Choose devices and options**, release notes row

---

## Summary
Samestate's own interface can now be any of five themes, in day or night mode. Previews are not affected; **Preview a color theme** still tries colors on the site itself.

---

## 1. Theme Colors
**Files:** `extension/app.css`, `docs/app.css`
**What:** Each theme and mode is one rule on `:root[data-ui-theme][data-ui-mode]` that sets the existing color variables (`--bg`, `--side`, `--bar`, `--raise`, `--line`, `--text`, `--mute`, `--acc`) plus two new ones: `--on-acc` (text on the accent color) and `--shadow`. The tweakcn colors were converted from OKLCH to hex: `background` → the device wall, `sidebar` → panels, `card` → the top bar, `border`, `foreground`, `muted-foreground`, `primary` and `primary-foreground`; button backgrounds are mixed from the panel and text colors. Where a theme's wall and panels were almost the same color (Hive night), the wall is lightened slightly. 30 hard-coded colors (text on accent buttons, shadows, tags, hover states, the guided demo's panels and glow) now come from the variables, mostly through `color-mix()`. `color-scheme` follows the mode, so native controls and scrollbars match.
**Impact:** All panels, menus, dialogs, tags and the guided demo follow the theme.

## 2. Controls
**Files:** `extension/ui-theme.js` (new), `extension/app.html`, `extension/app.js`, and their `docs/` copies
**What:** `ui-theme.js` runs in `<head>`, reads the saved choice and sets `data-ui-theme` and `data-ui-mode` on `<html>`; it exposes `samestateUiTheme` (`THEMES`, `save`, `theme`, `mode`). `app.js` fills the `#ui-theme` menu and switches modes from `#ui-mode`, whose title says which mode it switches to.
**Impact:** One click for day or night; the theme menu lists all five.

---

## Testing
- Web demo (`docs/`, served locally): every theme in day and night mode, with the report open; the menu and button update each other, the icon matches the mode, and the choice survives a reload
- `node tests/smoke.mjs`: 36/36 checks passed, 0 page errors; the new check **Interface themes** switches to day, then Clay, then back, and compares the wall color
- Fonts and corner radii from the tweakcn themes are not used: the fonts would load from Google, which the privacy policy rules out, and the layout is sized for the system font
- Not checked inside the installed extension; the extension loads the same files

---

## Files Changed

| File | Type |
|------|------|
| `extension/ui-theme.js`, `docs/ui-theme.js` | New: saved theme and mode |
| `extension/app.css`, `docs/app.css` | Theme rules, colors from variables, control styles |
| `extension/app.html`, `docs/index.html` | Menu and button, script in `<head>` |
| `extension/app.js`, `docs/app.js` | Wiring |
| `extension/manifest.json` | Chrome 111 |
| `tests/smoke.mjs` | Interface themes check |
| `README.md` | Docs, release notes |
| `changelogs/CHANGELOG-interface-themes.md` | This file |
