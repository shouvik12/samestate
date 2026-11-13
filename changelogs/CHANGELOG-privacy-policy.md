# Privacy Policy — Publish a Privacy Policy Page

- Added `docs/privacy.html`, a standalone privacy policy page served by GitHub Pages with the live demo
- States that Samestate runs entirely in the browser, with no accounts, analytics, tracking, or data sent to any server
- Explains what is measured in previews and what is excluded (form fields, editable regions, page titles, cookies, site storage), and how **Match visible text** works
- Explains that framing-related response headers are removed only inside the Samestate tab, only for frames, and only for the sites the user opened
- Lists what is kept in the browser (saved workspaces, custom devices, report view, the session's open sites) and the only outside requests Samestate makes (tweakcn theme presets)
- Light and dark styles follow the system setting; the page needs no scripts

---

## Summary
A privacy policy page is needed for a Chrome Web Store listing, which is on the roadmap. It describes the extension's data handling in plain terms and links to the source code.

---

## 1. Policy Page
**Files:** `docs/privacy.html`
**What:** A single HTML page with inline styles: summary, what Samestate does, pages you preview, how previews are allowed to load, data stored on your device, theme presets, sharing and selling, changes, and contact. Dated November 13, 2026.
**Impact:** Published at the live demo's address as `privacy.html` once GitHub Pages rebuilds. Nothing in the app links to it yet.

---

## Testing
- Commit `f91e5ed` (2026-11-13 22:11:09 +05:30) shipped without a changelog; this file was added afterwards from the commit's contents
- Not covered by the smoke test, which does not open this page
- The policy does not yet mention **Phone and tablet identity**: when turned on, the extension registers a script for the sites open in Samestate tabs, which does nothing outside a preview. It may be worth a sentence before the store listing

---

## Files Changed (1 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `docs/privacy.html` | +103 | New page |
