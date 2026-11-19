# Voiced feature help — Tooltips throughout Samestate

- Add descriptive help for app buttons, settings, section headings, dialogs and preview tools.
- Bundle 473 natural AI voice explanations using the guided demo’s narrator. Audio plays on demand through **Hear explanation / Stop voice**.
- Share curated descriptions with Search tools and cover controls created later: debug menus, workspaces, annotations, test steps, findings, fixes, baselines, metadata, outlines and human review cards.
- Support hover, keyboard focus, **F1**, **Escape** and touch long-press without running the underlying control.
- Keep interactive help usable inside native modal dialogs, preserve input values and restore focus and existing descriptions when help closes.
- Pause an already-speaking demo while help plays, resume its previous state afterwards, and cancel help when the demo ends or resumes explicitly.
- Keep field values, credentials, notes, workspace names and preview content out of spoken descriptions.
- Fit help cards within the viewport across all interface themes and narrow widths. Reuse theme colours and fonts.
- Add voice-generation source scripts, repeatable builds and browser acceptance checks; mirror assets and code in the extension and web demo.

---

## 1. Shared feature catalogue

**Files:** `extension/feature-help-catalog.js`, `docs/feature-help-catalog.js`, `extension/app.js`, `docs/app.js`.

**What:** Combine tool-search metadata with curated descriptions for controls, sections, options and dynamic UI templates. Resolve help by stable IDs and selectors. Search tools reads the same descriptions. Coverage includes disabled and conditionally visible controls, as well as populated results and preview toolbars.

**Impact:** Explanations stay consistent as users move between searching for a feature and using it.

## 2. Interactive help and voice playback

**Files:** `extension/feature-help.js`, `docs/feature-help.js`, both app stylesheets and HTML builds, and both `tour-voice.js` files.

**What:** Show a shared, viewport-contained help popover on hover or focus. Its interactive voice control uses a non-modal dialog role and supports F1, Escape and touch long-press. Native titles are suppressed while help is visible and restored afterwards. Event isolation protects enclosing settings forms. Help speech coordinates with the demo narrator and recovers from missing audio.

**Impact:** Users can read or hear explanations without activating a tool, editing settings or hearing overlapping narration.

## 3. Bundled narration

**Files:** `extension/help/narration/`, `docs/help/narration/`, `tools/feature-help.json`, `tools/build-demo-narration.py`.

**What:** Generate 473 finished explanations with Kokoro v1.0’s stock `af_heart` voice. Store captions, stable keys and file references in a generated manifest. Extend the existing build-only generator with a help-catalogue mode. Each build contains about 26 MB of help audio; individual files load on demand.

**Impact:** Playback uses the bundled natural voice without requiring a voice-provider account or sending field values to a service.

## Verification

- **30/30 voiced-help checks:** all 473 captions match the live catalogue and all 473 MP3 files decode to non-silent audio and match between builds.
- Audited all 410 initial controls/headings in the acceptance fixture, then populated debug menus, saved workspaces, annotations, test actions, findings, fixes, metadata, measurements, combined results and comparison columns. No uncovered controls remained in those states.
- Verified actual voice playback, Stop/retry, F1/Escape, focus restoration, parent-modal preservation, long-press behaviour, private-field exclusions and coordinated playback with an already-speaking demo.
- **48/48 layout combinations:** six themes, light/dark modes and four window widths from 320 to 1600px.
- Regression checks: **23/23 tool-search**, **23/23 demo narration**, and **62/62 full demo/tool checks**, with zero page errors.
- Reviewed the rendered help card and checked script syntax, HTML assets, mirrored files and `git diff --check`. The installed extension was not separately loaded.

## Files changed

| Files | Change |
|-------|--------|
| `extension/feature-help-catalog.js`, `docs/feature-help-catalog.js` | Shared descriptions and control resolution |
| `extension/feature-help.js`, `docs/feature-help.js` | Help popover, interaction and voice player |
| `extension/app.js`, `docs/app.js` | Search descriptions and demo lifecycle integration |
| `extension/tour-voice.js`, `docs/tour-voice.js` | Voice coordination |
| `extension/app.css`, `docs/app.css` | Responsive help styling |
| `extension/app.html`, `docs/index.html` | Script loading and asset versions |
| `extension/help/narration/`, `docs/help/narration/` | 473 MP3s, manifest and provenance |
| `tools/feature-help.json`, `tools/build-demo-narration.py` | Narration source and build mode |
| `tests/feature-help.mjs` | Browser acceptance checks |
| `README.md`, this changelog | Usage and verification |
