# Saved Workspaces — Save the Current Setup and Reopen It

- Added a **Workspaces** drawer to the sidebar: name the current setup and click **Save**, then **Open** it later; **×** deletes one
- A workspace keeps the site, the selected devices with rotation, scale, physical size and link state, layout mode, zoom, alignment, **Lock layout** and dragged positions, **Views** settings, page steps with their replayed clicks, **Compare sites** columns with their viewport choice, sync settings, the reference screen, themes and annotations
- The setup in use when the Samestate tab closes is kept as **Last session** (not while the guided demo is running)
- Opening a workspace asks Chrome once for every site it needs; in the web demo, a workspace that uses another site explains that it needs the extension
- Saving under an existing name (ignoring case) replaces it; up to 30 workspaces are kept
- Devices removed from **My custom devices** since saving are skipped, and the status line says how many
- The sample site is saved as `demo:<page>`, so a workspace still opens it when Samestate is served from another address
- Page steps are rebuilt even when **Page steps** was switched off at save time, and stay on screen until their clicks have replayed
- `annotations.js`: notes keep their position, and the controller gains `snapshot()` and `restore()`; restored values are clamped and capped
- Workspaces are stored in this browser's `localStorage` (`samestate.workspaces`, `samestate.lastSession`)
- Not saved: dragged positions inside **Compare sites** columns, and annotations or themes on single-viewport comparison previews

---

## Summary
Only custom devices survived a reload. Everything else reset when the Samestate tab closed. Workspaces bring a repeated check back in one click.

---

## 1. Saving
**Files:** `extension/workspaces.js`, `docs/workspaces.js`
**What:** `collect()` reads the app's state into plain data, with themes and annotations keyed by screen (`screen:<id>`, `step:<index>`, `site:<column>:<id>`). The `pagehide` listener stores the last session.
**Impact:** Nothing leaves the browser.

## 2. Opening
**Files:** `extension/workspaces.js`, `docs/workspaces.js`
**What:** `restore()` requests site access first while the click is still a user gesture, ends the tour, resets the views, applies devices and layout, opens the site with `open()`, rebuilds page steps with `addPage()`, rebuilds comparison columns, then applies themes, annotations and the reference screen. Every stored value is checked before use.
**Impact:** Opening reloads the previews, as opening a site does.

## 3. Drawer
**Files:** `extension/app.html`, `extension/app.css`, `docs/index.html`, `docs/app.css`
**What:** The drawer sits under **Capture** and is closed by default. Each entry shows its name, site, number of screens, page steps or compared sites, and when it was saved; the full summary is in a tooltip.
**Impact:** The sidebar gains one closed drawer.

---

## Testing
- In the web demo: saved a setup with one device removed, a rotated Pixel, Row mode with a dragged iPhone, 80% zoom, an arrow and a note on the iPhone and a theme on the Nexus 7; changed all of them; **Open** brought every one back
- Saved a setup with three page steps (the second with its menu open) and two comparison columns (one set to iPhone 11 Pro); after reloading the page it reopened with the columns, the three steps, and Step 2's menu open
- **Last session** appeared after a reload
- The smoke test saves a workspace, changes the setup and reopens it
- Not run inside the Chrome extension, so the site-access request and external sites are untested

---

## Files Changed (8 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/workspaces.js` | +224 | New: save and open |
| `extension/annotations.js` | +17 −1 | `snapshot()`, `restore()` |
| `extension/app.html` | +13 | Drawer, script |
| `extension/app.css` | ≈ +17 | Drawer styles |
| `docs/…` (4 files) | same | Copies |
| `README.md` | ≈ +6 | Workspaces section, release note |
