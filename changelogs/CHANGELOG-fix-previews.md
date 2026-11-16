# Fix Previews — Try the Suggested Fix on Every Screen

- Findings with a known CSS fix show the CSS (`FIX_CSS`) and a **Preview fix** button: page scrolls sideways, wide tables, cut-off text, small tap targets, small text, small field text, text at the screen edge, stretched images
- The fix is set as inline styles on that finding's elements in every affected preview (`fix` message, `applyFix()` in `agent.js`); **Undo fix** restores each element's `style` attribute
- Other findings show what to change in the site (`FIX_ADVICE`): lazy loading, `srcset`, `inert`, viewport tag and more
- A line above the report says how many fix previews are on, with **Check again** and **Undo all**
- Fixed: a table set to `display: block` with `overflow-x: auto` now counts as scrolling itself, so the wide-table issue becomes "Table needs sideways scrolling"

---

## Summary
From finding problems to fixing them: preview a fix on every device, check again, keep or undo.

---

## 1. Fix previews
**Files:** `extension/app.js`, `extension/agent.js`, `extension/app.css`, `docs/*`
**What:** `toggleFix()` posts `fix` or `unfix` with the finding's keys; the agent keeps the previous `style` attribute per element.
**Impact:** The fix is checked on every screen at once, and nothing changes in the site itself.

---

## Testing
- In the web demo (`docs/`, served locally) in the Browser pane: Preview fix on the wide table removed it and "Page scrolls sideways" on 4 phones; Undo all brought them back
- `node tests/smoke.mjs`: 34/34 checks passed, 0 page errors (6 new checks after the tour)
- Not run by hand in the installed extension; the extension path was run headless through `tools/samestate-ci.mjs`

---

## Files Changed (4 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | +60 | Fixes and advice |
| `extension/agent.js` | +22 | `applyFix()`, `removeFix()`, table scroller |
| `extension/app.css` | +5 | Styles |
| `docs/*` | same | Copies |
