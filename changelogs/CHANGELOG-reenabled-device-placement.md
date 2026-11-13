# Re-enabled Device Placement — Place Re-enabled Devices Next to the Visible Ones

- A device switched back on in **Devices** forgets its earlier dragged position and is placed next to the screens already showing
- When it is the first screen on an otherwise empty wall, the wall scrolls back to the top-left corner
- Changed in `selectDevice()` in `app.js`

---

## Summary
With free placement on, a device turned off and on again went back to its old spot, which could be far to the right of the screens still showing, or off screen on an empty wall. It now joins the others.

---

## 1. Placement on Re-enable
**Files:** `extension/app.js`, `docs/app.js`
**What:** `selectDevice()` clears `d.x` and `d.y` when a device is selected, so `placeScreens()` puts it at the next free spot. If no screens were showing, it resets the wall's scroll position and updates the bottom scrollbar.
**Impact:** Screens that stay on keep their positions. **Saved workspaces** set positions directly rather than through `selectDevice()`, so reopening a workspace still restores dragged positions.

---

## Testing
- Commit `e0f8262` (2026-11-13 14:54:27 +05:30) shipped without a changelog; this file was added afterwards from the commit's diff
- The smoke test's workspace check (which selects devices with `selectDevice()` and reopens a saved layout) passes with this change

---

## Files Changed (2 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | +5 −0 | Reset position, scroll an empty wall |
| `docs/app.js` | +5 −0 | Copy of `extension/app.js` |
