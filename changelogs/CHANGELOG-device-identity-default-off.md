# Device Identity Off by Default — Phone and Tablet Identity Is Opt-In

- **Phone and tablet identity** in Views is now off unless the user turns it on; the choice is still remembered in the browser (`samestate.emulate` = `on`)
- The guided demo's **Device identity** step turns it on for that step without saving, and the user's own setting comes back at the end of the tour or when the tour is skipped (`restoreDeviceIdentity()`)
- Added `setDeviceIdentity(on, save)`, shared by the Views switch and the tour; it reloads the previews so pages read the new identity
- The README explains why it is off by default

---

## Summary
With identity on, a site whose server picks the layout still sends desktop pages, and its scripts can then show a phone a page the other screens do not get. On google.com in Japan, the iPhone showed an iPhone-only Gemini promo while the other screens showed the search page, so clicks had nothing to match there. Every screen now gets the same page unless the user asks for device identity.

---

## 1. Default and Switch
**Files:** `extension/app.js`, `extension/app.html`, `docs/app.js`, `docs/index.html`
**What:** `emulateDevices` starts as `localStorage.getItem('samestate.emulate') === 'on'`, and the checkbox is no longer checked in the markup. `setDeviceIdentity()` updates the setting, the checkbox and each preview's identity.
**Impact:** Users who turned the switch on keep it on. Everyone else sees previews with the browser's own identity, as before `fe49f5d`.

## 2. Guided Demo
**Files:** `extension/app.js`, `docs/app.js`
**What:** The step points at the switch, turns identity on with `save` false, waits for the previews to reload, then shows the phone-only banner. The last step and `endTour()` call `restoreDeviceIdentity()`, which reloads the previews only if the setting differs from the saved one.
**Impact:** The tour shows the feature without changing the user's setting.

---

## Testing
- Smoke test: 28 of 28 checks passed, starting from a fresh profile where identity is off
- Loaded the extension in a throwaway headless Chrome (DevTools `Extensions.loadUnpacked`): identity started off; with it on, every phone and tablet preview on google.com reported its own identity, and the iPhone was rendered differently from the other screens
- Real mouse clicks in the extension: **Products** on the sample site reached all 7 screens with identity off and on

---

## Files Changed (6 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | +29 −11 | Default, `setDeviceIdentity()`, tour step and restore |
| `extension/app.html` | +1 −1 | Switch unchecked |
| `docs/app.js`, `docs/index.html` | same | Copies |
| `README.md` | +2 −1 | Default and why, release note |
