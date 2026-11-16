# Journey Report — Every Page Step on Every Device

- **Views → Check journey on every device** (`#journey`, shown with Page steps on) sets each selected device as the step size in turn and snapshots every step
- Each step is compared with the same step on the desktop (or the first selected device) with `analyze()`
- Findings name the step and device ("Step 3 · iPhone 11 Pro") through `label`; `screenName()` uses it
- The report heading says "Each step compared with Desktop"; the status line lists the step and device pairs with issues
- The device for all previews is put back afterwards; journey screens carry `fixedSize` for exports
- Exports name the reference as "Desktop, the same step" instead of Step 1's screen

---

## Summary
Shows which step of a flow breaks on which screens, instead of one page at a time.

---

## 1. Journey
**Files:** `extension/app.js`, `extension/app.html`, `docs/*`
**What:** `journeyReport()` loops over `DEVICES.filter(d => d.on)`, waits for each resize, then builds one screen object per step and device for `analyze()`.
**Impact:** A sign-in or checkout flow can be checked on every device with one click.

---

## Testing
- Export menu after a journey report: Markdown, CSV (121 rows for 121 findings) and HTML, with each device's own size
- In the web demo (`docs/`, served locally) in the Browser pane: 2 steps on 7 devices took 7s and gave 124 findings, with issues on Step 1 for the phones and none on Step 2; the shared device went back to the iPhone
- `node tests/smoke.mjs`: 34/34 checks passed, 0 page errors (6 new checks after the tour); the journey itself has no smoke check
- Not run by hand in the installed extension; the extension path was run headless through `tools/samestate-ci.mjs`

---

## Files Changed (3 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | +45 | Journey report, labels |
| `extension/app.html` | +1 | Button |
| `docs/*` | same | Copies |
