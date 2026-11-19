# Top-Bar Help Icon — Explanations Only When Requested

- Added a small question-mark icon beside Search tools in the top toolbar.
- Clicking the icon opens a searchable browser of feature, button and section explanations.
- Selecting an explanation shows its description and natural voice control without running the underlying tool.
- Removed automatic help popups on hover, keyboard focus and long press.
- Kept explicit F1 help, Escape dismissal, voice controls and demo narration coordination.
- Added a natural voice explanation for the help icon, bringing the catalog to 474 entries.
- Added optional voice-build caching that preserves clips with matching voice, speed and spoken text.
- Updated both app builds, README guidance and the GitHub demo media to show the new help entry point.

---

## Summary

Detailed explanations now open from a single small icon in the top bar. Normal pointer movement and keyboard focus no longer summon a help card beside each control.

---

## 1. A single explicit help entry point

**Files:** `extension/app.html`, `docs/index.html`, `extension/app.css`, `docs/app.css`, `extension/feature-help.js`, `docs/feature-help.js`

**What:** The toolbar’s question-mark button opens a non-modal searchable help popover. Search covers the curated explanation catalog; choosing a result updates the description and Hear explanation control. Selecting help does not activate the described tool. The icon toggles the panel, Escape returns focus, and outside clicks dismiss it. F1 still provides contextual help for a focused control. Automatic hover, focus and long-press listeners were removed.

**Impact:** Users can consult help when they need it while keeping ordinary app interactions quiet. The popover stays within narrow windows and shares the existing voice player and demo pause/resume handling.

## 2. Natural voice coverage and reusable builds

**Files:** `extension/feature-help-catalog.js`, `docs/feature-help-catalog.js`, `tools/feature-help.json`, `tools/build-demo-narration.py`, `extension/help/narration/manifest.js`, `docs/help/narration/manifest.js`, `extension/help/narration/help-f9463b728bb99f.mp3`, `docs/help/narration/help-f9463b728bb99f.mp3`

**What:** Added the help icon’s description and a finished Kokoro `af_heart` voice clip. `--reuse-existing` checks voice, speed, filename and spoken text against the previous manifest before reusing a clip. Existing help audio is preserved; the new manifest includes all 474 explanations.

**Impact:** The new control has the same natural guidance as the rest of the app, and future narration updates can generate just changed clips. Models and build dependencies remain outside the shipped app.

## 3. Documentation, media and regression coverage

**Files:** `README.md`, `tests/feature-help.mjs`, `promo/stage.js`, all 14 refreshed files under `docs/media/` listed below

**What:** README instructions describe the top-bar icon instead of hover or long press. The real-app showcase and screenshots show the icon and searchable help, with refreshed media URL versions. Browser checks cover quiet hover/focus, explicit opening, search, empty results, selection without tool activation, actual narration, closing, ordinary controls and narrow window sizes.

**Impact:** The published demo and GitHub gallery demonstrate the same help flow available in the app.

---

## Testing

- `node tests/feature-help.mjs`: 41/41 checks passed, including 474 decoded voice clips, no page errors, keyboard controls, modal dialogs, privacy exclusions, demo coordination and responsive layouts.
- Reused all existing help clips and generated only the new help-icon voice clip.
- Exercised the default 46-step narration build with cached clips in an isolated copy, including the extension-specific closing narration.
- Recorded all eight showcase scenes and captured nine screenshots in headless Chrome without page exceptions; visually inspected the new top-bar help view.
- `node tests/smoke.mjs`: 62/62 checks passed in 249 seconds, zero page errors.
- JavaScript/Python syntax checks, web/extension file parity and `git diff --check` passed.

---

## Files Changed (32 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `README.md` | +14 −13 | Help instructions, media URLs and release note |
| `changelogs/CHANGELOG-topbar-help-icon.md` | +100 | Change documentation |
| `extension/app.html` | +8 −7 | Toolbar icon and cache versions |
| `docs/index.html` | +8 −7 | Matching web entry point |
| `extension/app.css` | +11 | Compact icon and help-browser styling |
| `docs/app.css` | +11 | Matching styles |
| `extension/feature-help.js` | +35 −35 | Explicit help browser and quiet controls |
| `docs/feature-help.js` | +35 −35 | Matching interaction logic |
| `extension/feature-help-catalog.js` | +1 | Help-icon explanation |
| `docs/feature-help-catalog.js` | +1 | Matching explanation |
| `extension/help/narration/manifest.js` | +10 −1 | Complete updated voice manifest |
| `docs/help/narration/manifest.js` | +10 −1 | Matching voice manifest |
| `extension/help/narration/help-f9463b728bb99f.mp3` | binary | New natural voice clip |
| `docs/help/narration/help-f9463b728bb99f.mp3` | binary | Matching web voice clip |
| `tools/feature-help.json` | +6 | New narration source |
| `tools/build-demo-narration.py` | +15 −1 | Optional validated clip reuse |
| `tests/feature-help.mjs` | +24 −7 | Explicit-help regression checks |
| `promo/stage.js` | +3 −3 | Capture the new help flow |
| `docs/media/samestate-banner.png` | binary | Current header in banner |
| `docs/media/card.png` | binary | Current link card |
| `docs/media/samestate-demo.gif` | binary | Current animated showcase |
| `docs/media/samestate-promo.mp4` | binary | Current narrated showcase |
| `docs/media/samestate-demo.mp4` | binary | Matching legacy video URL |
| `docs/media/screenshot-sync.png` | binary | Current toolbar |
| `docs/media/screenshot-report.png` | binary | Current toolbar and report |
| `docs/media/screenshot-capture.png` | binary | Current toolbar and capture |
| `docs/media/screenshot-measure.png` | binary | Current toolbar and measurements |
| `docs/media/screenshot-meta.png` | binary | Current toolbar and metadata |
| `docs/media/screenshot-checks.png` | binary | Current toolbar and checks |
| `docs/media/screenshot-voice-help.png` | binary | Top-bar searchable voice help |
| `docs/media/screenshot-tour.png` | binary | Current toolbar and demo |
| `docs/media/screenshot-theme.png` | binary | Current toolbar in Clean Green |
