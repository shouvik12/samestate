# Preview annotations

- Added a pencil button to each device preview and single-site comparison preview.
- Added freehand drawing, straight lines, arrows, editable text notes, and an eraser.
- Annotations stay on their own preview as it moves or resizes. They remain visible when the tools are closed and appear in wall captures.

---

## Summary

Mark up a mobile, tablet, or desktop preview while keeping the other previews independent.

## 1. Preview tools and overlay

**Files** `extension/annotations.js`, `extension/app.js`, `extension/app.html`, `extension/app.css`, and the matching hosted demo assets

**What changed** Each iframe has an overlay for pointer input, rendered strokes, and text notes. Coordinates are relative to its visible viewport, so the marks follow the preview’s display scale. Closing the pencil tools lets pointer input reach the webpage again.

**Impact** You can leave separate notes and drawings on devices, page steps, and site comparison previews. Marks live in the current tab. Opening a different site in a comparison column clears its previous marks.

---

## Testing

- Verified freehand strokes, lines, arrows, note creation and editing, and erasing in Chrome.
- Verified that marks stay on the selected preview after changing scale, that page interaction is available when the tools are closed, and that the hosted single-site comparison has its own overlay.
- Inspected a Chrome PNG export and confirmed that the arrow appeared on the annotated phone preview.

---

## Files changed

| Files | Approx. lines changed | Purpose |
|---|---:|---|
| `extension/annotations.js`, `docs/annotations.js` | +213 each | Drawing tools, notes, and the eraser |
| `extension/app.js`, `docs/app.js` | +15 −1 each | Per-preview overlay and scaling |
| `extension/app.html`, `docs/index.html` | +13 each | Note editor and comparison controls |
| `extension/app.css`, `docs/app.css` | +19 −1 each | Annotation styling |
| `README.md` | +8 | Usage and release note |
| `changelogs/CHANGELOG-preview-annotations.md` | +40 | Change and testing notes |
