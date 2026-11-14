# Baseline — What Is New and What Is Fixed

- **Save as baseline** in the Differences panel stores the scan for the site in this browser (`localStorage`, key `samestate.baseline.<origin>`)
- Later scans mark new findings with a **New** tag and list the fixed ones; the **N new** chip shows new findings only
- **Replace baseline** and **Clear**; findings are matched by screen and issue kind (`findingId()`)

---

## Summary
Re-run the report after a change and see only what changed.

---

## 1. Baseline
**Files:** `extension/app.js`, `extension/app.html`, `extension/app.css`, `docs/*`
**What:** `compareBaseline()` runs at the start of `renderFindings()` and sets `isNew`; `renderBaseline()` draws the bar (`#baseline`).
**Impact:** The report becomes useful before every release, not once.

---

## Testing
- In the web demo (`docs/`, served locally) in the Browser pane: after a fix preview, the baseline listed the fixed table and sideways scrolling findings on four phones and the new ones
- `node tests/smoke.mjs`: 34/34 checks passed, 0 page errors (6 new checks after the tour)
- Not run by hand in the installed extension; the extension path was run headless through `tools/samestate-ci.mjs`

---

## Files Changed (4 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | +45 | Baseline |
| `extension/app.html` | +1 | Bar |
| `extension/app.css` | +6 | Styles |
| `docs/*` | same | Copies |
