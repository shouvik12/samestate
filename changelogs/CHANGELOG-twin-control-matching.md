# Twin Control Matching — Pair Controls a Site Renders Twice

- Added `signature()` in `agent.js`: three hashes per control (`id` from test ids, `label` from tag, type, role, classes, `aria-label`, `title` and `aria-controls`, `shape` from tag, type, role and classes)
- `describe()` now includes the signature with every mirrored click
- Added `findTwin()`: when the control at the same position is missing or hidden, picks the one visible control of the same kind with a matching signature
- `findTwin()` returns nothing when several controls match at a tier, so it never guesses between look-alikes
- Clicks now carry `aria-pressed`; a screen whose toggle is already in that state is skipped
- Fixed: a day/night toggle clicked on a phone did not reach the desktop screens when the site renders one copy in the desktop bar and another in the mobile bar

---

## Summary
Responsive sites often render the same control twice and hide one copy per screen size. The copies sit at different positions in the page, so position-based matching found the hidden copy and reported "unreachable". Matching now falls back to the control's attributes.

---

## 1. Signatures and Twin Lookup
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** `hash()` is a 32-bit FNV-1a hash, so only hashes travel between frames, not attribute text. `findTwin()` searches up to 400 visible, mirrorable controls of the same kind and tries the tiers in order: `id`, `label`, `shape`. `findTarget()` calls it after the position match fails, in both the plain and the Match visible text paths.
**Impact:** Duplicated header controls (theme toggle, language switcher, menu buttons) reach every screen. The sync log shows these as "matched".

## 2. Toggle State Check
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** `mirrorClick()` records `aria-pressed` after the click; the `click` handler returns `skip` when the target already has that value.
**Impact:** A screen that is already in day mode is not flipped back to night.

---

## Testing
- Ran the signature and twin lookup on the live `controlllm.ai` page: from the hidden theme toggle it found exactly one visible match, the visible theme toggle
- Not yet confirmed in Chrome: the click travelling from one screen to another inside the extension

---

## Files Changed (2 total)

Line counts are approximate; these changes are part of commit `f631c39`.

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | ≈ +44 −4 | `hash()`, `signature()`, `findTwin()`, pressed state |
| `docs/agent.js` | ≈ +44 −4 | Copy of `extension/agent.js` |
