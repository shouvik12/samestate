# Default Site — Open claude.com When Samestate Starts

- The extension now opens `https://claude.com/` on every screen as soon as the Samestate tab opens
- Added `host_permissions: ["https://claude.com/*"]` to the manifest, so the default site loads without an access prompt
- Added `DEFAULT_SITE` and `openDefault()` in `app.js`; if access is missing, the address is filled in and the user is asked to press Enter
- The guided demo no longer plays automatically on first run in the extension; it is still available from the **Demo** button
- Removed the `samestate.seenDemo` flag from `localStorage`, which only existed to decide whether to auto-play the demo
- The web demo (GitHub Pages) is unchanged and still starts with the tour on the bundled sample site
- Bumped the extension to `0.1.2`
- Updated the Install section of `README.md` to describe the new start-up behaviour

---

## Summary
Opening Samestate used to show the guided demo once and an empty wall after that. It now always starts with a real site, `claude.com`, already loaded on every screen.

---

## 1. Start-up
**Files:** `extension/app.js`, `docs/app.js`
**What:** At boot, the extension calls `openDefault()`, which checks access with `chrome.permissions.contains` and then calls `open(DEFAULT_SITE, true)`. It does nothing if the user has already opened something. The web build calls `startTour()` as before.
**Impact:** The wall is never empty on start. Typing another address works as before and still asks for access to that site.

## 2. Built-in Access to the Default Site
**Files:** `extension/manifest.json`
**What:** `claude.com` is a required host permission; every other site stays optional and is requested when opened.
**Impact:** Chrome lists "Read and change your data on claude.com" when the extension is installed or updated. An already-installed unpacked copy picks the permission up on reload.

---

## Testing
- `claude.com` answers directly with no redirect and sends `X-Frame-Options: SAMEORIGIN`, which the extension's header rule removes for preview frames
- Syntax and manifest checks only; not yet confirmed in Chrome that the site renders inside the frames

---

## Files Changed (4 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | ≈ +13 −3 | `DEFAULT_SITE`, `openDefault()`, boot |
| `extension/manifest.json` | +2 −1 | Host permission, version |
| `docs/app.js` | ≈ +13 −3 | Copy of `extension/app.js` |
| `README.md` | ≈ +3 −2 | Install text, release note |
