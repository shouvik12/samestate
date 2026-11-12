# Wall scrollbar

- Added a draggable horizontal scrollbar at the bottom of the preview wall whenever previews extend beyond the available width.
- The bar remains available with the sidebar closed and follows horizontal trackpad scrolling. It also supports the arrow keys, Home, and End when focused.

---

## Summary

Reach previews on both sides of a wall that is wider than the window.

## 1. Horizontal scrollbar

**Files** `extension/app.js`, `docs/app.js`, `extension/app.html`, `docs/index.html`, `extension/app.css`, `docs/app.css`

**What changed** The extension and hosted demo use a range input to control the wall’s horizontal scroll position. The thumb reflects how much of the wall is visible. The bar sits below the canvas, outside the screenshot and recording crop.

**Impact** You can drag the bar across the wall even with the sidebar closed.

---

## Testing

- Verified in Chrome that mouse drags reach both ends with the sidebar closed, keyboard and trackpad scrolling move the wall, and the scrollbar updates after zoom, focus, and sidebar changes. The previews stayed loaded throughout the test.

---

## Files changed

| Files | Lines in the combined commit | Purpose |
|---|---:|---|
| `extension/app.js`, `docs/app.js` | +499 −139 each | Scroll position and resize handling |
| `extension/app.html`, `docs/index.html` | +147 −46 each | Scrollbar control |
| `extension/app.css`, `docs/app.css` | +85 −17 each | Track and thumb styling |
| `README.md` | +66 −20 | Release notes and usage |
| `changelogs/CHANGELOG-wall-scrollbar.md` | +36 | Change and testing notes |
