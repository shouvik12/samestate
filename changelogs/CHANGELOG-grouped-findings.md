# Grouped Findings — List Each Problem Once Across Screens

- Added **By issue** and **By device** views to the Differences panel (`#report-view`); **By issue** is the default
- **By issue** lists each problem once, with a chip for every screen it affects, ordered by severity and then by how many screens it affects
- Clicking a grouped finding outlines its elements on every affected screen and on the reference screen (`showFindings()`)
- Clicking a screen chip shows that screen's count and details in the card and outlines the finding on that screen only
- A screen with the same problem more than once (two overlays, two fixed bars) gets one chip, and its details are listed together
- Each group's heading names the reference screen ("Compared with Desktop"); with **Compare sites** on, issues are grouped per site and never merged across sites
- The category chips, "All" and the **Differences** count in the toolbar count issues in **By issue** and individual findings in **By device**
- The chosen view is remembered in the browser (`localStorage`, key `samestate.reportView`)
- `analyze()`: every check now passes an issue kind to `add()`, a label shared by the same check on every screen (29 checks)
- The guided demo's report step shows the grouped view and clicks the "Table is wider than its container" issue, outlining it on every phone; it does not change the saved view
- Removed "Group identical findings across devices" from the README roadmap

---

## Summary
On the sample site the report listed 76 findings for 7 screens, mostly the same problem repeated per phone. **By issue** shows them as 16 issues, each with the screens it affects.

---

## 1. Issue Kinds
**Files:** `extension/app.js`, `docs/app.js`
**What:** `add(sev, cat, dev, kind, title, detail, …)` stores `kind` on each finding. Kinds describe the check without per-screen numbers, such as "Tap targets under 24px" or "Text from Desktop hidden". `issueGroups()` groups findings by site, severity, category and kind.
**Impact:** The per-screen titles and details are unchanged and still shown in **By device** and in each chip's details.

## 2. Report Views
**Files:** `extension/app.js`, `extension/app.html`, `extension/app.css`, `docs/app.js`, `docs/index.html`, `docs/app.css`
**What:** `renderFindings()` draws grouped cards (`.finding.grouped`) with `.screen-chip` buttons, or the previous per-screen list. The chosen screen per issue is kept in `pickedScreen` across re-renders. The click handler distinguishes a card, a chip and a per-screen finding.
**Impact:** The report is shorter, and a problem's spread across screens is visible at a glance.

---

## Testing
- In the web demo (`docs/`, served locally): 76 findings became 16 issues with no screen listed twice in an issue; a chip click switched the details and outlined only that screen; a card click outlined all 5 affected screens; the Tables filter showed only table issues; **By device** showed the 76 findings and was still selected after reloading
- With **Compare sites** on, issues were grouped under "Site 1" and "Site 2" headings
- The guided demo reached its report step in the grouped view with **By device** saved, and left the saved choice unchanged
- Not run inside the Chrome extension

---

## Files Changed (8 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | +115 −45 | Issue kinds, grouped report, click handling |
| `extension/app.html` | +1 −0 | View switch |
| `extension/app.css` | +11 −0 | Switch and screen chips |
| `docs/app.js`, `docs/app.css` | same | Copies |
| `docs/index.html` | +1 −0 | View switch |
| `README.md` | +4 −3 | Report description, roadmap, release note |
