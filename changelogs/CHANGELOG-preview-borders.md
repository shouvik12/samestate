# Preview borders

- Added a visible border around each screen and its title bar in the device wall and **Page steps**.
- The active preview and a preview being dragged show their highlight around the entire box.

---

## Summary

Give each preview a single visual boundary around the screen and its controls.

## 1. Preview box and title bar

**Files** `extension/app.css`, `docs/app.css`

**What changed** The extension and hosted demo apply the border to the existing preview container. The title bar has a distinct background and a divider above the device. Its buttons have hover and keyboard focus indicators.

**Impact** The Close, Reload, Rotate, and Focus buttons are easier to associate with their preview.

---

## Testing

- Verified in Chrome that the preview and all visible title-bar buttons sit inside the same box, and that closing one step leaves its neighbors open. Dragging and scrolling still work with the new borders.

---

## Files changed

| Files | Lines in the combined commit | Purpose |
|---|---:|---|
| `extension/app.css`, `docs/app.css` | +85 −17 each | Box, button, active preview, and drag styling |
| `README.md` | +66 −20 | Release notes and usage |
| `changelogs/CHANGELOG-preview-borders.md` | +34 | Change and testing notes |
