# Open Drawer Reachable — Treat Items Further Down an Open Drawer as Reachable

- `visible()` in `agent.js` now judges a fixed-position ancestor by the ancestor's own position: only a drawer pushed outside the viewport hides its contents
- An item further down an open drawer, below the bottom of the screen, is now treated as reachable rather than hidden
- A mirrored click scrolls its target into view (`scrollIntoView({ block: 'nearest' })`) before pressing it
- Fixed: on short screens, mirrored clicks on items low in an open mobile menu reported **unreachable**

---

## Summary
An open drawer that is taller than the screen scrolls, so its lower items are reachable. The visibility check treated any item outside the viewport inside a fixed element as part of an off-canvas drawer, so those items were skipped. It now checks whether the drawer itself is off screen.

---

## 1. Drawer Position Instead of Item Position
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** For a `position: fixed` ancestor, `visible()` returns false when that ancestor's rectangle is outside the viewport, or when the element itself is the fixed element and is outside it. An item inside an on-screen drawer is no longer rejected for its own position.
**Impact:** Click matching and the difference report both use `visible()`, so items low in an open menu now count as visible in both.

## 2. Scroll Before Pressing
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** `handlers.click()` scrolls the matched control into view before `flash()` and `press()`.
**Impact:** The flash and the click happen where the user can see them.

---

## Testing
- Commit `a1a7e76` (2026-11-13 13:47:24 +05:30) shipped without a changelog; this file was added afterwards from the commit's diff
- The smoke test passes with this change (merged state, 25 of 25 checks locally and on GitHub); the finding count on GitHub's runner was 77

---

## Files Changed (2 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | +8 −1 | `visible()`, scroll before click |
| `docs/agent.js` | +8 −1 | Copy of `extension/agent.js` |
