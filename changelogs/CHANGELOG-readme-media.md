# README Media — Re-recorded from the Current Demo

- `docs/media/samestate-demo.gif`: the guided demo's first step (the Desktop clicks Products; every phone and tablet opens its menu first), 11 s at 10 fps, 960×540
- `docs/media/screenshot-sync.png`: the end of that step, all seven devices with Products open, now 1600×900
- `docs/media/screenshot-report.png`: the difference report on the pricing table, with the Accessibility and Network categories, 1600×900
- `docs/media/card.png`: the sync screenshot at 1200×675, the image link previews show for the live demo
- `tools/readme-media.mjs`: new script that records all four from `docs/` in headless Chrome
- CONTRIBUTING: the new script in the tools list

---

## Summary
The README's GIF and screenshots dated from November 12 and showed the old interface: no top-bar theme menu, day/night button or Compare sites, and none of the newer report categories. They now show the current demo. `samestate-banner.png` (November 14) is unchanged.

---

## 1. Capture Script
**Files:** `tools/readme-media.mjs`
**What:** Serves the repo, opens `docs/index.html` in headless Chrome at 1600×900, hides the sidebar and lowers the zoom until every device fits the wall. It records the guided demo's first step with `Page.startScreencast` until the step's `samestate-tour-step` event, then saves the last frame as the sync screenshot. ffmpeg turns the frames into the GIF (10 fps, 192-color palette) and scales the sync screenshot to `card.png`. For the report it closes the demo, removes the sample site's cookie banner, scrolls every device to the pricing table, runs `detect(true)` and opens the Differences panel.
**Impact:** `node tools/readme-media.mjs` refreshes the README images after an interface change.

---

## Testing
- Ran `node tools/readme-media.mjs`: 644 frames over 11.1 s for the GIF; the report showed 87 findings in 10 categories, including Accessibility 1 and Network 1
- Looked at the sync and report screenshots and at GIF frames at 2, 5, 8 and 10.5 s: all seven devices visible, the Click sync explanation, then each phone and tablet with its menu open and an "opened its menu first" badge
