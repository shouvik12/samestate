# Align Screens — Bring Linked Screens to the Same Page and Position

- Added an **Align screens** button to the left panel (`#alignall`), above "Detect differences"
- Align screens sends every linked screen to the page and scroll position of the leading screen (the one used last)
- Added a link toggle (chain icon, `data-a="link"`) to each screen's header; linked is the default
- An unlinked screen neither follows the other screens nor drives them, and Align screens skips it
- Added `state` and `align` messages to the agent: `state` reports `location.href` and `scrollState()`, `align` navigates within the same origin and then applies the scroll position
- A screen that has to load another page reports `aligning`; the app finishes the scroll once that screen says `hello` again
- Added `.dev.unlinked` styles: amber link icon and a slightly dimmed frame

---

## Summary
Navigation is not mirrored, so screens can end up on different pages or sections with no way back except repeating the steps on each one. Align screens fixes that in one click, and the link toggle lets the user choose which screens move together.

---

## 1. Align Screens
**Files:** `extension/app.js`, `extension/agent.js`, `extension/app.html`, `docs/app.js`, `docs/agent.js`, `docs/index.html`
**What:** `alignScreens()` asks the leading screen for its state (1.5 s timeout), then posts `align` with `navigate: true` to every other ready, linked screen. The agent navigates only if the target is on its own origin and the path or query differs; otherwise it calls `applyScroll()`. After a navigation, the app re-sends `align` with `navigate: false` 700 ms after the screen reconnects.
**Impact:** Screens stranded on a sign-in page or a different section rejoin the others. Scroll alignment uses the existing section matching, so it is as accurate as normal scroll sync on that site.

## 2. Link Toggle
**Files:** `extension/app.js`, `extension/app.css`, `docs/app.js`, `docs/app.css`
**What:** Each device has a `linked` flag. `handleMessage()` stops an unlinked screen's actions from being broadcast and leaves unlinked screens out of the recipients. The flag survives frame rebuilds.
**Impact:** One screen can be explored on its own while the rest stay in sync.

---

## Testing
- Syntax checks only; not yet confirmed in Chrome

---

## Files Changed (8 total)

Line counts are approximate; these changes are part of commit `f631c39`.

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | ≈ +40 −6 | `alignScreens()`, link flag, message cases |
| `extension/agent.js` | ≈ +10 −0 | `state` and `align` messages |
| `extension/app.html` | +2 −0 | Align screens button |
| `extension/app.css` | +1 −0 | Unlinked styles |
| `docs/app.js` | ≈ +40 −6 | Copy of `extension/app.js` |
| `docs/agent.js` | ≈ +10 −0 | Copy of `extension/agent.js` |
| `docs/index.html` | +2 −0 | Align screens button |
| `docs/app.css` | +1 −0 | Copy of `extension/app.css` |
