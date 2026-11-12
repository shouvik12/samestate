# Preview themes

- Added a picker for named tweakcn presets that loads and applies the selected theme automatically.
- Added a Custom CSS option for CSS exports from the tweakcn editor.
- Added light, dark, and site-following palettes for a single preview, one comparison column, or all visible previews.
- Added optional recoloring for common elements and a Reset button for the selected previews.

---

## Summary

Preview a tweakcn theme at several viewport sizes or apply it to one comparison column to see it beside the original.

## 1. Load named presets and custom themes

**Files** `extension/themes.js`, `docs/themes.js`

**What changed** The picker includes 42 named presets from tweakcn's editor and adds names from its public registry. Selecting a preset loads its light and dark values from tweakcn. The Custom CSS option parses an export in a detached stylesheet. Both inputs go through the same literal color and radius validation. [tweakcn editor preset source](https://github.com/jnsahaj/tweakcn/blob/a3b47b37cba97dd637de517aab52c45ec0f83456/utils/theme-presets.ts)

**Impact** shadcn-based sites can use their existing theme variables. The basic recoloring option changes the background, text, links, buttons, and input borders on sites with hard-coded styles. Requests for named presets omit credentials and referrers.

## 2. Apply and reset per preview

**Files** `extension/app.html`, `extension/app.css`, `extension/app.js`, `extension/agent.js`, and the matching hosted demo assets

**What changed** The Theme drawer applies a named preset as soon as it loads, then updates it when the palette or recoloring setting changes. A newer selection takes precedence over any pending request. Each preview manages its own style, and Reset removes it.

**Impact** Compare devices, page steps, and websites independently. Themes live in the Samestate tab and follow a preview when it reloads or navigates within the same site.

---

## Testing

- Verified all 42 listed endpoints return their light and dark palettes.
- Loaded Modern Minimal and Violet Bloom directly from tweakcn in Chrome and checked automatic application, palette switching, and Reset on one comparison column.
- Checked that a slower request cannot replace a newer selection, a failed request preserves the current theme, and new registry names appear in the hosted picker.
- Checked theme targeting, literal color parsing, skipped imports, Reset, and same-site navigation in Chrome with an unpacked extension.
- Checked the hosted demo's palette controls, Page steps, and a single comparison preview in Chrome.

---

## Files changed

| Files | Approx. lines changed | Purpose |
|---|---:|---|
| `extension/themes.js`, `docs/themes.js` | +185 each | Preset registry, theme parsing, and style generation |
| `extension/app.js`, `docs/app.js` | +148 −10 each | Automatic application, targeting, and per-preview state |
| `extension/agent.js`, `docs/agent.js` | +19 −5 each | Applying and removing preview styles |
| `extension/app.html`, `docs/index.html` | +30 each | Theme drawer and preset picker |
| `extension/app.css`, `docs/app.css` | +9 each | Theme controls |
| `README.md` | +10 | Usage and release note |
| `changelogs/CHANGELOG-preview-themes.md` | +52 | Change and testing notes |
