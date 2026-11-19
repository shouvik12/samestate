# GitHub Demo Refresh — Zinc Theme and Current Features

- Replaced the GitHub banner and link-preview card with the current Zinc interface and narrated-demo messaging.
- Re-recorded the 30-second showcase from the current app, covering sync, measurements, metadata, combined checks, voiced help and the demo carousel.
- Added eight natural AI narration clips using the app’s Kokoro `af_heart` voice, timed to the scenes and mixed over quiet original music.
- Replaced both public MP4 filenames together and generated a 15-second silent GIF from the new showcase.
- Refreshed screenshots for logical sync, the difference report and capture settings.
- Added screenshots for measurements, metadata, pending human reviews, voiced feature search, demo navigation and Clean Green.
- Added prominent README links to the 46-step interactive demo and narrated video, expanded the gallery and versioned image URLs.
- Shared the headless Chrome capture harness and documented the media-generation commands.

---

## Summary

The GitHub README’s older blue media now matches Samestate’s Zinc dark interface and the features published during the past week. Screenshots and recordings come from the real web app; human review results remain pending.

---

## 1. Current video and narration

**Files:** `promo/showcase.json`, `promo/record.mjs`, `promo/stage.js`, `promo/voiceover.py`, `tools/media-browser.mjs`, `docs/media/samestate-promo.mp4`, `docs/media/samestate-demo.mp4`

**What:** Eight scenes are prepared before recording, then captured at native resolution and concatenated into a 30-second H.264/AAC video. Scene checks require real measurements and pending manual decisions. Narration is generated locally from the scene manifest, checked against its available time, normalized and mixed with music. Both public MP4 paths contain the same updated video.

**Impact:** Visitors see the current theme, practical inspection tools and voice controls, with narration available through ordinary browser video playback. No API key, voice model or build dependency is added to the app.

## 2. Current images and gallery

**Files:** `promo/banner.html`, `tools/readme-media.mjs`, `docs/media/samestate-banner.png`, `docs/media/card.png`, `docs/media/samestate-demo.gif`, `docs/media/screenshot-sync.png`, `docs/media/screenshot-report.png`, `docs/media/screenshot-capture.png`, `docs/media/screenshot-measure.png`, `docs/media/screenshot-meta.png`, `docs/media/screenshot-checks.png`, `docs/media/screenshot-voice-help.png`, `docs/media/screenshot-tour.png`, `docs/media/screenshot-theme.png`

**What:** Chrome captures actual app states for nine screenshots. A browser-rendered brand composition uses the fresh sync screenshot for the banner and link card. ffmpeg derives the 15-second silent animated preview from the narrated video. Media preparation uses a temporary browser profile and does not save interface changes to users’ browsers.

**Impact:** The gallery demonstrates measurements, metadata, grouped checks and pending human reviews, feature search and voice help, the 46-step carousel, optional Clean Green and current capture controls. Zinc remains the default dark theme.

## 3. Discoverability and reproduction

**Files:** `README.md`, `CONTRIBUTING.md`, `changelogs/CHANGELOG-github-demo-refresh.md`

**What:** README links go directly to the current interactive demo and browser-playable narrated video. Image URL versions refresh GitHub’s cached previews. The capture caption describes configured settings accurately. Contributor instructions document narration, recording, image generation and visual inspection.

**Impact:** Visitors can reach the voiced demos quickly, and maintainers can reproduce the media after future interface changes.

---

## Testing

- Headless Chrome captured all eight video scenes and nine screenshots from `docs/`, with no page exceptions.
- Confirmed actual element measurements, completed automated checks with manual review decisions pending, voice-help playback state and the demo’s Pause/Mute/navigation controls.
- Visually inspected the refreshed banner, screenshots and recorded scene captures; checked native readable device sizes and Zinc surfaces.
- Checked eight narration clips fit their scenes; the final MP4 decodes with H.264 video, AAC audio and a 30.000-second duration.
- `node tests/smoke.mjs`: 62/62 checks passed, zero page errors.
- `git diff --check` and JavaScript syntax checks passed.
- App runtime files and extension permissions are unchanged. Media tooling was exercised in Chrome; the optional portrait export was not re-recorded for this README refresh.

---

## Files Changed (24 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `README.md` | +24 −6 | Current demos, gallery and release note |
| `CONTRIBUTING.md` | +17 −2 | Media reproduction instructions |
| `changelogs/CHANGELOG-github-demo-refresh.md` | +90 | Change documentation |
| `promo/showcase.json` | +14 | Scene and narration manifest |
| `promo/record.mjs` | +35 −115 | Real scene recorder |
| `promo/stage.js` | +71 −330 | Current app scene preparation |
| `promo/voiceover.py` | +60 −183 | Natural narration and audio mix |
| `promo/banner.html` | +15 | Browser-rendered brand composition |
| `tools/media-browser.mjs` | +58 | Shared Chrome harness |
| `tools/readme-media.mjs` | +31 −138 | Screenshots, banner and GIF generation |
| `docs/media/samestate-banner.png` | binary | Zinc banner |
| `docs/media/card.png` | binary | Link-preview card |
| `docs/media/samestate-demo.gif` | binary | Current animated showcase |
| `docs/media/samestate-promo.mp4` | binary | Narrated 30-second showcase |
| `docs/media/samestate-demo.mp4` | binary | Updated legacy video URL |
| `docs/media/screenshot-sync.png` | binary | Current linked previews |
| `docs/media/screenshot-report.png` | binary | Current findings |
| `docs/media/screenshot-capture.png` | binary | Current capture settings |
| `docs/media/screenshot-measure.png` | binary | Element measurements |
| `docs/media/screenshot-meta.png` | binary | Metadata overview |
| `docs/media/screenshot-checks.png` | binary | Combined checks and reviews |
| `docs/media/screenshot-voice-help.png` | binary | Feature search and voice help |
| `docs/media/screenshot-tour.png` | binary | Narrated demo controls |
| `docs/media/screenshot-theme.png` | binary | Clean Green option |
