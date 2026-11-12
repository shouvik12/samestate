# Per-Site Access — Extension Rework Around One Selected Origin

- Replaced `host_permissions: ["<all_urls>"]` with `optional_host_permissions`; Chrome now asks for access to one site when you open it
- Header removal is limited to the selected origin with a `regexFilter` on the session rule, instead of every sub-frame in the tab
- The agent is injected only into frames on the selected origin, targeted by `documentId`
- The toolbar icon opens an empty Samestate tab; the address is typed there instead of being taken from the current page
- Preview frames talk to the app over extension ports, identified by a one-time token, instead of `postMessage`
- Preview frames are `credentialless` and sandboxed, so they start with separate, temporary storage and no existing sign-ins
- Controls and scroll sections are matched by their position in the page structure
- Added the optional **Match visible text** setting, which compares HMAC fingerprints of rendered text; raw text does not leave the frame
- Removed mirroring of typing, form fields, key presses and navigation; these stay in the screen where they happen
- Difference-report items are named by category (`heading`, `text`, `link`) instead of by their text
- Bumped the extension to `0.1.1` and set `minimum_chrome_version` to `110`
- Added a "Chrome extension privacy" section to `README.md`

---

## Summary
The extension no longer needs access to every website. It asks for one site at a time and limits everything it does (header removal, script injection, inspection) to that site inside the Samestate tab. To avoid reading page content, matching moved from labels and text to page structure, with text matching as an opt-in.

---

## 1. Permissions and Background Worker
**Files:** `extension/manifest.json`, `extension/background.js`
**What:** Host access is optional and requested per site with `chrome.permissions.request`. `register(tabId, origin)` validates the origin, checks the permission, and adds a `declarativeNetRequest` session rule that removes frame-blocking headers only for sub-frame requests matching `^<origin>/`. `webNavigation.onCommitted` injects `agent.js` only when the frame's origin equals the registered one.
**Impact:** Installing the extension no longer grants access to all sites. Sites other than the one being previewed are not touched.

## 2. Messaging Between App and Frames
**Files:** `extension/app.js`, `extension/agent.js`
**What:** The agent announces itself with a `__samestateReady` message, receives a per-device token, and opens a `chrome.runtime` port named `samestate-preview`. The app accepts the port only if the token, tab and origin all match. The bundled demo keeps using `postMessage` with a strict origin check.
**Impact:** Page scripts on the previewed site cannot read or forge sync messages.

## 3. Structural Matching and Optional Text Matching
**Files:** `extension/agent.js`, `extension/app.js`, `extension/app.html`
**What:** `elementPath()` describes an element by child indexes from `<body>`; `locate()` resolves it on other screens. With **Match visible text** on, `textFingerprint()` signs up to 160 characters of rendered text with a per-session HMAC key and compares the fingerprints. Form fields, editable regions and `data-samestate-private` elements are excluded.
**Impact:** No page text is read unless the user opts in. Sites that use different markup per screen size match less often than before; the hamburger-drawer behaviour is now specific to the bundled demo.

## 4. Reduced Mirroring
**Files:** `extension/agent.js`, `extension/app.js`
**What:** Removed capture and replay of `input`, `change`, `keydown` and link navigation. `SYNC` now lists clicks, scrolling and hover only.
**Impact:** Form input and navigation stay in the screen where they happen. Screens can end up on different pages; see `CHANGELOG-align-screens.md`.

## 5. Docs Copy and README
**Files:** `docs/agent.js`, `docs/app.js`, `docs/index.html`, `README.md`
**What:** `docs/` carries the same app files for the GitHub Pages demo. The README describes the new behaviour and adds a privacy section.
**Impact:** The live demo changes once this reaches `main`.

---

## Files Changed (9 total)

Line counts are for the whole commit `f631c39`, which also contains the fixes described in the other 2026-11-12 changelogs.

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | +281 −283 | Matching, capture and replay rewrite |
| `extension/app.js` | +343 −116 | Ports, permissions, report matching |
| `extension/background.js` | +96 −27 | Per-origin rule and injection |
| `extension/manifest.json` | +3 −2 | Optional host access, version |
| `extension/app.html` | +6 −6 | Match visible text control, wording |
| `docs/agent.js` | +281 −283 | Copy of `extension/agent.js` |
| `docs/app.js` | +343 −116 | Copy of `extension/app.js` |
| `docs/index.html` | +6 −6 | Same changes as `app.html` |
| `README.md` | +26 −30 | Behaviour and privacy description |
