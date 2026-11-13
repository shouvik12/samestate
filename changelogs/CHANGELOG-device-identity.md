# Device Identity — Phone and Tablet Previews Tell the Page What They Are

- Phone and tablet previews now report their device to the page's scripts: user-agent, `navigator.platform` and `vendor`, `userAgentData` (mobile on Android, absent on iOS), `maxTouchPoints`, `ontouchstart`, `devicePixelRatio`, and `screen` width and height
- `matchMedia()` answers hover and pointer queries as a touch screen does (`hover: none`, `pointer: coarse`), and resolution or `device-pixel-ratio` queries with the device's pixel ratio
- iPhones use an iOS Safari user-agent; iPads report themselves as a Mac with touch, as real iPads have since iPadOS 13; Android phones and tablets use Chrome's reduced Android user-agent, with "Mobile" for phones only
- Pixel ratio is 3 for phones and 2 for tablets; desktop presets keep the browser's own identity
- Added **Phone and tablet identity** to the **Views** drawer, on by default and remembered in the browser; changing it reloads the previews
- Identity follows **Same device on every screen** and Page steps, and applies from the next page load after a preset or orientation change
- Added `emulate.js`, which runs in the page's own world before its scripts and exits at once unless it is inside a Samestate preview frame whose name carries a device
- The extension registers `emulate.js` as a content script only for the sites that Samestate tabs have open, and removes it when none are open; no new permissions
- The sample site loads `emulate.js` itself and shows an "open in the app" banner to phones only, chosen by user-agent as many real sites do
- Added a guided demo step, **Device identity**, and its smoke check

---

## Summary
Previews had the device's size but your computer's identity, so a page's scripts saw a desktop browser with a mouse on every screen. Phones and tablets now report themselves to the page's scripts. Requests to the server and stylesheet media queries are not changed: that would need Chrome's debugger API.

---

## 1. Emulation Script
**Files:** `extension/emulate.js`, `docs/emulate.js`
**What:** Reads a JSON device description from `window.name` (prefix `samestate-device:`), checks that the parent is a `chrome-extension://` page or the web build's own origin, then defines getters on `navigator`, `window` and `screen`. `matchMedia` is wrapped: each hover, pointer and resolution test in the query is replaced with an always-true or always-false width test before the real `matchMedia` runs, and the returned list keeps the original `media` text.
**Impact:** Detection by page scripts, such as user-agent checks, `'ontouchstart' in window` or `matchMedia('(hover: none)')`, now sees the device. The page can still read the description in `window.name`.

## 2. Identity per Preview
**Files:** `extension/app.js`, `extension/agent.js`, `extension/app.html`, and the copies in `docs/`
**What:** `deviceIdentity()` builds the description from the preview's preset and orientation, and `addFrame()` puts it in the frame's `name` before the first load. Chrome keeps the name a frame was created with even when the attribute changes, so `setIdentity()` sends later changes to the preview's agent, which renames its window (only to or from Samestate's own names) and reloads when asked. Previews also receive their identity when they connect.
**Impact:** Turning the setting off and on, or switching a shared preset between phone and desktop, takes effect on reload without recreating the previews.

## 3. Registration in the Extension
**Files:** `extension/background.js`
**What:** `syncEmulation()` collects the origins of every Samestate tab from session storage and registers, updates or removes one content script (`world: 'MAIN'`, `runAt: 'document_start'`, `allFrames: true`). It runs after each `register()` and `unregister()`, one call at a time.
**Impact:** Pages of those sites in other tabs also load the script, which returns immediately there because it is not inside a Samestate preview frame.

## 4. Sample Site and Tests
**Files:** `extension/demo/index.html`, `extension/demo/pricing.html`, `extension/demo/site.js`, `extension/demo/style.css`, `tests/smoke.mjs`, and the copies in `docs/demo/`
**What:** An app banner appears when the user-agent matches `iPhone` or `Android … Mobile`. The smoke check expects it on the iPhone, Android and Pixel only, and checks the iPhone's user-agent, touch points, pixel ratio and media answers, and that the Desktop is unchanged.
**Impact:** The difference report lists the banner as an element only on phones.

---

## Testing
- Smoke test: 28 of 28 checks passed, including the new step
- In the web demo: the banner showed on the three phones only; the iPad reported a Mac user-agent with 5 touch points; turning the setting off removed every banner and restored the real user-agent and pixel ratio 1, and turning it on brought them back; with **Same device on every screen** set to Desktop no screen had the banner, and set to iPhone all seven did
- Found while testing: changing the frame's `name` attribute did not reach the page, which is why changes now go through the agent
- Not run inside the Chrome extension, so the content-script registration in `background.js` is untested

---

## Files Changed (21 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/emulate.js` | +70 | New: in-page identity |
| `extension/app.js` | +51 | Identity per preview, setting, tour step |
| `extension/background.js` | +26 | Content-script registration |
| `extension/agent.js` | +5 | Rename window on request |
| `extension/app.html` | +1 | Setting |
| `extension/demo/…` (4 files) | +9 | Script tag, app banner |
| `tests/smoke.mjs` | +8 | Device identity check |
| `docs/…` (9 files) | same | Copies |
| `README.md`, `CONTRIBUTING.md` | +12 −5 | Views setting, known limits, roadmap, file list, release note |
