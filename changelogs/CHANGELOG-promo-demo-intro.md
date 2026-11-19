# Promo Demo Intro — The Video and GIF Open With the App's Intro

- The narrated 30-second video now opens with the app's own demo intro (the animated Samestate logo, name, tagline "One interaction, every device.", the purpose line and the three chips) instead of the separate "Every screen. One shared state." title card.
- The intro animates in when its scene's recording starts (`promo.act('intro')`), and its Skip intro button and the video's caption bar are hidden for that scene.
- Scene timing: the intro gets 4 seconds so its animation completes; the checks scene goes from 5 to 4 seconds; the video stays 30 seconds. The closing card is unchanged.
- New opening narration: "Same state. Test every screen size at once." (2.8 s), built with the same Kokoro af_heart voice; all eight lines fit their scenes.
- Re-recorded with `node promo/record.mjs landscape` and `node tools/readme-media.mjs`: the README GIF (15 s), both video copies, the nine screenshots, the banner and the link card.
- README media links use a new cache key (`?v=20261119-demo-intro`) so GitHub shows the new files.

---

## Summary

The video starts the way the live demo starts.

---

## 1. Opening scene
**Files:** `promo/stage.js`, `promo/showcase.json`
**What:** `prepare('intro')` shows `#tour-intro` over the device wall without the `playing` class (its card hidden until then); `act('intro')` sets `--intro-ms` to 4000 ms and starts it. The title card is only used for the closing scene now.

## 2. Media
**Files:** `docs/media/*` (GIF, MP4s, screenshots, banner, card), `README.md`
**What:** Regenerated from the new recording.

---

## Testing
- Frames from the new video at 0.3, 1.2, 2.5 and 3.8 s show the intro animating in and complete before the sync scene at 4 s; the shortened checks scene still reaches its results
- The GIF's first frames show the intro, then the sync scene; it lasts 15 s
- The soundtrack builder checked every narration line fits its scene
