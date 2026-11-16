# Accessibility Checks — Hidden Controls and Tab Order

- New report category **Accessibility** (`CATS`)
- **Keyboard reaches hidden controls** (warning): focusable controls that Tab reaches although they can't be seen, in an off-screen fixed panel (closed drawer), a collapsed panel or a transparent layer (`hiddenReason()` in `agent.js`)
- Skip links (`href^="#"`), `inert`, `aria-hidden`, `tabindex=-1`, disabled and `visibility: hidden` controls are left out
- **Tab order differs from what you see** (warning): visible controls whose document order disagrees with their position on screen, using the longest run that keeps its order (`keptInOrder()`)
- Controls inside fixed or sticky bars (cookie banners, sticky headers) are left out of the Tab order check (`pinned` in the snapshot)
- Snapshot controls carry `dom` (document order) and `pinned`; the snapshot returns `hiddenFocus`
- Fixed: a control that is itself transparent over its own styled box (Wikipedia's language select, custom checkboxes) no longer counts as hidden; only controls inside a transparent container do
- Fixed: controls whose boxes overlap on one row keep their document order in the Tab order check

---

## Summary
Two keyboard problems that change from one screen size to another are now in the report.

---

## 1. Hidden controls
**Files:** `extension/agent.js`, `extension/app.js`
**What:** `snapshot()` walks focusable elements (up to 3000) and keeps those that are rendered, focusable and not `visible()`, with the reason found on the element or an ancestor.
**Impact:** Catches the common phone bug where a closed drawer's links still take keyboard focus.

## 2. Tab order
**Files:** `extension/app.js`
**What:** Visible, unpinned controls are sorted by on-screen position (same row → left to right) and compared with document order.
**Impact:** Flags CSS `order` and grid placement that make Tab jump around.

---

## Testing
- On wikipedia.org, developer.mozilla.org and example.com through `tools/samestate-ci.mjs`: the transparent-select false positive is gone; the remaining Tab order findings on Wikipedia's phone layout are real (the search box comes after the language links in the HTML but shows above them)
- In the web demo (`docs/`, served locally) in the Browser pane: the sample site's off-canvas drawer was reported as 4 hidden controls on all 7 screens; the first version flagged the fixed cookie banner's button as out of order, which led to the `pinned` exclusion
- `node tests/smoke.mjs`: 34/34 checks passed, 0 page errors (6 new checks after the tour)
- Not run by hand in the installed extension; the extension path was run headless through `tools/samestate-ci.mjs`

---

## Files Changed (3 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | +25 | Hidden focus, `dom`, `pinned` |
| `extension/app.js` | +20 | Checks, `keptInOrder()` |
| `docs/agent.js, docs/app.js` | same | Copies |
