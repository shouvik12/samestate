# Report Export — Markdown, CSV and HTML, With Optional Screenshots

- Added an **Export** menu to the Differences panel with **Markdown (.md)**, **CSV (.csv)**, **HTML page (.html)** and **HTML with screenshots**
- Exports include every finding, whatever category filter is selected, grouped by problem like **By issue**: severity sections, the screens affected, and each screen's details
- Each export starts with the page address, the reference screen, every measured screen with its viewport size, the time of the scan, and the issue, warning and adaptation counts
- CSV has one row per finding and screen (site, page, severity, category, issue, screen, viewport, finding, details, reference) and a UTF-8 byte-order mark for spreadsheet apps
- The HTML file is self-contained, follows the system light or dark setting, and needs nothing else to open
- **HTML with screenshots** asks to share the current tab once, shows each affected screen alone in Focus mode, outlines the finding, and crops a frame to that screen (JPEG, up to 900 px wide); the previous layout comes back afterwards
- Screenshots are on the device wall only; the option is disabled in **Compare sites** and where Chrome cannot capture a tab
- Files are named `samestate-report-<host>-<date>-<time>` in local time; the sample site is named `sample-site`
- `capture.js` exposes `wallCapture` (`start`, `frame`, `stop`, `error`) for the export, and the frame grab is shared with **Screenshot**
- `app.js`: `issueGroups()` now sorts each problem's findings and the problems themselves, so the panel and the export use the same order; `detect()` records the time and the measured screens (`lastScan`)

---

## Summary
Findings could only be read in the side panel. They can now be exported to file bugs or share a review, with a picture of each problem on the screen where it happens.

---

## 1. Formats
**Files:** `extension/report.js`, `docs/report.js`
**What:** `collect()` builds the shared data from `issueGroups(findings)` and `lastScan`, one part per site in **Compare sites**. `markdown()`, `csv()` and `html()` render it, and `download()` saves it through a temporary object URL.
**Impact:** No network requests; the file is created in the page.

## 2. Screenshots
**Files:** `extension/report.js`, `extension/capture.js`, and their copies in `docs/`
**What:** `screenshots()` starts one tab capture cropped to `#canvas`, then for each finding with elements sets `focusDev`, switches to Focus mode, posts `highlight`, waits 800 ms and crops the grabbed frame to the screen's `.dev-body`. Findings without elements (such as a missing viewport tag) have no screenshot.
**Impact:** About a second per finding: the sample site's 66 findings with elements take a little over a minute. The status line counts them.

## 3. Panel Controls
**Files:** `extension/app.html`, `extension/app.css`, `extension/app.js`, `docs/index.html`, `docs/app.css`, `docs/app.js`
**What:** The **By issue / By device** switch and the **Export** menu share a bar (`#report-bar`) that appears once there are findings. A status line under it confirms the download.
**Impact:** The panel layout is otherwise unchanged.

---

## Testing
- In the web demo: Markdown, CSV and HTML downloaded with the expected content (CSV rows matched the number of findings)
- **HTML with screenshots** ran with a stand-in for Chrome's tab capture: 66 screenshots for the 66 findings with elements, Focus mode for each, and the Grid layout restored afterwards. Real tab capture was not exercised, because the share prompt needs a person
- Fixed during testing: every card in the HTML file had the red issue border, because the card class was also a severity name
- The smoke test checks all three text formats
- Not run inside the Chrome extension

---

## Files Changed (10 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/report.js` | +210 | New: export |
| `extension/capture.js` | +25 −8 | Shared frame grab, `wallCapture` |
| `extension/app.js` | ≈ +13 −9 | `issueGroups()` order, `lastScan`, report bar |
| `extension/app.html` | +14 −1 | Export menu, script |
| `extension/app.css` | ≈ +13 −1 | Bar and menu |
| `docs/…` (5 files) | same | Copies |
| `README.md` | ≈ +9 | Export section, file list, release note |
