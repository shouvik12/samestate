# Close device previews

- Added a **×** button to every device wall preview. Closing a preview also deselects it in **Devices**, where it can be reopened.

---

## Summary

Close a device preview from its title bar and reopen it from Devices.

## 1. Close and reopen a preview

**Files** `extension/app.js`, `docs/app.js`

**What changed** The extension and hosted demo use the existing device selection handler for the Close button. This updates the device count and the comparison choices while keeping the other previews open.

**Impact** You can remove an individual screen directly from the wall and select the device again when needed.

---

## Testing

- Verified in Chrome that the Close button works from the keyboard, updates the Devices drawer and comparison selector, and keeps the other previews loaded. The device reopened from the picker, and Page steps stayed open after all regular previews were closed.

---

## Files changed

| Files | Lines in the combined commit | Purpose |
|---|---:|---|
| `extension/app.js`, `docs/app.js` | +499 −139 each | Close button and device selection |
| `README.md` | +66 −20 | Release notes and usage |
| `changelogs/CHANGELOG-close-device-previews.md` | +33 | Change and testing notes |
