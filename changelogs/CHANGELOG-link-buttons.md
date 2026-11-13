# Link Buttons — Mirror Clicks on Links the Page Handles as Buttons

- A click on a link is now mirrored like a button click when the page cancels the link's navigation and handles the click itself, for example to open a menu, a tab or a dialog
- Covers controls such as Google's apps button (`<a role="button">`), which previously opened on the clicked screen only
- Links that open a page are still shared by link sync, so a link is never both followed and clicked
- On the other screens the matching link is pressed with its navigation blocked, so it cannot open a page there even if that screen's page would let it
- `canMirrorClick(el, links)` accepts links when asked; the click description carries `link: true`, and `findTarget()` and `findTwin()` then consider links on the other screens
- The Sync log shows these as "click link"

---

## Summary
Samestate never mirrored clicks on links, and link sync only shares links that open a page. Links that sites use as buttons fell between the two, so clicking them changed one screen only. On google.com, the apps menu now opens on every screen.

---

## 1. Detecting a Link Used as a Button
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** In the click listener, a link that `canMirrorClick()` refuses is checked again with links allowed. After the page's own handlers have run (next task), the click is mirrored only if `event.defaultPrevented` is true.
**Impact:** A link that navigates is unaffected.

## 2. Pressing It on the Other Screens
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** `handlers.click()` adds a one-time `click` listener on the window that cancels the default action for the pressed link before calling `press()`.
**Impact:** The page's handlers still run, so its menu or dialog opens; navigation does not happen.

---

## Testing
- Real mouse clicks in the extension, loaded in a throwaway headless Chrome on google.com: before this change the apps button opened on the Desktop only; after it, on all 7 screens, with Phone and tablet identity off and on, and every screen stayed on google.com
- **Products** on the sample site still reached all 7 screens
- Smoke test: 28 of 28 checks passed; the sample site has no link used as a button, so the smoke test does not cover this path

---

## Files Changed (4 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | +13 −6 | Link buttons on the clicked and other screens |
| `docs/agent.js` | +13 −6 | Copy of `extension/agent.js` |
| `README.md` | +3 | Click sync note, release note |
