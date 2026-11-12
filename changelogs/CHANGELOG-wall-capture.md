# Wall capture

- Added **Screenshot** to save the visible device wall as a PNG.
- Added **Record** and **Stop** to download a silent WebM recording of the wall.
- Screenshots taken during a recording reuse the same capture stream.
- Chrome crops the current tab to the wall before any image or video is saved.
- Added capture status messages and shared the controls with the web demo.

---

## Summary

Capture responsive layouts and interactions for bug reports or comparisons. The browser saves the files locally.

## 1. Screenshot

**Files** `extension/capture.js`, `extension/app.html`, `extension/app.css`, `docs/capture.js`, `docs/index.html`, `docs/app.css`

**What changed** Chrome prompts to share the current Samestate tab. Region Capture crops the stream to the wall, and Samestate downloads one frame as a PNG.

**Impact** Capture shows the portion of the wall visible at the current scroll position and zoom level.

## 2. Recording

**Files** `extension/capture.js`, `extension/app.html`, `extension/app.css`, `docs/capture.js`, `docs/index.html`, `docs/app.css`

**What changed** MediaRecorder records the cropped stream and saves a WebM when recording stops. Screenshot can take a frame from that stream.

**Impact** You can record an interaction across devices and take stills during the same session. The recording is silent.

---

## Testing

- In desktop Chrome, downloaded a PNG of the bundled wall and decoded the saved WebM in the browser.
- Verified that a screenshot taken during recording reused the active stream and that stopping released all capture tracks.
- Checked cancellation and rejection of a non-tab source. Neither case saved a file.
- JavaScript syntax and extension/demo asset parity.

---

## Files changed

| File | Change | Purpose |
|---|---:|---|
| `extension/capture.js` | +169 | Tab capture, image export, video recording |
| `extension/app.html` | +6 | Capture controls and status |
| `extension/app.css` | +5 | Capture control styling |
| `docs/capture.js` | +169 | Capture for the browser demo |
| `docs/index.html` | +6 | Demo capture controls and status |
| `docs/app.css` | +5 | Demo capture control styling |
| `README.md` | +10 −1 | Usage and release notes |
| `changelogs/CHANGELOG-wall-capture.md` | +53 | Change and testing notes |
