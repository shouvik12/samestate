# Address Placeholder — Drop the localhost:3000 Example

- The address bar's placeholder is now `https://your-site.com`; the second example, `localhost:3000`, is removed
- Changed in the markup (`#src` in `app.html` and `docs/index.html`) and where `updateWall()` resets the placeholder
- Local addresses still work the same way: typing `localhost:<port>` opens it over `http://`

---

## Summary
The `localhost:3000` example read as if Samestate were connecting to something on that port. The placeholder now shows a single site address.

---

## 1. Placeholder Text
**Files:** `extension/app.html`, `extension/app.js`, `docs/index.html`, `docs/app.js`
**What:** Both copies of the `#src` placeholder and the reset in `updateWall()` drop `   ·   localhost:3000`. The Page steps placeholder ("Enter a site or /path") and the web demo's own placeholder are unchanged.
**Impact:** Text only; parsing of local addresses in `parseAddress()` is unchanged.

---

## Testing
- Checked that no `localhost:3000` remains in `extension/` or `docs/`, and that `app.js` passes a syntax check
- Not checked in Chrome; the web demo shows its own placeholder, so the change is visible only in the extension

---

## Files Changed (5 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.html` | +1 −1 | Placeholder |
| `extension/app.js` | +1 −1 | Placeholder reset |
| `docs/index.html` | +1 −1 | Copy |
| `docs/app.js` | +1 −1 | Copy |
| `README.md` | +1 −0 | Release note |
