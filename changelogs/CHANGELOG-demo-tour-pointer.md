# Demo Tour Pointer — Show Each Action Where It Happens

- Added a demo pointer (`#tour-cursor`) that travels to each control, clicks it with a ripple, types into the device search, drags the iPhone by its title bar, and draws the annotation arrow
- The pointer is a white arrow, and becomes a fingertip circle while it is over a touch-screen preview
- The step message moved from the bottom bar to a callout (`#tour-callout`) placed beside the control it describes, with a corner pointing at it
- Added a focus ring (`#tour-ring`) around the control or preview a step is about; it replaces the `.tour-spot` outline and also works for controls inside a preview
- Each preview shows a short result label after a synced action: "clicked here" / "tapped here" on the leading screen, and "✓ same control", "✓ matched", "✓ opened its menu first", "▶ playing" and so on for the others (`tourBadge()`)
- The bottom bar now shows the step number, the feature name, progress, and a **Pause** / **Resume** button next to **Skip demo**
- Every step has a short title (`title`) and waits long enough to read its message before the pointer moves
- The wall scrolls to bring the screen being used into view, showing the whole screen where it fits (`tourReveal()`, `scrollWall()`)
- The difference report step now clicks the "Table is wider than its container" finding, which outlines the table in the iPhone preview
- The annotation step uses the real tools in order: ✎, **Arrow**, drag, **Note**, click
- `annotations.js`: `draw()` returns the mark so the tour can move its end point while drawing
- Fixed: the tour's smooth scrolling of the wall could be undone part-way by the wall's scroll guard, leaving the target off screen; the tour now scrolls the wall itself and records the final position

---

## Summary
The guided demo described each feature in a box at the bottom of the window while things happened elsewhere. It now shows a pointer performing each action, a ring on the control in use, the explanation next to it, and a label on every preview saying how it responded.

---

## 1. Pointer, Ring and Callout
**Files:** `extension/app.js`, `extension/app.css`, `extension/app.html`, `docs/app.js`, `docs/app.css`, `docs/index.html`
**What:** A step's `at` names its target: a selector or element of the Samestate page, `[screen, selector]` for an element inside a preview, or a function returning one. `tourRect()` turns a target into a rectangle, mapping preview elements through the frame's scale. `placeTour()` positions the ring and puts the callout on the first side with room (a step can name a preferred `side`), re-running on a timer so both follow scrolling and moving screens. `tourPoint()` and `tourClick()` move the pointer with `glide()`, which uses animation frames and falls back to a timer where frames do not run.
**Impact:** The three overlays ignore the mouse and sit above the page; the actions still go through the same code as real clicks.

## 2. Result Labels on Previews
**Files:** `extension/app.js`, `extension/app.css`, `docs/app.js`, `docs/app.css`
**What:** `startEntry()` and `addResult()` call `tourBadge()`, which adds a `.tour-badge` to the preview body for 3.2 seconds. It does nothing unless the tour is running.
**Impact:** Viewers see, on each screen, whether it used the same control, a matched twin, or had to open its menu first, without opening the Sync log.

## 3. Bar, Pause and Pacing
**Files:** `extension/app.js`, `extension/app.css`, `extension/app.html`, `docs/app.js`, `docs/app.css`, `docs/index.html`
**What:** `nap()` replaces `sleep()` inside the tour: it ends when the tour is skipped and holds while `tourPaused` is set. The reading pause before each action scales with the message length, up to 3 seconds.
**Impact:** The tour takes about two and a half minutes. Pause holds it between actions; an action already in progress finishes first.

---

## Testing
- Ran the full tour in the web demo (`docs/`, served locally) in a 1024 × 768 viewport and looked at every step; no console errors
- Checked Pause (step number held for 9 seconds, then advanced after Resume) and Skip (bar, callout, ring, pointer and labels all removed)
- Reduced-motion mode was not exercised
- Not yet run inside the Chrome extension

---

## Files Changed (9 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | ≈ +390 −150 | Tour engine and steps, result labels |
| `extension/app.css` | ≈ +35 −10 | Bar, callout, ring, pointer, labels |
| `extension/app.html` | +6 −3 | Tour markup |
| `extension/annotations.js` | +6 −1 | `draw()` returns the mark |
| `docs/app.js`, `docs/app.css`, `docs/annotations.js` | same | Copies |
| `docs/index.html` | +6 −3 | Tour markup |
| `README.md` | +2 −1 | Demo description, release note |
