# Demo Voice Mute Only — The Button Reads Mute or Unmute, Nothing Else

- The demo's voice button only ever reads **Mute** or **Unmute**. The **Enable voice** and **Retry voice** states are gone.
- The voice is on by default. When the browser blocks sound before the visitor's first interaction, the button still reads Mute, and the first click or key press anywhere starts the narration (as before).
- Pressing **Mute** always mutes, also while the browser is still blocking sound; pressing **Unmute** turns the voice on and plays the current clip.
- A clip that fails to load no longer changes the button: the next click or key press loads it again and plays it, and the walkthrough never waits on it.
- Removed the intro's "Click anywhere to hear the narration" prompt.
- Screen readers still hear why there is no sound yet: the demo's status line says the narration starts with the first click or key press, or that the clip will try again.
- `tests/tour-voice.mjs` follows the new behaviour and the intro clip: 47 clips (46 steps and the intro), every MP3 file counted, Mute while blocked, the first click anywhere starting the voice, and a click retrying a failed clip.
- README: the narration paragraph no longer mentions Enable voice.

---

## Summary

The voice control is a plain Mute/Unmute toggle; everything about browser sound rules happens without extra buttons or prompts.

---

## 1. Button
**Files:** `extension/tour-voice.js`, `docs/tour-voice.js`
**What:** `render()` shows Mute or Unmute only; `button.onclick` toggles mute; `unlock()` also retries a failed clip, and the audio error handler arms it.
**Impact:** One control with one meaning.

## 2. Intro
**Files:** `extension/app.js`, `extension/app.html`, `docs/index.html`, `extension/app.css`
**What:** `#tour-intro-sound` and its styles are removed; the intro still restarts its time when its narration starts late.

---

## Testing
- `node tests/tour-voice.mjs`: 23/23; `node tests/tour-navigation.mjs`: 27/27; `node tests/smoke.mjs` also runs on the PR
