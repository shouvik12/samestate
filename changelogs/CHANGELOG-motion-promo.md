# Motion Promo — A 30-Second Video in a Motion-Graphics Style, Wide and Mobile

- New 30-second promo video in a motion-graphics style: big kinetic words on a light background, real app screenshots tilted in 3D, a camera that sweeps and pushes in, and a logo end card.
- Same music as before (`promo/music.py`, 128 BPM, 16 bars): every cut is on a bar line and every word on a beat. The drop at 3.75 s brings in the device wall; the final hit at 26.25 s brings in the logo.
- New words, spoken by the same Kokoro af_heart voice and shown on screen at the same moment: "One site. Every screen size. At once." · "Click once. Every device follows." · "See what breaks." · "Measure. Check. Preview. Capture." · "Guided, step by step, with voice." · "Find it. Fix it." · "Click. Compare. Ship." · "Samestate. Test every screen size at once."
- Scenes: a click on the phone ripples to the Desktop and iPad; a bar fills to 22 differences, then the camera pushes into the real report; four feature cards picked on the beat; screens floating around a voice waveform; a "Page scrolls sideways" issue that turns green when Preview fix is clicked, with the overflowing block snapping back inside the phone.
- Mobile version at 1080×1920 with the same timing, music and words: text wraps, the feature cards form a 2×2 grid, and the end card stacks the logo above the name.
- README: "Watch the 30s video" now opens the new video, with a link to the mobile version; the narrated app walkthrough stays available as its own video, and the GIF is unchanged.

---

## Summary

A short, beat-driven video that explains Samestate in eight words-first scenes, for wide and phone screens.

---

## 1. Animation
**Files:** `promo/motion.html`
**What:** `render(t)` draws any moment of the video from the time alone (no running animations), so frames are exact. `?portrait` switches to the 1080×1920 layout; `?play` previews it in real time with the soundtrack.

## 2. Words and soundtrack
**Files:** `promo/motion.json`, `promo/voiceover.py`
**What:** `motion.json` lists each line with its beat-aligned start and room. `voiceover.py --story promo/motion.json` builds `promo/out/motion-soundtrack.wav` over the unchanged music; without `--story` it builds the walkthrough soundtrack as before.

## 3. Rendering
**Files:** `promo/record-motion.mjs`, `tools/readme-media.mjs`
**What:** `node promo/record-motion.mjs [portrait]` renders 900 frames at 30 fps in headless Chrome and mixes the soundtrack (`--frames 30,90` writes stills for review). `readme-media.mjs` keeps the walkthrough as `samestate-demo.mp4` and the GIF, and copies the motion videos to `samestate-promo.mp4` and `samestate-promo-mobile.mp4`.

## 4. Media
**Files:** `docs/media/samestate-promo.mp4`, `docs/media/samestate-promo-mobile.mp4`, `README.md`
**What:** New videos; README links use the cache key `?v=20261120-motion`.

---

## Testing
- Every voice line fit its beat window (the builder checks each one)
- Both files are 30.0 s with H.264 video (1600×900 and 1080×1920, 30 fps) and AAC audio peaking at −1.9 dB
- Stills from every scene reviewed in both formats, including the cursor landing on Preview fix
