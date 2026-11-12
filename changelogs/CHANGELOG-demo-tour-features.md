# Demo Tour Features — Show Every New Feature in the Guided Demo

- Expanded the guided demo (**Demo** button and the live web demo) from 6 to 21 steps
- New steps cover twin control matching, the pointer styles, annotations, video playback sync, the screen link toggle and **Align screens**, free placement, per-preview scale and **Physical size**, **Grid** and **Lock layout**, the device catalog search, tweakcn themes, **Page steps**, **Compare sites**, and **Screenshot** / **Record**
- Each step outlines the control it describes with a pulsing ring (`.tour-spot`) and opens its sidebar drawer (`spotlight()`)
- Steps can now be `async` and wait for previews to connect (`until()`); the tour loop awaits each step's `run`
- The tour resets the wall when it starts: Compare sites and Page steps off, layout unlocked and unpinned, every screen linked, scale overrides cleared, device search emptied, sidebar shown
- The tour opens **Compare sites** itself, so `setSitesMode()` no longer ends the tour; clicking **Compare sites** or **Page steps** yourself still does
- The theme step loads tweakcn's Bubblegum preset and falls back to a bundled palette (`TOUR_THEME`) when tweakcn cannot be reached
- Added a day/night toggle to the sample site, drawn twice (desktop bar and mobile bar) with identical attributes, so twin matching has something to pair
- Added a "Two-minute tour" section with a silent 8-second looping video (`demo/tour.webm`, 148 KB) to the sample site for video playback sync
- Added dark styles (`html.dark`) to the sample site
- `agent.js`: the demo runner accepts `do: 'step'`, which sends `open-page` or `open-state` directly, because the tour's synthetic clicks are not trusted and Page steps ignores untrusted clicks
- `annotations.js`: the annotation controller now exposes `setTool()`, `draw()` and `note()`; the note dialog and the tour share `placeNote()`
- Tour progress dots shrink to fit 21 steps
- Spotlight pulse and the glide animation are turned off under `prefers-reduced-motion`

---

## Summary
The guided demo only showed the first release: click sync, scrolling and the difference report. It now walks through each feature added since then on the bundled Tidepool site, pointing at the control it uses.

---

## 1. Tour Steps
**Files:** `extension/app.js`, `docs/app.js`
**What:** `STEPS` gains 15 steps. Helper functions drive the real code paths: `setDeviceLink()` clicks a screen's chain button, `tourPlace()` pins the row and moves the iPhone between the Desktop and the MacBook, `searchDevices()` fills the device search, `tourTheme()` applies a preset through `changeTheme()`, `tourPageSteps()` / `tourStepLink()` build a three-step journey, and `tourCompare()` opens the overview and the pricing page in two columns. The last step returns to the device wall.
**Impact:** The tour is about 100 seconds long. **Skip demo** stops it at any step and leaves the wall as it is.

## 2. Spotlight
**Files:** `extension/app.js`, `extension/app.css`, `docs/app.js`, `docs/app.css`
**What:** `spotlight(spot)` takes a selector or a function, adds `.tour-spot` to the matches, opens the enclosing `details.sidebar-drawer`, and scrolls sidebar controls into view. `endTour()` clears it.
**Impact:** Viewers see where each feature lives, not only what it does.

## 3. Sample Site Additions
**Files:** `extension/demo/index.html`, `extension/demo/pricing.html`, `extension/demo/site.js`, `extension/demo/style.css`, `extension/demo/tour.webm`, and the copies in `docs/demo/`
**What:** Two `.mode-toggle` buttons with the same `aria-label`, `title` and classes sit in `.desk-only` and `.mob-only` wrappers; `setDark()` keeps both in sync and sets `aria-pressed`. A `<video muted loop playsinline>` section sits after the hero.
**Impact:** The difference report sees one more section and one more control on each device. The sync log names the toggle "click button", because adding it to `demoControls` would bypass twin matching.

## 4. Hooks for the Tour
**Files:** `extension/agent.js`, `extension/annotations.js`, `docs/agent.js`, `docs/annotations.js`
**What:** `runDemo()` handles `do: 'step'` only while Page steps is on and only in the bundled demo. `mountPreviewAnnotations()` returns `setTool`, `draw(tool, points)` and `note(point, text)`, with points as fractions of the preview.
**Impact:** No change for real sites or for manual annotation.

---

## Testing
- Ran the full tour in the web demo (`docs/`, served locally) in the desktop app's browser pane; no console errors
- Checked each step's result in the page: dark mode reached all 7 screens (Desktop and MacBook "matched"), video "Playing on 7/7", the unlinked iPhone stayed put and Align screens moved it, the iPhone landed between the Desktop and the MacBook and Grid restored the layout, Bubblegum loaded from tweakcn for 7 previews, Page steps produced Step 1, Step 2 (menu open) and Step 3 (`/demo/pricing.html`), Compare sites showed both pages with 7 devices each
- The bundled fallback palette parses (`buildPreviewTheme(TOUR_THEME, …)`), but the offline path was not exercised end to end
- Not yet run inside the Chrome extension

---

## Files Changed (18 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | ≈ +160 −15 | Tour steps and helpers |
| `extension/app.css` | +5 −1 | Spotlight, glide, dots |
| `extension/agent.js` | +5 −0 | `do: 'step'` in the demo runner |
| `extension/annotations.js` | ≈ +25 −20 | Controller API, `placeNote()` |
| `extension/demo/index.html` | +7 −0 | Toggles, video section |
| `extension/demo/pricing.html` | +2 −0 | Toggles |
| `extension/demo/site.js` | +4 −0 | `setDark()` |
| `extension/demo/style.css` | +12 −0 | Toggle, video, dark styles |
| `extension/demo/tour.webm` | new | Sample video |
| `docs/…` (9 files) | same | Copies of the files above |
| `README.md` | +2 −1 | Demo description, release note |
