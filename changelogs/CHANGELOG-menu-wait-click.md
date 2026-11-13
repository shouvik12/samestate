# Menu Wait Click — Wait for Opening Menus Before Giving Up on a Mirrored Click

- A mirrored click whose control is not visible yet is retried up to 8 times, 150 ms apart, instead of failing at once
- Between tries, running animations in the preview are finished, because background frames may not advance them
- Fixes clicks on a control inside a menu or drawer that the previous mirrored click had only just started to open
- Changed in the `click` handler of `agent.js`

---

## Summary
Two clicks in a row, such as opening a menu and then choosing an item in it, could fail on other screens: the second click arrived while the menu was still animating open, so its item was not visible and the screen reported **no match** or **unreachable**. The second click now waits briefly for the menu.

---

## 1. Retry While a Menu Opens
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** `handlers.click()` calls `findTarget()` again up to 8 times when no visible control is found, sleeping 150 ms and calling `finish()` on every running animation with a finite end time before each try.
**Impact:** A click that genuinely has no match on a screen now takes up to about 1.2 seconds longer to be reported as missing in the Sync log.

---

## Testing
- Commit `cd8cceb` (2026-11-13 13:45:11 +05:30) shipped without a changelog; this file was added afterwards from the commit's diff
- The smoke test's click-sync steps pass with this change (merged state, 25 of 25 checks locally and on GitHub)

---

## Files Changed (2 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | +12 −1 | Retry and finish animations |
| `docs/agent.js` | +12 −1 | Copy of `extension/agent.js` |
