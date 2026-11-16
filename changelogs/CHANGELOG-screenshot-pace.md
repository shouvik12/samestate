# Screenshot Pace — Per Second or Seconds Apart, and a README Image of the Capture Drawer

- **Screenshots** in the Capture drawer now has a unit: **per second** (0.1–10) or **seconds apart** (0.1–3600). "One every 5 seconds" is `5` **seconds apart** instead of `0.2` per second, and slower paces than one every 10 seconds are possible
- Switching unit keeps the pace: 2 per second becomes 0.5 seconds apart, 5 seconds apart becomes 0.2 per second; the box's limits follow the unit
- A line under the pace says what it means in words, the same whichever unit is chosen, and updates as you type: "Takes 1 screenshot every 5 seconds", "Takes 2 screenshots every second". Status messages use the same words
- The unit is remembered (`samestate.shotUnit`) with the value
- `docs/media/screenshot-capture.png`: new README image of the Capture drawer while Auto screenshots saves into a folder, with four device previews
- `tools/readme-media.mjs`: records that image too (tab sharing accepted by `--auto-accept-this-tab-capture`, the folder is the browser's private storage named `samestate-captures`)
- README: **Capture the device wall** describes the unit and shows the image; smoke test checks the unit menu exists

---

## Summary
A screenshot every few seconds is now set directly in seconds. The README shows the capture options, which its other images (sidebar hidden) cannot.

---

## 1. Pace Unit
**Files:** `extension/capture.js`, `extension/app.html`, `extension/app.css` (and `docs/` copies), `tests/smoke.mjs`
**What:** `#shot-unit` next to `#shot-rate`. `shotInterval()` is `1000 / value` per second or `value * 1000` seconds apart; `shotPace()` words it from the interval ("1 screenshot every 5 seconds" above one second, "2 screenshots every second" below), for `#shot-hint` and the status messages; the hint updates on `input` and `change`. Changing the unit converts the value with `1 / value`, clamps it to the new unit's range and updates the box's `min`, `max`, `step` and title.
**Impact:** Both ways of thinking about the pace work without arithmetic.

## 2. README Image
**Files:** `tools/readme-media.mjs`, `docs/media/screenshot-capture.png`, `README.md`
**What:** A fourth capture at 1200×675 with the sidebar open: four devices (iPhone, Pixel, iPad, Desktop) so the wall fits, the zoom lowered until it does, and Auto screenshots running at 0.5 seconds apart for about 2.5 s before the screenshot.
**Impact:** The README shows the capture controls in use.

---

## Testing
- Headless Chrome, web demo: 2 per second switched to 0.5 seconds apart (max 3600); 5 seconds apart switched to 0.2 per second (max 10); the unit and value were saved
- The pace line for 5, 1, 0.5, 90 and 3 seconds apart and for 1, 2, 0.2 and 0.25 per second: "1 screenshot every 5 seconds", "…every second", "2 screenshots every second", "1 screenshot every 90 seconds", "…every 3 seconds", "…every second", "2 screenshots every second", "1 screenshot every 5 seconds", "…every 4 seconds"; a status while running: "1 screenshot every 1.5 seconds"
- "1.5 seconds apart" for about 6 s: 4 screenshots, 1.42, 1.48 and 1.52 s apart; status "one every 1.5 s"
- The drawer checked in the new image: the unit menu fits next to the box, in line with the frame-rate box
- `node tests/smoke.mjs`: 37/37 checks passed, 0 page errors (one earlier run failed once at Page steps, "Step 2 menu open: false", and passed on rerun; this change does not touch page steps)
