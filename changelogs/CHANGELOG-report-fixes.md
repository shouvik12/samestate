# Report Fixes — Partial Scans, Clean Exports, Journeys, Sweep and Baseline

- **Partial scans are labelled:** a screen that does not answer a scan within 4 seconds is listed under **Not measured** in the report, with a **Detect again** link, and in the Markdown and HTML exports. Before, the scan quietly left it out and could look clean
- **Clean reports export:** with zero findings, Markdown and HTML export threw a TypeError (and so did the CI script, before writing any file). The report now takes its reference from the chosen reference screen when there is no finding to take it from
- **Journeys reopen on their first page:** a saved journey whose first step was closed reopened on the site's start page. Step 1 is now rebuilt from its saved page and clicks, and steps that can't be reopened are counted in the "Opened …" message
- **Denser width sweep:** widths are checked every 10px up to 1000px and every 20px above (was 20px and 40px), with a larger bisect budget; README states the remaining limit
- **Baseline when everything is fixed:** with a saved baseline and no findings left, the baseline summary now shows "0 new · N fixed" instead of disappearing
- CI script: `notMeasured` in `report.json`, a "Not measured" line in its output, and screens that did not answer fail the run unless `--fail-on=none`

---

## Summary
Five problems reported in review, all confirmed before fixing: three reproduced in the web demo (partial scan, clean export, baseline) and two by reading the code (journey restore, sweep sampling).

---

## 1. Partial Scans
**Files:** `extension/app.js`, `extension/report.js`, `extension/app.css`, `tools/samestate-ci.mjs` (and `docs/` copies)
**What:** `detect()` stores `lastScan.missing`, the ready screens that sent no snapshot. The journey report does the same and no longer lists unmeasured steps as screens. `scanNote()` puts a warning above the findings; with no findings it says "No differences found on the screens that were measured". Wherever the report is cleared, `lastScan` is cleared too.
**Impact:** A report never looks complete when a screen was skipped.

## 2. Clean Exports
**Files:** `extension/report.js`
**What:** `collect()` falls back to the scanned screen matching the reference choice (or the first scanned screen) when there is no finding, and includes Compare sites columns that were scanned but clean. `referenceName()` and `sizeOf()` accept no screen.
**Impact:** `samestateReport('md' | 'html')` works for a clean scan, so the CI script writes its reports.

## 3. Journey Restore
**Files:** `extension/workspaces.js`
**What:** Before Page steps is switched on, step 1 is added from `pages[0].url` and its saved clicks when it is on the opened site. Steps on another site increase `skippedSteps`, which the success message reports.
**Impact:** The restored journey matches the saved one, or says what it could not reopen.

## 4. Sweep Sampling
**Files:** `extension/app.js`, `README.md`
**What:** `SWEEP_WIDTHS` has 115 widths (was 58); bisect budget 200 (was 140).
**Impact:** A problem has to be narrower than 10px (20px above 1000px) to be missed; the README says so under Known limits.

## 5. Baseline With No Findings
**Files:** `extension/app.js`
**What:** `compareBaseline()` loads the baseline whenever there is a scan of the current site, not only when there are findings; `renderBaseline()` shows the bar when there are findings or a baseline.
**Impact:** Fixing everything shows up as "N fixed".

---

## Testing
- Web demo, headless Chrome, before the fixes: a silent screen left out with no note; Markdown and HTML export threw `Cannot read properties of undefined (reading 'journeyRef')`; the baseline bar hid with 90 baseline findings and 0 current
- After the fixes, same page:
  - Silent iPhone: "Not measured: iPhone 11 Pro…" in the report, Markdown and HTML; the note went away once it answered again
  - Zero findings: Markdown, HTML and CSV export work ("Compared with: Desktop (1920 × 1080)")
  - Baseline: "0 new · 90 fixed"
  - Overflow only from 805 to 815px on Desktop: "Page scrolls sideways at 320–660px, 805–815px"; the sweep took 25 s
  - Journey with only Pricing (step 1 closed), saved and reopened: Pricing, "Opened “pricing-only”."
- `node tests/smoke.mjs`: 37/37 checks passed, 0 page errors
- `node tools/samestate-ci.mjs` on a small local page: four report files written, exit code 0, `notMeasured: []`
