# Sidebar width fix — Keep text and controls inside their drawers

- Fixed: breakpoint action text and the “Add the width just below each one” checkbox label overflowing the sidebar.
- Fixed: long sidebar labels and button text now wrap within the available width; checkboxes remain aligned with the first line.
- Stack breakpoint action buttons and allow other action groups and capture settings to wrap when space is tight.
- Preserve full labels and allow long status text to break within the drawer.
- Update the stylesheet version in both builds so refreshing loads the fix.

---

## 1. Sidebar controls

**Files:** `extension/app.css`, `docs/app.css`, `extension/app.html`, `docs/index.html`.

**What:** Scope wrapping, minimum widths and maximum widths to sidebar controls. Let action groups wrap, give each breakpoint action a full row, and allow capture settings to use another line. The extension and web demo use identical styles and HTML, with a new CSS cache version.

**Impact:** Buttons, checkbox text and status messages fit the drawer without expanding its horizontal scroll area.

## Testing

- Verified the rendered sidebar at 800, 1024 and 1600px window widths, across all six interface themes in light and dark mode: **36/36 combinations** had no horizontal overflow or text/control boxes outside their drawers.
- Opened actual breakpoint previews with the button, then restored the previous device selection with “Back to my devices”.
- Visually reviewed the narrow sidebar in Chrome. Verified matching extension/web files and `git diff --check`.
- This CSS change was checked in the web build; the installed extension was not separately loaded.

## Files changed

| File | Change |
|------|--------|
| `extension/app.css`, `docs/app.css` | Scoped sidebar wrapping and sizing rules |
| `extension/app.html`, `docs/index.html` | Stylesheet cache version |
| `README.md` | Release note |
| `changelogs/CHANGELOG-sidebar-width.md` | Change details and verification |
