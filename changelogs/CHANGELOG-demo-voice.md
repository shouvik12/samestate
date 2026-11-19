# Demo voice explainer — Natural AI narration for every step

- Add finished natural AI voice clips for all 46 demo explanations, plus a separate extension closing clip.
- Add **Mute / Unmute** beside **Pause**, with a saved browser preference and accessible labels.
- Synchronize narration with Pause/Resume, Previous/Next, direct jumps and Skip. Cancel the old clip when the step changes.
- Wait for the current explanation before advancing automatically or holding a manually selected step.
- Offer **Enable voice** when the browser blocks initial audio, and **Retry voice** for an audio error. A failed or stalled clip does not trap the visual demo.
- Keep the playback controls within the demo bar in all themes, including narrow windows.
- Bundle the audio and player in both builds. Playback needs no API key, synthesis service or recording panel.
- Add reproducible narration scripts, a build-only generator and browser acceptance checks.

---

## 1. Narration assets

**Files:** `extension/demo/narration/`, `docs/demo/narration/`, `tools/demo-narration.json`, `tools/build-demo-narration.py`.

**What:** Generate natural AI narration with Kokoro's stock `af_heart` voice. Store 47 MP3s and a title-based manifest containing the source captions, spoken text and durations. Normalize the clips to a consistent level. Each build has about 4.6 MB of narration; the model and build dependencies stay outside the app.

**Impact:** All 46 existing explanations have finished audio. Web and extension closing instructions use their own clip.

## 2. Playback controls and scene synchronization

**Files:** `extension/tour-voice.js`, `extension/app.js`, `extension/app.css`, `extension/app.html`, and their web-build counterparts.

**What:** Use one audio element with a mute button beside Pause. Remember mute locally, pause/resume at the current position, cancel on navigation/Skip/page exit, and wait for speech to finish before advancing. Handle browser autoplay rejection and media errors without unhandled promises. Keep controls accessible inside native tool dialogs and responsive at narrow widths. Update asset versions.

**Impact:** Narration follows the visible explanation and remains under the user's control.

## Verification

- **23/23 narration checks:** all 46 captions match; all 47 MP3s decode to audible audio and are identical between builds; real playback, autoplay blocking, mute persistence, Pause/Resume, automatic advancement, manual holds, rapid jumps, modal controls, Skip and error recovery pass.
- **27/27 carousel checks**, **16/16 cleanup checks** and **62/62 full demo/tool checks**, with zero page errors. Visual suites run muted; the narration suite tests actual media playback.
- **72/72 layout combinations:** all six themes, light/dark modes and widths from 320 to 1600px keep the voice controls inside the demo bar.
- Visually reviewed the rendered demo controls and checked script syntax and mirrored files. The installed extension was not separately loaded.

## Files changed

| Files | Change |
|-------|--------|
| `extension/demo/narration/`, `docs/demo/narration/` | Audio clips, generated manifest and provenance notes |
| `extension/tour-voice.js`, `docs/tour-voice.js` | Narration playback controller |
| `extension/app.js`, `docs/app.js` | Playback lifecycle and step timing |
| `extension/app.css`, `docs/app.css` | Responsive mute/playback controls |
| `extension/app.html`, `docs/index.html` | Mute button, narration status and script loading |
| `tools/demo-narration.json`, `tools/build-demo-narration.py` | Source scripts and repeatable clip generation |
| `tests/tour-voice.mjs` | Actual audio acceptance checks |
| `tests/smoke.mjs`, `tests/tour-navigation.mjs`, `tests/tour-cleanup.mjs` | Silent visual-suite setup |
| `README.md`, this changelog | Usage and verification |
