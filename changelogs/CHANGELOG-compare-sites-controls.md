# Compare sites controls

- Linked the vertical scrolling of the outer device walls in **Compare sites**.
- Kept the sidebar available in the split view. Device selection and layout controls apply to the comparison walls. Sync and difference reports work within each site's devices.
- Fixed: Compare sites keeps device cards in the automatic layout until a screen is placed by dragging.
- Added **Screenshot** and **Record** for the visible comparison, with one crop across the open site columns.

---

## Summary

Use the same controls while comparing websites and capture both walls as they appear in the workspace.

## 1. Shared sidebar and outer scrolling

**Files** `extension/app.js`, `extension/app.html`, `extension/app.css`, `extension/devices.js`, `extension/background.js`, and the matching hosted demo assets

**What changed** The comparison uses the existing sidebar and layout controls. Outer scroll positions follow the wall being scrolled, while preview agents route sync and report data within their own site. Device selections in Compare sites are independent of the single-site wall.

**Impact** You can scroll through matched devices, change the device set, and inspect differences without leaving the split view. **Page steps** still opens the journey on the device wall.

## 2. Comparison capture

**Files** `extension/capture.js`, `extension/app.html`, `extension/app.css`, `docs/capture.js`, `docs/index.html`, `docs/app.css`

**What changed** Both views render inside the same tab-capture region. Chrome crops the user-selected tab to that region, and the capture controls export a PNG or a silent WebM.

**Impact** A single capture includes all site columns visible on screen. The sidebar and browser toolbar sit outside the crop.

---

## Testing

- Verified Chrome scrolling in both directions, sidebar device selection and layout changes, and per-site mirroring and reports.
- Inspected PNG screenshots taken with and without an active recording, and decoded a WebM frame. Both comparison walls were visible in the captures.
- Confirmed that the regular device wall still saves a screenshot.
- Checked that comparison cards stay separated in Grid and Row after resizing and that dragging affects only its own wall.

---

## Files changed

| Files | Approx. lines changed | Purpose |
|---|---:|---|
| `extension/app.js`, `docs/app.js` | +220 −72 each | Shared controls, scroll linking, and site-scoped routing |
| `extension/app.html`, `docs/index.html` | +18 −16 each | Shared sidebar and capture area |
| `extension/app.css`, `docs/app.css` | +4 −2 each | Workspace layout |
| `extension/capture.js`, `docs/capture.js` | +72 −19 each | Split-view crop and frame export |
| `extension/devices.js`, `docs/devices.js` | +5 −4 each | Device selection in each workspace |
| `extension/background.js` | +2 −2 | Preview agents for approved site origins |
| `README.md` | +4 −1 | Usage and release note |
| `changelogs/CHANGELOG-compare-sites-controls.md` | +52 | Change and testing notes |
