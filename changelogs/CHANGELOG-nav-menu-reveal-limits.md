# Nav Menu Reveal Limits — Only Open the Menu for Navigation Controls, and Close It Reliably

- Mirrored clicks now record whether the control sits in the site's navigation (`nav`, `header`, `[role=navigation]`, `[role=menubar]` or `[role=menu]`), as `nav: true` in the click description
- The hamburger reveal from `eda2e33` only runs for navigation controls, so a missing button in the page body no longer opens the menu on other screens
- Added `closeMenu()`: after a failed reveal it presses the menu button if still reachable, otherwise a visible close button, otherwise sends Escape
- Fixed: a menu opened during a failed reveal could stay open, because the open drawer usually covers its own hamburger button

---

## Summary
The menu reveal ran for any missing control and could leave a drawer open over the page. It now runs only for controls that come from the site's navigation, and it closes the menu by whichever way is available.

---

## 1. Navigation Flag
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** `describe()` adds `nav: true` when the clicked element is inside a navigation container. `handlers.click()` requires `m.d.nav` before calling `menuToggle()`.
**Impact:** Fewer unnecessary menu openings on screens where a body control is simply missing.

## 2. Reliable Close
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** `closeMenu(toggle)` presses `toggle` when it is still connected and visible; otherwise the first visible button or `[role=button]` whose label, title, classes or short text mention "close"; otherwise dispatches `keydown` and `keyup` for Escape on the document.
**Impact:** Screens return to their previous state after a click that could not be matched.

---

## Testing
- Commit `0e8cbad` (2026-11-13 15:07:16 +05:30) shipped without a changelog; this file was added afterwards from the commit's diff
- The smoke test passes with this change (merged state, 25 of 25 checks locally and on GitHub), but the reveal path is skipped on the sample site

---

## Files Changed (2 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | +16 −3 | `nav` flag, `closeMenu()` |
| `docs/agent.js` | +16 −3 | Copy of `extension/agent.js` |
