# Arrange Screens — Drag Screens to New Places and Lock the Layout

- Screens can be dragged by their title bar and dropped onto another screen to take its place
- Added a **Lock layout** / **Unlock layout** button (`#lock`) to the left panel; while locked, screens cannot be dragged
- The arrangement is kept for the session only: it survives opening another site, and resets when the Samestate tab is closed or reloaded
- Reordering uses the CSS `order` property on each `.dev`, so no iframe is moved in the page and no preview reloads
- While a drag is in progress the preview iframes ignore the pointer (`.frames.arranging iframe { pointer-events: none }`), so drops land on the wall and not inside a page
- The screen being dragged is dimmed and the drop target gets a dashed outline
- Dragging is off in focus mode, where only one screen is shown

---

## Summary
The wall showed screens in a fixed order. Users can now put the screens they compare most next to each other, and lock the result so it is not moved by accident.

---

## 1. Drag and Drop
**Files:** `extension/app.js`, `docs/app.js`, `extension/app.css`, `docs/app.css`
**What:** Each device has a `pos`. `arrangeable(d)` adds HTML drag-and-drop listeners: the title bar is the drag handle, every screen is a drop target. `moveScreen(list, moved, onto)` removes the moved screen from the order and inserts it at the target's index, then renumbers `pos`. `applyArrangement()` writes `pos` to `style.order`. Drags that start on a title-bar button are ignored.
**Impact:** Any screen can be moved to any place in grid or row mode. The difference report and the device list keep their own order.

## 2. Layout Lock
**Files:** `extension/app.js`, `extension/app.html`, `docs/app.js`, `docs/index.html`, `extension/app.css`, `docs/app.css`
**What:** `layoutLocked` turns the title bars' `draggable` attribute off and adds `.locked` to the wall, which removes the grab cursor. The button label and colour show the current state.
**Impact:** A locked wall cannot be rearranged until it is unlocked. The lock, like the arrangement, resets when the tab is reopened.

---

## Testing
- `moveScreen()` passes five reorder cases (forward, backward, first, last, onto itself) and keeps positions contiguous
- Not yet confirmed in Chrome: the drag gesture itself, including dragging across preview frames

---

## Files Changed (6 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | ≈ +58 −1 | `moveScreen()`, `arrangeable()`, lock |
| `extension/app.html` | +1 −0 | Lock layout button |
| `extension/app.css` | +3 −0 | Drag, drop-target and lock styles |
| `docs/app.js` | ≈ +58 −1 | Copy of `extension/app.js` |
| `docs/index.html` | +1 −0 | Lock layout button |
| `docs/app.css` | +3 −0 | Copy of `extension/app.css` |
