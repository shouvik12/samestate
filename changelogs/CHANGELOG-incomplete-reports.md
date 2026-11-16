# Incomplete reports

- Difference and Journey reports list previews that have yet to load under **Not measured**.
- Baseline comparisons only mark a finding fixed when its preview was measured in the current scan.
- Markdown and HTML exports include columns in **Compare sites** where every preview was unmeasured.

---

## Summary

Reports show which previews were measured so a scan in progress can be compared with a baseline accurately.

## 1. Scan coverage

**Files** `extension/app.js`, `docs/app.js`, `extension/report.js`, `docs/report.js`

The report records every selected preview and asks the connected previews for measurements. The baseline comparison uses the measured screen list and excludes missing screens. A fully unmeasured comparison column stays visible in the export.

## Testing

- Delayed an iPhone preview while six others responded. The app and both export formats listed it under **Not measured**, and the baseline showed zero fixes for that iPhone.
- Delayed the second step in a two-device journey. The report listed both measurements for that step as missing.
- The Chrome smoke suite passed 37 of 37 checks with zero page errors.

## Files changed

| Files | Change |
|---|---|
| `extension/app.js`, `docs/app.js` | Track scan coverage and check it in baseline comparisons |
| `extension/report.js`, `docs/report.js` | Include unmeasured comparison columns in exports |
| `README.md` | Release notes |
