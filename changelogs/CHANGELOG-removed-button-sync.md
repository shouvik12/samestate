# Buttons That Remove Themselves — Their Clicks Reach Every Screen

- Fixed: a click on a button that the page removes (a cookie banner's Accept, a toast's Dismiss, an item's Remove) was dropped with no Sync log entry; it is now sent and logged
- Fixed: a toggle the page redraws as a new element was dropped the same way; its state is read from the new copy
- `beforeClick()` reads the control's description, text fingerprint, list lengths and unique attributes before the page's own handlers run
- A removed control is sent with `d.gone`; `findGone()` clicks the same place only when the lists around it have the same length, or a control whose attributes were unique on the leading screen
- A click that opened another page is still left to link sync
- The Sync log notes a click on a form button, which stays on its screen
- `tests/smoke.mjs`: seven checks with real mouse clicks

---

## Summary
`f631c39` (the per-site access rework) made `mirrorClick()` give up when the clicked control had left the page after its 90 ms wait. The first release sent such clicks. This restores that, with a guard against clicking a neighbour.

---

## 1. Removed controls
**Files:** `extension/agent.js`
**What:** `mirrorClick()` no longer returns when the control is disconnected, unless the address changed. Controls that stay on the page are matched as before.
**Impact:** Banners, toasts and list items close on every screen. With **Use my sign-ins** on, a removed item's button now acts on the real account from each screen, as other buttons already did.

## 2. Neighbour guard
**Files:** `extension/agent.js`
**What:** `rowsOf()` counts same-tag siblings at each level above the control; the count must agree on the other screen.
**Impact:** If a screen has already lost the item, it logs `no match` instead of removing the next one.

## 3. Sync log note
**Files:** `extension/app.js`, `extension/agent.js`
**What:** New `stayed` message for buttons inside a form.
**Impact:** The log shows that the click was seen and kept on one screen on purpose.

---

## Testing
- All seven new checks failed on the code before the fix (62/69) and pass after it
- `node tests/smoke.mjs`: 69/69 checks, 0 page errors, in repeat runs. One earlier run failed the Export check (no files captured); it did not recur and the cause was not found
- `node tests/testrun.mjs`: 23/23 checks, through the extension in headless Chrome
- The new checks use real mouse events on the web demo. Not tried by hand in the installed extension or on a real site

---

## Files Changed

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | about +57 −11 | Fix and guard |
| `extension/app.js` | +10 | Sync log note |
| `docs/agent.js`, `docs/app.js` | same | Copies |
| `tests/smoke.mjs` | about +76 | Checks |
| `README.md` | +4 | Known limit, release note |
