# CI Report — The Difference Report in Headless Chrome

- New `tools/samestate-ci.mjs <url>`: loads a copy of the extension with access to that site (`Extensions.loadUnpacked` over `--remote-debugging-pipe`), opens it on the device wall, runs the report and writes `report.md`, `report.html`, `report.csv` and `report.json`
- Options: `--devices`, `--reference`, `--sweep`, `--identity`, `--out`, `--fail-on=issue|warn|none`, `--baseline=report.json`, `--timeout`
- Exits 1 when the report (or, with `--baseline`, its new findings) has issues, or warnings with `--fail-on=warn`; 2 when it could not run
- The copy's manifest drops the default site, so it isn't loaded
- `report.js` exposes `window.samestateReport(format)` for the script
- README: **Run it in CI** with a GitHub Actions example

---

## Summary
Runs Samestate on a preview deploy and fails the build on new issues, with no packages.

---

## 1. CI script
**Files:** `tools/samestate-ci.mjs`, `extension/report.js`, `docs/report.js`
**What:** A small DevTools client over a pipe, the same no-dependency approach as the smoke test, driving the app's own functions (`toggleDevice`, `open`, `detect`, `sweepWidths`).
**Impact:** The same report as the extension, in any CI with Node 22 and Chrome.

---

## Testing
- Against the sample site served locally: 7 screens, report files written, exit 1 on issues; with `--sweep` 19s in total; with `--baseline` it reported 26 new and 14 fixed and exited 0
- Against a local test server with `--identity` (see the server user-agent changelog), 3 of 3 runs passed after fixing rule ids
- Not run in GitHub Actions

---

## Files Changed (4 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `tools/samestate-ci.mjs` | new, 180 | CI script |
| `extension/report.js` | +5 | Export hook, journey reference name |
| `docs/report.js` | same | Copy |
| `README.md` | +30 | Run it in CI |
| `CONTRIBUTING.md` | +1 | Where the CI script is |
