# Hamburger Reveal — Open the Menu When a Mirrored Control Is Hidden Behind It

- When a mirrored click finds no visible control, the agent opens the page's closed menu button and looks again, for real sites as well as the sample site
- Added `menuToggle()` in `agent.js`: finds a visible, closed button whose label, title, id, classes, `aria-controls` or short text mention menu, nav, navigation, hamburger or burger, preferring one with `aria-haspopup`, then one with `aria-expanded="false"`
- After opening the menu it retries up to 6 times, 150 ms apart, finishing running animations between tries; a control found this way is reported as **revealed** in the Sync log
- If the control is still missing, the menu is closed again
- Moved the animation-finishing loop into `finishAnimations()`, shared with the wait added in `cd8cceb`
- The sample site keeps its own reveal rule (`demoControls`), so this path does not run there

---

## Summary
A desktop nav item clicked on the Desktop often lives in the hamburger menu on tablets and phones. Matching used to stop at "hidden" on those screens unless the site was the bundled sample. Samestate now opens the menu on those screens to reach the control.

---

## 1. Finding the Menu Button
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** `menuToggle()` checks up to 300 visible buttons, `[role=button]` elements, links with `aria-controls` and elements with `aria-expanded`, skipping any already expanded, and matches their text and attributes against menu words.
**Impact:** Works with common hamburger markup without site-specific selectors. A page with no recognisable menu button behaves as before.

## 2. Opening, Retrying and Closing
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** In `handlers.click()`, after the wait for opening menus, the agent presses the menu button, retries `findTarget()`, and marks a hit as `revealed`. Without a hit it presses the button again to close the menu.
**Impact:** Up to about 0.9 seconds more before a screen reports a click as missing. `0e8cbad` later limits this to navigation controls and makes closing more reliable.

---

## Testing
- Commit `eda2e33` (2026-11-13 14:32:04 +05:30) shipped without a changelog; this file was added afterwards from the commit's diff
- The smoke test passes with this change (merged state, 25 of 25 checks), but it runs the sample site, where this path is skipped

---

## Files Changed (2 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | +34 −4 | `menuToggle()`, `finishAnimations()`, reveal and retry |
| `docs/agent.js` | +34 −4 | Copy of `extension/agent.js` |
