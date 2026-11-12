# Per-preview scale

- Made the scale percentage in each preview’s title bar clickable.
- Added custom percentages from 1% to 200%, a **100% (CSS px)** shortcut, and **Auto** to restore wall zoom or Focus fit.
- Kept oversized previews reachable with the bottom scrollbar in Focus mode.

---

## Summary

Set the display size of an individual device or page step while preserving its CSS viewport and loaded page.

## 1. Preview scale control

**Files** `extension/app.js`, `extension/app.html`, `extension/app.css`, `docs/app.js`, `docs/index.html`, `docs/app.css`

**What changed** The title-bar button opens a dialog for the selected preview. A manual scale overrides the wall zoom and Focus fit for that preview. **Auto** restores the calculated scale.

**Impact** You can display one page at its viewport dimensions in CSS pixels without changing neighboring previews or the site’s layout. Physical size varies by display.

---

## Testing

- Verified custom scale, the 100% shortcut, Auto, Cancel, and input bounds in Chrome.
- Verified horizontal scrolling at 100% in Focus mode and independent scaling in the hosted demo’s Page steps.
- Confirmed that changing scale keeps the existing iframes and their viewport dimensions. At 100%, the iPhone page measured 375 × 812 CSS pixels at device pixel ratios of 1 and 2.

---

## Files changed

| Files | Lines changed | Purpose |
|---|---:|---|
| `extension/app.js`, `docs/app.js` | +35 −7 each | Scale override and dialog handling |
| `extension/app.html`, `docs/index.html` | +14 each | Scale dialog |
| `extension/app.css`, `docs/app.css` | +15 −2 each | Scale styling and Focus scrolling |
| `README.md` | +3 | Usage and release note |
| `changelogs/CHANGELOG-preview-scale.md` | +39 | Change and testing notes |
