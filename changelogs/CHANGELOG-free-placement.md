# Free Placement — Drag Screens Anywhere on the Wall

- Screens can now be dragged by their title bar to any spot on the wall, for example a phone between two laptops
- Replaced the reorder-by-swap behaviour from `d14d868`, which could only change a screen's place in the automatic grid
- The first drag pins every screen where it currently is, then only the dragged screen moves
- Positions snap to a 10px grid and cannot go past the left or top edge; the wall grows so every screen can be scrolled to
- The screen being dragged comes to the front and gets a highlighted outline
- Clicking **Grid** or **Row** in the Mode section returns to the automatic layout
- A screen switched on after arranging is placed to the right of the others
- **Lock layout** / **Unlock layout** still fixes screens in place
- Switched from HTML drag-and-drop to pointer events with pointer capture, so the drag follows the pointer across other screens' pages
- Fixed: dragging a phone onto a laptop moved it in the column order, and the grid then reflowed it to an unpredictable place

---

## Summary
The previous version only swapped screens' order in a grid that flows in columns, so a screen could not be put at a chosen spot. Screens now move freely, so any layout can be built by hand, and the lock keeps it.

---

## 1. Free Placement
**Files:** `extension/app.js`, `docs/app.js`, `extension/app.css`, `docs/app.css`
**What:** Each device has `x` and `y`. `pinScreens()` reads every screen's current position relative to `#frames`, then adds `.free`, which makes `#frames` `position: relative` and each `.dev` `position: absolute` at `left: x; top: y`. `arrangeable(d)` handles `pointerdown`, `pointermove`, `pointerup` and `pointercancel` on the title bar with `setPointerCapture`. `dragTarget()` adds the pointer movement to the start position and snaps it; `wallSize()` and `fitWall()` size the wall to the furthest screen; `nextFreeSpot()` places newly enabled screens. While dragging, `.frames.arranging iframe` has `pointer-events: none`.
**Impact:** Any arrangement is possible, including overlapping screens. Previews never reload while being moved, because the iframes stay in place in the page and only their CSS position changes.

## 2. Returning to the Automatic Layout
**Files:** `extension/app.js`, `docs/app.js`
**What:** `unpinScreens()` clears every position and removes `.free`. The Mode buttons call it before switching to Grid or Row. Focus mode keeps the arrangement and shows the focused screen as before.
**Impact:** One click undoes a hand-made arrangement.

---

## Testing
- `dragTarget()`, `wallSize()` and `nextFreeSpot()` pass five cases in Node
- Ran the arrange code from `app.js` in Chrome against three stand-in screens with iframes, using real mouse drags:
  - moved a screen down the wall
  - dragged a screen and released it over another screen's page; it landed at the expected snapped position
  - placed the "phone" between the "laptop" and the "mac"
  - with the layout locked, a drag did not move anything; after unlocking, the label returned to "Lock layout"
  - a drag starting on a title-bar button did not move the screen
- Not yet confirmed inside the extension with real sites

---

## Files Changed (4 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | ≈ +80 −50 | Free placement replaces reordering |
| `extension/app.css` | +3 −2 | Free layout, drag styles |
| `docs/app.js` | ≈ +80 −50 | Copy of `extension/app.js` |
| `docs/app.css` | +3 −2 | Copy of `extension/app.css` |
