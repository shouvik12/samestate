# Promo Video — A Scripted 30-Second Promo Recorded From the Live Demo

- Added `promo/stage.js`: turns the real `docs/` web build into a window on a dark stage, with title and end cards, captions, a cursor and camera moves, and drives the app's own functions (click sync, dark mode, difference report, site comparison, themes, video, notes, reports) on the music's bar lines
- Added `promo/record.mjs`: serves the repo, opens `docs/index.html` in headless Chrome, runs the stage, captures frames with `Page.startScreencast`, and encodes 30 s H.264 + AAC with ffmpeg; `landscape` (1920x1080) or `portrait` (1080x1920)
- Added `promo/music.py`: a generated, royalty-free 128 BPM soundtrack (16 bars = 30 s) with a drop on bar 3 and an end hit on bar 15
- Added `promo/voiceover.py`: narration with Piper (local neural TTS) or macOS `say`, each line timed to its scene and sped up if it runs over, mixed over the music with ducking and loudness normalization
- `.gitignore` now ignores `promo/.venv/`, `promo/voices/` (the Piper voice is 114 MB, over GitHub's file limit) and `promo/out/` (rendered audio and video)
- `record.mjs` deletes its JPEG frame folder after encoding
- `music.py` creates its output folder, since `promo/out/` is no longer in git
- Fixed: `music.py` docstring pointed at `stage.html` instead of `stage.js`, and had a no-op line on the end chord

---

## Summary
A reproducible pipeline for the promo video: music, narration and a screen recording of the real web demo, cut to the same bar lines. The scripts are committed; the Python environment, voice model and rendered files stay local.

---

## 1. Stage and Recorder
**Files:** `promo/stage.js`, `promo/record.mjs`
**What:** `record.mjs` starts a static server on a random local port and a headless Chrome with a temporary profile, waits for `startTour`, injects `stage.js` with `window.PROMO_FORMAT`, calls `promo.prepare()` (four screens, sidebar hidden, largest zoom that fits, comparison columns preloaded) and then `promo.show()` while screencasting. Frames are held until the next one and encoded at 30 fps with `soundtrack.wav`, or `music.wav` when there is no narration.
**Impact:** The video shows the actual app rather than a mock-up, so it can be re-rendered after UI changes. It depends on globals in `docs/app.js` (`DEVICES`, `play`, `detect`, `showTab`, `setSitesMode`, `sitePanels` and others), so renaming those breaks the promo.

## 2. Soundtrack
**Files:** `promo/music.py`
**What:** Kick, clap, hats, supersaw pads, offbeat bass and an arp over Am–F–C–G, with sidechain pumping, risers and impacts, all synthesized with NumPy.
**Impact:** No licensed audio; the output is deterministic (seeded), so re-running gives the same file.

## 3. Narration
**Files:** `promo/voiceover.py`
**What:** Eleven lines, each with a start time and a deadline. Uses Piper from `promo/.venv` with `promo/voices/en_US-lessac-high.onnx` when present, otherwise `say` (with a check that the voice is installed). Music ducks by `DUCK_DB` (default 14 dB) under each line; the mix is normalized to −14 LUFS.
**Impact:** Optional; without it the video uses the music alone.

## 4. Ignore Rules
**Files:** `.gitignore`
**What:** `promo/.venv/`, `promo/voices/`, `promo/out/`. These were only excluded locally before, in `.git/info/exclude`.
**Impact:** Other clones won't commit the venv, the voice model or renders by accident.

---

## Testing
- Ran the full pipeline on macOS with Node 22, Chrome and Homebrew ffmpeg: `music.py` (output byte-identical to before the cleanup), `voiceover.py` with Piper (every line fits its scene), `record.mjs landscape` and `record.mjs portrait`
- Both videos are 30.0 s, H.264 + AAC, at 1920x1080 and 1080x1920; spot-checked frames from the landscape render
- The `say` fallback was not re-tested
- Doesn't touch `extension/` or `docs/`, so the smoke test is unaffected

---

## Files Changed (6 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `promo/stage.js` | +327 | New: stage, camera, captions, scene script |
| `promo/record.mjs` | +116 | New: headless Chrome recorder and encoder |
| `promo/music.py` | +236 | New: generated soundtrack |
| `promo/voiceover.py` | +195 | New: narration and mix |
| `.gitignore` | +4 | Ignore promo venv, voice and renders |
| `changelogs/CHANGELOG-promo-video.md` | new | This file |
