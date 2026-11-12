# Demo Sandbox — Stop the Sandbox Warning on the Bundled Demo

- The bundled demo frame is now created without a `sandbox` attribute (`d.iframe.removeAttribute('sandbox')` in `buildFrames()`)
- Frames for real sites keep `sandbox` and `credentialless`
- Fixed: Chrome logged "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing" for `demo/index.html` on the extension's Errors page

---

## Summary
The demo page is part of the extension and shares the Samestate tab's origin. A sandbox that allows both scripts and same-origin access cannot isolate a same-origin page, so it gave no protection there and only produced a warning.

---

## 1. Demo Frame Without Sandbox
**Files:** `extension/app.js`, `docs/app.js`
**What:** In `buildFrames()`, when the target is the extension's own origin, the `sandbox` attribute is removed before `src` is set. Otherwise the frame is marked `credentialless` and keeps its sandbox.
**Impact:** The warning no longer appears. Previews of real sites are unchanged: they are a different origin, where the sandbox still stops the page from navigating the Samestate tab.

---

## Testing
- Syntax checks only; not yet confirmed in Chrome

---

## Files Changed (2 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | +3 −0 | Sandbox removed for the demo frame |
| `docs/app.js` | +3 −0 | Copy of `extension/app.js` |
