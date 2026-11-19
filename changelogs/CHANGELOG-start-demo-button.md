# Start Demo Button — The Live Demo Starts With a Click, So It Is Heard

- The web demo no longer starts by itself on page load. It opens on the intro card (animated logo, name, tagline, purpose and chips) with a **Start demo** button, a quieter **Skip demo and explore**, and the note "46 narrated steps, with sound. Pause, mute or skip at any time."
- Browsers only play sound after a click or key press. Because the demo now starts with one, its narration is heard from the first word of the intro, with no blocked sound and no extra click.
- **Start demo** is focused on load, so Enter or Space starts it too. It runs the full intro (narration and progress bar) and then all 46 steps, as before.
- **Skip demo and explore** hides the card and leaves the app open on the sample site.
- The sample site loads behind the card while it waits, so both buttons respond at once.
- The **Demo** button in the toolbar and the Chrome extension are unchanged; both already start from a click.
- Automated runs keep starting the demo by themselves: a `?tour-pace=` (test suites) or `?media=` (README media) parameter skips the start screen.
- `tests/tour-voice.mjs` adds two checks under the browser's normal sound rules: the plain page shows Start demo and plays nothing, and pressing it plays the intro narration.
- README: the narration paragraph describes the start screen.
- Help entries with voice for the intro's controls: the intro heading, Skip intro (both from the intro change, which `tests/feature-help.mjs` had been failing on since), Start demo and Skip demo and explore. The help catalogue now has 478 entries.

---

## Summary

Opening the link and pressing Start demo is all it takes to hear the walkthrough.

---

## 1. Start screen
**Files:** `extension/app.html`, `docs/index.html`, `extension/app.css`, `extension/app.js`
**What:** `showStartScreen()` shows `#tour-intro` with a `waiting` class (Start block shown; progress bar and Skip intro hidden) and opens the sample site. `playIntro()` takes over the card from there without replaying its entrance. The intro's click-to-skip ignores clicks while waiting.

---

## Testing
- Fresh headless Chrome with normal autoplay rules, against the web demo served locally:
  - On load: start screen, Start demo focused, no tour, no audio, all 7 sample screens ready behind it
  - Start demo: the intro narration is playing 1.5 s later (no blocked state), the intro runs with its progress bar, then step 1 plays with its voice
  - Skip demo and explore: the app with the sample site, no tour
- Browser pane: the start screen's look
- `tests/tour-voice.mjs` 25/25, `tour-navigation` 27/27, `checks` 15/15, `outline` 23/23, `tour-cleanup` 16/16, `tool-search` 23/23, `feature-help` 55/55, `smoke` 62/62 (0 page errors)
