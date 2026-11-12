# Physical preview size

- Added a **Physical size** option to the preview scale dialog. Measure the reference line on your monitor to calibrate the display.
- Prefilled the iPhone 11 Pro display width and sized its outer outline using Apple’s published body dimensions. Other presets use the device display width you enter.
- Hid the simulated browser bars in Physical size mode so the webpage area fits the calibrated display rectangle.

---

## Summary

Match the real-world dimensions of a device on your monitor while retaining the CSS viewport used to test its page.

## 1. Monitor calibration and device dimensions

**Files** `extension/app.js`, `extension/app.html`, `extension/app.css`, `extension/devices.js`, `docs/app.js`, `docs/index.html`, `docs/app.css`, `docs/devices.js`

**What changed** Samestate derives CSS pixels per millimetre from the measured line. The preview uses that ratio and its device display width to set the transform. For the iPhone 11 Pro, the width is derived from Apple’s resolution and pixel density. The body dimensions size the bezel in portrait or landscape. [iPhone 11 Pro specifications](https://support.apple.com/en-us/111879)

**Impact** Calibrated previews can be compared against a real phone. The measurement is reused in the current tab. Changing monitors, Chrome zoom, or system display scaling calls for a new measurement.

---

## Testing

- Verified in Chrome that a test calibration of 160 CSS pixels to 40 mm produced a 285.6 × 576 CSS-pixel iPhone outline, corresponding to 71.4 × 144 mm, with the same 375 × 812 viewport.
- Verified landscape rotation, measured-width presets, input validation, and restoring Auto. The same iframe stayed mounted throughout.

---

## Files changed

| Files | Approx. lines changed | Purpose |
|---|---:|---|
| `extension/app.js`, `docs/app.js` | +40 −1 each | Calibration and preview sizing |
| `extension/app.html`, `docs/index.html` | +13 each | Calibration controls |
| `extension/app.css`, `docs/app.css` | +10 each | Calibration and physical frame styling |
| `extension/devices.js`, `docs/devices.js` | +5 −1 each | iPhone 11 Pro dimensions |
| `README.md` | +3 | Usage and release note |
| `changelogs/CHANGELOG-physical-preview-size.md` | +39 | Change and testing notes |
