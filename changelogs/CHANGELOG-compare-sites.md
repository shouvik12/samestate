# Compare sites

- Added **Compare sites** in the toolbar. Start with two full device walls showing the current site and use **+ Add site** to open more.
- Each column has its own address bar, close button, and viewport selector. Opening a URL updates every device in that column. **All devices** is the default, with single-preview options also available.
- Switching between the device wall and the site comparison keeps the existing previews mounted.

---

## Summary

Open several websites in one workspace to inspect their layouts and interactions side by side.

## 1. Independent site columns

**Files** `extension/app.js`, `extension/app.html`, `extension/app.css`, `docs/app.js`, `docs/index.html`, `docs/app.css`

**What changed** Each column reuses the device wall’s preview cards with its own URL and scroll area. The selected device set is copied from the main wall, with the default device set available when none are selected. The workspace scrolls horizontally when more columns are open than fit on screen.

**Impact** You can compare two or more sites while keeping the single-site device wall and any page steps available.

## 2. Access for multiple sites

**Files** `extension/background.js`, `extension/app.js`

**What changed** Each site follows the existing Chrome access flow. The background rule includes the exact origins of the open previews and drops origins when their last preview closes. Redirects update the affected column.

**Impact** You can navigate or replace a site independently while the other previews remain open.

---

## Testing

- Verified three distinct local origins rendering side by side in Chrome with access granted in the test extension. Also verified a redirect, declined access, and removal of a closed origin.
- Verified fixed and responsive viewport sizes, scrolling with five columns, and switching back to the same device wall and page steps.
- Verified in Chrome that the current site loads across fourteen default previews, replacing one site updates all seven devices in its column, and the hosted demo renders the bundled page in both walls.

---

## Files changed

| Files | Approx. lines changed | Purpose |
|---|---:|---|
| `extension/app.js`, `docs/app.js` | +214 −27 each | Site navigation, device walls, and mode switching |
| `extension/app.html`, `docs/index.html` | +23 −1 each | Mode controls and site columns |
| `extension/app.css`, `docs/app.css` | +26 −1 each | Split workspace layout |
| `extension/background.js` | +23 −23 | Access rules and redirects for open origins |
| `README.md` | +11 −5 | Usage and release note |
| `changelogs/CHANGELOG-compare-sites.md` | +48 | Change and testing notes |
