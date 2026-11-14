# Server User-Agent — Phone Pages From the Server

- With **Phone and tablet identity** on, phone and tablet previews load pages with `samestate-ua=<iphone|ipad|android|android-tablet>` in the address (`setPreviewSource()`)
- `background.js` adds one `modifyHeaders` session rule per device type for the tab's preview frames: the device's `User-Agent`; Android sets `Sec-CH-UA-Mobile` and `Sec-CH-UA-Platform`, iOS removes client hints as Safari does
- Rule ids are picked from unused numbers and kept per tab in session storage (`uaRuleIds()`), and removed with the tab's other rule
- `emulate.js` removes `samestate-ua` from the address with `history.replaceState` before the page's scripts run
- `agent.js` keeps the mark for pages the preview opens itself: link clicks, link sync, Align screens and reloads (`withUa()`, `reloadPage()`)
- The app sends the user-agents with `register` (`SERVER_AGENTS`); `userAgent()` is shared with the script identity
- The background worker's failed `register` reply now includes the error message
- Fixed: the screen that followed a link sent its own marked address (`?samestate-ua=iphone`) to the other screens, so Desktop loaded the iPhone page with the mark left in its address; marked addresses are never passed on, and `followAddress()` and Align screens remove another screen's mark

---

## Summary
The roadmap item: sites that pick the layout on the server now send phone and tablet pages to those previews.

---

## 1. Header rules
**Files:** `extension/background.js`
**What:** Rules match `sub_frame` requests in the Samestate tab only, for the registered origins, and only with the mark. Requests without it are untouched.
**Impact:** Desktop previews and every other tab keep the browser's own user-agent.

## 2. Marked navigation
**Files:** `extension/app.js`, `extension/agent.js`, `extension/emulate.js`
**What:** DNR can't tell one frame from another, so the page load's address carries the device type.
**Impact:** The page never sees the mark; its scripts already saw the device identity.

---

## Testing
- Real mouse click on a link inside the iPhone preview (headless, `Input.dispatchMouseEvent`): with identity on, one request per screen with its own user-agent and clean addresses everywhere; with link sync off, only the iPhone moved and kept its user-agent; with identity off, all three screens followed with the desktop user-agent and no mark
- Headless through `tools/samestate-ci.mjs --identity` against a local test server that logs user-agents: the iPhone, iPad and Android previews were served their own pages (with the expected client hints), Desktop got the desktop page, and a second page opened through Align screens kept the device user-agent; the page's own address had no mark
- Fixed during testing: the first rule ids were computed from the tab id and went out of range for large tab ids
- `node tests/smoke.mjs`: 34/34 checks passed, 0 page errors (6 new checks after the tour)
- Not tried on Google or another real site with server-side layouts

---

## Files Changed (5 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/background.js` | +50 | Header rules |
| `extension/app.js` | +15 | Marked addresses, user-agents |
| `extension/agent.js` | +25 | `withUa()` |
| `extension/emulate.js` | +9 | Remove the mark |
| `docs/*` | same | Copies |
| `CONTRIBUTING.md` | +1 −1 | What background.js does |
