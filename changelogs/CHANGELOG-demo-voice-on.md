# Demo Voice On — Narration Starts With the First Click or Key Press

- The demo narration is on by default, but browsers block sound until a visitor clicks or presses a key, and the web demo starts by itself, so the intro and first steps were silent with an "Enable voice" button.
- Now the first click, tap or key press anywhere on the page starts the current narration clip from the beginning (`unlock()` / `armUnlock()` in `tour-voice.js`). Shift, Control, Alt, Meta, Escape and Caps Lock are ignored, as browsers don't count them as permission to play.
- During the intro, that first click turns the sound on instead of skipping the intro, and the intro restarts its 7 seconds (and its progress bar) so the whole narration is heard; later clicks still skip it.
- While the browser blocks the sound, the intro shows a prompt: "Click anywhere to hear the narration".
- Pressing **Enable voice** still works as before: it turns the voice on and does not mute.
- A visitor who pressed **Mute** before stays muted; that choice is still remembered.
- The Chrome extension's demo starts from a click on Demo, so its narration already played; it is unchanged.

---

## Summary

The demo is heard from the first interaction, with the intro included.

---

## 1. Unlocking sound
**Files:** `extension/tour-voice.js`, `docs/tour-voice.js`
**What:** When `play()` is refused with `NotAllowedError`, trusted `pointerdown`, `keydown` and `touchend` listeners are armed once; the first one plays the current clip. If the browser still refuses, they are armed again. `get()` reports `unlockedAt`.
**Impact:** No need to find the Enable voice button.

## 2. Intro
**Files:** `extension/app.js`, `extension/app.html`, `docs/index.html`, `extension/app.css`
**What:** `playIntro()` shows `#tour-intro-sound` while the voice is blocked and extends its end time when the intro clip starts late; the intro's click handler ignores the click that turned sound on.

---

## Testing
- Fresh headless Chrome with the normal autoplay rules (no autoplay flag), against the web demo served locally:
  - On load: intro shown, voice blocked, prompt shown, button "Enable voice"
  - Click on the intro: intro stays, its narration plays for the full 7 s, then step 1 plays with sound
  - Key press "a": same; Shift alone does not count (browser rule) and the next key does
  - Pressing Enable voice: narration plays and the button reads Mute, not muted
- Browser pane: the prompt shown under the chips
- `node tests/smoke.mjs`: 62/62 checks passed, 0 page errors
