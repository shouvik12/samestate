# Above-the-Fold Check — Key Content Pushed Down on Phones

- `analyze()`: **Key controls below the fold** (warning): buttons, links and fields of at least 1800px² that sit on the reference screen's first screen but start below the fold on this one, with how many screens down
- `analyze()`: **Main heading below the fold** (info): the first `h1` when it moves below the fold, or is cut by it
- `snapshot()` returns `vh` (the preview's viewport height)
- Navigation items and inline links are left out

---

## Summary
The report now says when something the desktop shows on its first screen needs scrolling on a phone.

---

## 1. Fold check
**Files:** `extension/app.js`, `extension/agent.js`, `docs/app.js`, `docs/agent.js`
**What:** Matched pairs from `matchItems()` are compared using page coordinates (`y`) against each screen's `vh`. Runs only against the reference screen, after matching.
**Impact:** A new Layout finding that marketers and product people ask about: "Sign up is 1.3 screens down on iPhone".

---

## Testing
- In the web demo (`docs/`, served locally) in the Browser pane: a test button placed inside Desktop's first screen and below the fold on phones was reported on the iPhone, Android and Pixel; the heading finding said "cut off by the bottom of the screen" on the MacBook Air
- `node tests/smoke.mjs`: 34/34 checks passed, 0 page errors (6 new checks after the tour)
- Not run by hand in the installed extension; the extension path was run headless through `tools/samestate-ci.mjs`

---

## Files Changed (3 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | +12 | Fold check |
| `extension/agent.js` | +1 | `vh` in the snapshot |
| `docs/app.js, docs/agent.js` | same | Copies |
