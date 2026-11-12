# Device catalog and sidebar drawers

- Grouped Capture, Devices, Layout, Sync, and Compare into independent drawers.
- Added a toolbar control to hide and reopen the sidebar.
- Expanded the catalog to 83 presets, including separate folded and unfolded viewports where requested.
- Added search by device name or dimensions and a **Selected only** filter.
- Added creation and removal of custom devices saved in the browser.
- Selecting a device adds or removes its own frame while other previews keep running.
- Landscape and portrait controls respect the starting orientation of wide foldables and tablets.

---

## Summary

Find responsive testing viewports and adjust the wall from a smaller set of sidebar sections. Presets use CSS dimensions and render in the browser running Samestate.

## 1. Sidebar drawers

**Files** `extension/app.html`, `extension/app.css`, `extension/app.js`, `docs/index.html`, `docs/app.css`, `docs/app.js`

**What changed** Native disclosure controls group related settings. The toolbar toggles the whole sidebar.

**Impact** You can collapse unused tools or give the device wall more room.

## 2. Device catalog and selection

**Files** `extension/devices.js`, `extension/app.js`, `docs/devices.js`, `docs/app.js`

**What changed** The picker filters by model and viewport dimensions and stores custom presets locally. Device selection updates individual iframes, and the reference picker follows the selected devices.

**Impact** You can compare more form factors and change the wall without losing the state of the previews already open.

---

## Testing

- Verified drawer toggles, preset counts, searches, and the selected filter in Chrome.
- Checked that adding a foldable used the specified viewport and preserved an existing iframe.
- Verified custom preset creation, reload persistence, and removal in Chrome.
- Checked JavaScript syntax and extension/demo asset parity.

---

## Files changed

| Files | Lines in the combined commit | Purpose |
|---|---:|---|
| `extension/devices.js`, `docs/devices.js` | +315 each | Device presets and picker |
| `extension/app.js`, `docs/app.js` | +499 −139 each | Device lifecycle, reference picker, and sidebar toggle |
| `extension/app.html`, `docs/index.html` | +147 −46 each | Drawers and custom device form |
| `extension/app.css`, `docs/app.css` | +85 −17 each | Drawer, picker, and special device styling |
| `README.md` | +66 −20 | Usage, sources, and release notes |
| `changelogs/CHANGELOG-device-drawers.md` | +53 | Change and testing notes |
