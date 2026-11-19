# Individual Help Icons — A Question Mark for Each App Feature

- Added small, always-visible question marks beside app buttons, fields, section headings, preview tools and report features.
- Clicking a question mark opens that control’s explanation and its existing natural voice playback.
- Kept the top-bar question mark and searchable help browser.
- Kept hover and ordinary focus quiet; explanations open only on explicit activation.
- Help clicks do not run commands, toggle settings, submit forms or move preview frames.
- Icons follow scrolling, resizing, dynamic content and native modal dialogs, and hide with clipped or hidden controls.
- Added keyboard navigation between help shortcuts, Enter/Space activation and focus return on Escape.
- Refreshed the demo video, narration cue, GIF, banner and screenshot gallery to show individual help icons.

---

## Summary

The top-bar help browser is now accompanied by a small contextual question mark for each app control or feature. All shortcuts reuse the curated explanations and bundled natural voice clips, without automatic hover popups.

---

## 1. Individual contextual shortcuts

**Files:** `extension/feature-help-icons.js`, `docs/feature-help-icons.js`, `extension/app.css`, `docs/app.css`, `extension/app.html`, `docs/index.html`

**What:** A separate shortcut layer positions real help buttons beside visible app controls. Controls and preview frames are never wrapped or reparented. Icons use the existing help catalog, account for scroll clipping and covered content, update after DOM and viewport changes, and move into the active native dialog. Small spacing adjustments keep icons clear of toolbar labels and capture-folder text. Existing Debug information markers are replaced visually by the clickable question marks. The new script and changed assets have updated cache versions in both builds.

**Impact:** Help is discoverable beside each feature, including disabled controls and dynamically generated findings, while the top-bar lookup remains available. Icons do not add width to button rows or interfere with form values and preview navigation.

## 2. Safe activation, voice and keyboard access

**Files:** `extension/feature-help.js`, `docs/feature-help.js`, `extension/feature-help-catalog.js`, `docs/feature-help-catalog.js`, `extension/feature-help-icons.js`, `docs/feature-help-icons.js`

**What:** Help activations are intercepted before app action handlers. The popover reads the original control’s catalog entry, retains availability notes, and returns focus to the activated question mark. The shortcut toolbar uses a single Tab stop with arrow-key navigation and explicit Enter/Space activation. Native popover invocation uses the help button as its source. Catalog resolution also recognizes shortcut buttons and retains curated metadata while removed dynamic controls are being cleaned up.

**Impact:** Reading or hearing help leaves the underlying button, menu, checkbox or modal form unchanged. Existing on-demand audio, F1/Escape and demo pause/resume handling continue to work. The same 474 finished voice clips cover the new shortcuts; field values and page content are not used for narration.

## 3. Demonstrations and coverage

**Files:** `tests/feature-help.mjs`, `promo/stage.js`, `promo/showcase.json`, `README.md`, `CONTRIBUTING.md`, the 14 `docs/media/` files below

**What:** Browser regression checks exercise individual shortcuts on ordinary and disabled buttons, sections, modal fields, search results, Debug items and generated findings. They verify unchanged actions and geometry, real narration, keyboard activation, clipping and responsive layouts. Visual assertions wait for browser paint cycles. The refreshed showcase clicks the Measure question mark, and its narrator explains question-mark voice help. README media URLs and user instructions now describe both local shortcuts and the global help browser.

**Impact:** The published app and GitHub demonstrations show the same explicit help flow.

---

## Testing

- `node tests/feature-help.mjs`: 53/53 checks passed, including all 474 decoded audio clips, unchanged actions/forms, keyboard access, modal dialogs, responsive layouts, private-field exclusions and demo coordination; zero page errors.
- `node tests/smoke.mjs`: 62/62 checks passed in 259 seconds, zero page errors.
- Eight real app scenes and nine screenshots recorded in headless Chrome without page exceptions; visually inspected contextual help and readable control labels.
- Updated H.264/AAC showcase decodes and lasts 30.000 seconds; the narrated help cue fits its four-second scene.
- Changed web/extension files match byte-for-byte. Syntax and whitespace checks passed before publication.

---

## Files Changed (30 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `README.md` | +18 −17 | Both help entry points, media URLs and release note |
| `CONTRIBUTING.md` | +1 | Help-module reference |
| `changelogs/CHANGELOG-contextual-help-icons.md` | +100 | Change documentation |
| `extension/feature-help-icons.js` | +95 | Visible contextual shortcuts |
| `docs/feature-help-icons.js` | +95 | Matching web shortcuts |
| `extension/feature-help.js` | +8 −8 | Original control, invoker and focus handling |
| `docs/feature-help.js` | +8 −8 | Matching interaction logic |
| `extension/feature-help-catalog.js` | +1 | Shortcut metadata resolution |
| `docs/feature-help-catalog.js` | +1 | Matching catalog resolution |
| `extension/app.css` | +10 | Shortcut styling and label spacing |
| `docs/app.css` | +10 | Matching styles |
| `extension/app.html` | +8 −7 | New script and cache versions |
| `docs/index.html` | +8 −7 | Matching web entry point |
| `tests/feature-help.mjs` | +25 −3 | Contextual-help interaction checks |
| `promo/stage.js` | +2 −2 | Demonstrate an individual question mark |
| `promo/showcase.json` | +1 −1 | Updated help narration and caption |
| `docs/media/samestate-banner.png` | binary | Updated banner |
| `docs/media/card.png` | binary | Updated link card |
| `docs/media/samestate-demo.gif` | binary | Updated animated showcase |
| `docs/media/samestate-promo.mp4` | binary | Updated narrated showcase |
| `docs/media/samestate-demo.mp4` | binary | Matching legacy video URL |
| `docs/media/screenshot-sync.png` | binary | Individual toolbar/preview icons |
| `docs/media/screenshot-report.png` | binary | Report-feature icons |
| `docs/media/screenshot-capture.png` | binary | Capture-control icons |
| `docs/media/screenshot-measure.png` | binary | Measurement-feature icons |
| `docs/media/screenshot-meta.png` | binary | Metadata-feature icons |
| `docs/media/screenshot-checks.png` | binary | Check/review icons |
| `docs/media/screenshot-voice-help.png` | binary | Contextual voice help |
| `docs/media/screenshot-tour.png` | binary | Demo-control icons |
| `docs/media/screenshot-theme.png` | binary | Icons in Clean Green |
