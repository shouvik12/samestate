# Screen Settings — One Device Two Ways

- **Views → Screen settings** (`#screen-settings`): Light and dark, Default and 200% text, or Portrait and landscape; every second screen on the wall gets the second setting
- Screen names show the setting ("Nexus 7 · Dark"); desktops are not labelled in Portrait and landscape
- Dark and light: `setVariant()` rewrites `prefers-color-scheme` in readable stylesheets (`CSSMediaRule`, `@import`, `link[media]`, `source[media]`) and sets `color-scheme`; everything is restored when the setting changes
- 200% text doubles the root font size, as a browser text size setting does for `rem` and `em`
- Portrait and landscape rotates every second touch screen and puts rotation back when the setting is turned off
- The help text says the settings apply to the device wall, not to **Compare sites** columns

---

## Summary
Compare light and dark, default and large text, or portrait and landscape side by side.

---

## 1. Settings
**Files:** `extension/app.js`, `extension/agent.js`, `extension/app.html`, `docs/index.html`
**What:** `screenSetting()` picks the setting from the screen's position among selected devices; `applyScreenSettings()` runs from `refreshViews()` and sends `variant` in `config`.
**Impact:** With **Same device on every screen**, one device shows both ways.

---

## Testing
- In Compare sites, the settings leave site columns unchanged, as the help text now says
- In the web demo (`docs/`, served locally) in the Browser pane: with an injected dark rule, the second screen's background became the dark value and the first stayed light, and both went back when turned off; 200% text gave 32px against 16px; Portrait and landscape rotated the Nexus 7
- Checked that an iframe does not inherit `color-scheme` from its embedder in Chrome 156, which is why stylesheets are rewritten
- `node tests/smoke.mjs`: 34/34 checks passed, 0 page errors (6 new checks after the tour)
- Not run by hand in the installed extension; the extension path was run headless through `tools/samestate-ci.mjs`

---

## Files Changed (4 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | +45 | `setVariant()` |
| `extension/app.js` | +40 | Settings, names, rotation |
| `extension/app.html` | +9 | Select and help |
| `docs/*` | same | Copies |
