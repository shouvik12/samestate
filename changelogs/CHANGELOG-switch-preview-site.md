# Switch sites in Page steps

- Fixed: The address bar so a different domain or URL opens a new site while **Page steps** is on. Same-origin addresses and paths still add a step to the current journey.
- The new site starts at Step 1 with the selected device size. If access is declined, the current previews stay open and the address bar shows the reason.

---

## Summary

The address bar accepts a different site while Page steps is enabled.

## 1. Switch the active site

**Files** `extension/app.js`, `docs/app.js`, `extension/app.html`, `docs/index.html`, `extension/app.css`, `docs/app.css`

**What changed** The address bar resolves the input before choosing between adding a step and switching sites. Samestate replaces the current previews after Chrome grants access and registers the new origin.

**Impact** You can start a new journey by entering its domain, or append a step by entering a path on the current site.

---

## Testing

- Verified in Chrome with two local sites that bare addresses and full URLs switch sites, same-site paths append steps, and a declined permission result preserves the current previews. The successful switches used a test extension with site access already granted.

---

## Files changed

| Files | Lines in the combined commit | Purpose |
|---|---:|---|
| `extension/app.js`, `docs/app.js` | +499 −139 each | Address parsing and site access |
| `extension/app.html`, `docs/index.html` | +147 −46 each | Address status in the toolbar |
| `extension/app.css`, `docs/app.css` | +85 −17 each | Address status styling |
| `README.md` | +66 −20 | Release notes and usage |
| `changelogs/CHANGELOG-switch-preview-site.md` | +36 | Change and testing notes |
