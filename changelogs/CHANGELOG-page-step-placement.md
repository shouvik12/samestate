# Page step placement

- Enabled title-bar dragging in **Page steps**. Moving a preview preserves its loaded page and its step number.
- The Page steps and device wall views each keep their own positions. **Lock layout** prevents dragging, and choosing **Row** or **Grid** restores automatic placement in the current view.

---

## Summary

Arrange the states in a page journey by dragging their preview boxes.

## 1. Drag and arrange steps

**Files** `extension/app.js`, `docs/app.js`

**What changed** The extension and hosted demo reuse the device wall’s CSS positioning and pointer handling for steps. New steps open to the right of the placed previews. Switching views leaves each arrangement in place and keeps the existing iframes mounted.

**Impact** Drag previews into a custom arrangement, lock it, or return the current view to Row or Grid.

---

## Testing

- Verified in Chrome that dragging a step moves it horizontally and vertically while preserving its dialog and form state. Also verified layout locking, separate positions for both views, new-step placement, and resetting to Row.

---

## Files changed

| Files | Lines in the combined commit | Purpose |
|---|---:|---|
| `extension/app.js`, `docs/app.js` | +499 −139 each | Independent positioning for the device wall and steps |
| `README.md` | +66 −20 | Release notes and usage |
| `changelogs/CHANGELOG-page-step-placement.md` | +34 | Change and testing notes |
