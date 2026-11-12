# Views and page steps

- Added a **Views** drawer with separate controls for device sizes and page steps.
- **Same device on every screen** applies one preset to the selected previews. **Different devices** restores their individual presets.
- **Page steps** starts with the page originally opened. Following a same-origin link or entering a same-origin page address adds a numbered preview beside the existing pages. Each preview can be closed independently.
- Supported controls such as **Sign in**, menu buttons and tabs also open a new step when the address stays the same. The earlier screen keeps its state.
- Changing the shared preset resizes the existing previews. Switching between the device wall and Page steps keeps both sets of previews open.

---

## Summary

Compare the same site at different viewport sizes or follow a journey across several previews at one shared size.

## 1. Shared device sizes and page steps

**Files** `extension/app.js`, `docs/app.js`, `extension/agent.js`, `docs/agent.js`, `extension/app.html`, `docs/index.html`, `extension/app.css`, `docs/app.css`, `extension/capture.js`, `docs/capture.js`

**What changed** The wall updates iframe sizes and frame styling in place. The preview agent sends eligible navigation destinations or structural descriptions of supported controls over its existing connection. The wall checks the origin before opening the next step. For same-page states, the new preview replays the controls used to reach that state. Form interactions and in-page section links continue in their current previews.

The extension and hosted demo share the view controls and rendering code. The hosted demo uses its bundled pages.

**Impact** You can keep earlier pages or supported states open while following the next interaction and resize the whole journey without reloading it.

---

## Testing

- Verified in Chrome that seven device previews switch between individual and shared sizes without replacing their frames.
- Verified that following links and entering a path adds steps, resizing preserves form state, and switching views keeps the open previews.
- Verified that the hosted demo opens its pricing page as a new step beside the original page.
- Verified that a sign-in button and a same-page dialog link open login in a new preview, and that a further disclosure keeps both earlier states intact.
- Verified that the hosted demo keeps the home screen, mobile menu, and sign-in dialog side by side. Form values and submissions stay in the preview where they are used.

---

## Files changed

| Files | Lines in the combined commit | Purpose |
|---|---:|---|
| `extension/app.js`, `docs/app.js` | +499 −139 each | View switching, frame sizing, and message routing |
| `extension/agent.js`, `docs/agent.js` | +168 −3 each | Navigation and same-page interactions |
| `extension/app.html`, `docs/index.html` | +147 −46 each | Views drawer |
| `extension/app.css`, `docs/app.css` | +85 −17 each | View settings and device frame styling |
| `extension/capture.js`, `docs/capture.js` | +169 each | Capture availability for visible previews |
| `README.md` | +66 −20 | Release notes and usage |
| `changelogs/CHANGELOG-page-views.md` | +47 | Change and testing notes |
