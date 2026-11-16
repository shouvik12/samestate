# Sample Site Default — Start on the Bundled Demo Site

- The extension now opens the bundled sample site (`demo/index.html`) on every screen at start-up, instead of `https://claude.com/`
- Removed `host_permissions: ["https://claude.com/*"]` from the manifest; the extension requests no site access until the user opens a site
- Replaced `DEFAULT_SITE` in `app.js` with a direct `open(DEMO_URL)`; the sample site needs no Chrome access, so there is no prompt
- The web demo (GitHub Pages) is unchanged and still starts with the tour
- New toolbar and store icons (laptop, iPhone and Android with the same dot lit) in `extension/icons/` and `docs/icons/`
- Bumped the extension to `0.1.3`
- Updated the Install section of `README.md`

---

## Summary
Samestate used to start on another company's website and ask for built-in access to it. It now starts on its own sample site, so the Chrome Web Store listing needs no host permission justification beyond "the site the user opens".

---

## 1. Start-up
**Files:** `extension/app.js`, `docs/app.js`

`openDefault()` opens `DEMO_URL` unless the user has already opened something. The demo is served from the extension itself, so `open()` skips the permission request for it.

## 2. Manifest
**Files:** `extension/manifest.json`

`host_permissions` is gone. Sites are still requested one at a time through `optional_host_permissions`.

## 3. Icons
**Files:** `extension/icons/16.png`, `48.png`, `128.png`, and the same in `docs/icons/`

The 128 px icon keeps 16 px of transparent padding, as the Chrome Web Store asks. The 16 px icon shows two phones only, so it stays readable in the toolbar.
