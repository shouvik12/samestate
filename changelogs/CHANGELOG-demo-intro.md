# Demo Intro — Logo and Purpose Before the First Step

- The guided demo now opens with an intro card: the Samestate logo (its three device outlines, drawn large and animated in), the name, the tagline "One interaction, every device.", one sentence on what it is for, and three chips: Logical sync, Difference report, Debug tools.
- The intro lasts as long as its narration, held between 5 and 7 seconds (7 s with the current clip), with a progress bar; it plays while the sample site loads behind it, so the demo is not longer by the full intro.
- New narration clip `demo/narration/intro.mp3` ("Same state. Test your site on every screen size at once. Click once, every device follows. See what breaks."), built with the same Kokoro voice as the other 46 clips; `tools/demo-narration.json` adds it with `key: "intro"` and `tools/build-demo-narration.py` counts it apart from the 46 steps.
- **Skip intro**, a click on the intro, **Next →** or the right arrow end the intro and start step 1; **Skip demo** ends both; **Mute** silences the intro like any step; Pause holds it.
- The intro shows only when the demo starts from the beginning, not when jumping to a step or stepping through by hand.
- The demo bar (Skip demo, Pause, Mute, Next) stays above the intro.
- Reduced motion: no animation, the card shows at once.
- Both builds (`extension/`, `docs/`) and the cache versions of `app.js`, `app.css` and the narration manifest are updated.
- Fixed during testing: Next during the intro jumped to step 2; it now starts step 1.

---

## Summary

The demo begins by saying what Samestate is for before showing how it works.

---

## 1. Intro card
**Files:** `extension/app.html`, `docs/index.html`, `extension/app.css`
**What:** `#tour-intro` sits under the demo bar (z-index 53 under 54) and uses the theme's tokens, so it follows every interface theme in day and night mode. Its animations are staggered (logo, name, tagline, purpose, chips) and its progress bar runs for `--intro-ms`.
**Impact:** A first-time visitor sees the name and the purpose before the walkthrough starts.

## 2. Timing
**Files:** `extension/app.js`
**What:** `playIntro()` starts with the demo, alongside opening the sample site; `startTour()` waits for both before step 1. It ends on time, on Skip intro, on a click, on Next or the right arrow (`introShowing()`), on a step jump (`showTourLoading()`) or when the demo ends (`endTour()`). The guided-demo pace (`?tour-pace`) shortens it too.
**Impact:** 5–7 seconds, never in the way of someone who wants to move on.

## 3. Narration
**Files:** `tools/demo-narration.json`, `tools/build-demo-narration.py`, `extension/demo/narration/` and `docs/demo/narration/` (`intro.mp3`, `manifest.js`)
**What:** Built with `--reuse-existing`, so the 46 step clips were kept and only the intro was generated (7.1 s including the clip's leading and trailing silence).

---

## Testing
- Web demo served locally, in the Browser pane: on page load and from the Demo button the intro shows for 7 s with the full narration, fades, and step 1 (Click sync) starts with its own clip
- Skip intro ends it within 0.1 s and stops its audio; Next and the right arrow start step 1; Skip demo hides the intro and the bar and stops the audio; Mute silences it and the intro carries on
- Checked in night and day mode
- `node tests/smoke.mjs`: 62/62 checks passed, 0 page errors (the guided demo plays through the intro at the smoke test's pace)
