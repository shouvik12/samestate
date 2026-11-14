# Width Sweep — Where a Problem Starts and Stops

- **Compare → Sweep widths** (`#sweep`) resizes the reference screen from 320 to 1000px every 20px and to 1920px every 40px, checking it at each width
- Every change between two sampled widths is bisected down to one pixel (up to 140 extra checks)
- Each problem becomes one finding in the new **Widths** category, such as "Page scrolls sideways at 320–660px", with the first width's details
- Sideways scrolling at 320px adds a WCAG 1.4.10 Reflow note
- The screen keeps its own kind at every width, so touch checks don't switch on and off with width
- Press again to stop; the screen goes back to its own size
- `size()` honours `d.sweepW`; `snapshotScreens()` snapshots any list of screens
- Fixed: a scan started while screens are resized (such as the automatic one 3.5s after opening a site) is skipped or discarded
- Fixed: a category filter with no findings left (after a sweep, for example) is cleared

---

## Summary
Bugs live between the presets. The sweep finds the exact widths where each one appears.

---

## 1. Sweep
**Files:** `extension/app.js`, `extension/app.html`, `extension/app.css`, `docs/*`
**What:** `sweepWidths()` calls `analyze()` on one screen per width and keeps the issue kinds found; `bisect()` narrows each change.
**Impact:** One finding per problem with its width ranges, grouped like the rest of the report and exported with it.

---

## Testing
- In the web demo (`docs/`, served locally) in the Browser pane: on the iPhone, 88 widths gave 12 findings such as "Overlay hides controls at 320–493px" and "Text touches the screen edge at 716–723px"; timers are throttled in that pane, so it took 88s there
- Headless, through `tools/samestate-ci.mjs --sweep`: the whole run took 19s; before the scan fix, the automatic scan had recorded Desktop at a swept width
- `node tests/smoke.mjs`: 34/34 checks passed, 0 page errors (6 new checks after the tour)
- Not run by hand in the installed extension; the extension path was run headless through `tools/samestate-ci.mjs`

---

## Files Changed (5 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | +75 | Sweep, scan guard |
| `extension/app.html` | +2 | Button, status |
| `extension/app.css` | +2 | Busy state |
| `docs/*` | same | Copies |
| `tests/smoke.mjs` | +27 | Smoke checks for the Accessibility and Network categories, fix preview, baseline, long text, screen settings and the sweep |
