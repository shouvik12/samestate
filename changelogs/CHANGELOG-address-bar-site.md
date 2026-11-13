# Address Bar Site — Keep the Opened Site in the Address Bar

- After a site opens, the address bar keeps showing its address instead of clearing back to the placeholder
- The bar still clears for the bundled sample site and while **Page steps** is on, where it is used to enter the next page
- Changed in `open()`: `$('#src').value = isDemo || pageSteps ? '' : url.href`

---

## Summary
The address bar emptied once a preview opened, so it no longer said which site was on the wall. It now keeps the opened address.

---

## 1. Address Bar After Opening
**Files:** `extension/app.js`, `docs/app.js`
**What:** `open()` sets the address input to the opened URL rather than an empty string, except for the sample site and in **Page steps**.
**Impact:** The address bar shows what is being previewed. After a redirect to another host, it shows the address that finally opened.

---

## Testing
- Commit `00bc914` (2026-11-13 13:26:06 +05:30) shipped without a changelog; this file was added afterwards from the commit's diff
- Covered indirectly by the smoke test, which opens the sample site, where the bar still clears

---

## Files Changed (2 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | +2 −1 | Address bar value |
| `docs/app.js` | +2 −1 | Copy of `extension/app.js` |
