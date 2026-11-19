# Outline and Measurements — Page structure, focus paths, CSS measurements and linked suggestions

- New **Measure** button and **Outline** panel, also available from the command bar, with per-screen selection and refresh.
- List native and ARIA headings with their levels, visually hidden versus assistive-technology-hidden states, empty/invalid headings and hierarchy guidance.
- List named and unnamed landmark regions, including navigation, main, banner, footer, complementary, search, form and region roles.
- Show estimated keyboard order, respecting positive tabindex, radio groups, disabled/inert controls, closed details and modal scope; retain off-screen skip links and flag focusable aria-hidden content.
- Draw heading/landmark boxes and numbered focus stops connected by arrows; isolate overlays in a shadow root so the page's CSS cannot restyle their contents.
- Select an outline item or use **Pick element** to measure without activating or mirroring the control; Escape, Cancel pick and leaving the panel end picking.
- Show CSS dimensions, document coordinates, margin/padding/border, viewport distances, layout gap, typography, colors, contrast when measurable and estimated line length.
- Explain contrast, pointer target and reading-layout suggestions with W3C links, WCAG levels, exceptions and explicit human-review cases; do not label heuristics as conformance passes.
- Add Suggestions only, page identity, Clear overlays and JSON export; omit typed field values and data-samestate-private text.
- Recognize ARIA headings in the difference report and add an Outline/measurement task to Run all checks visual reviews.
- Clear stale selection on preview reload, focus the selected preview when using Focus mode, and ignore late pick responses after cancellation.
- Fixed: cached web-demo preview resources could retain an older agent after a shell refresh; version the demo page and agent resource together.
- Observe document changes safely during early preview startup; keep read-only inspection out of the Web Vitals quiet period.
- Mirror the implementation into the web demo and add UI/cross-origin extension acceptance coverage.

---

## Summary

The Outline panel complements area measurement and Alt-hover Peek with a structured page view, persistent measurements and practical suggestions. A tester can inspect page regions and keyboard paths, choose an element and see the measurements and guidance together, with no AI service required.

---

## 1. Structure and estimated keyboard navigation
**Files:** `extension/agent.js`, `docs/agent.js`, `extension/outline.js`, `docs/outline.js`.
**What:** Adds outline requests through the existing preview-agent bridge. Native and ARIA headings, landmarks and estimated focus stops have stable element keys and hidden-state information. Suggestions cover missing structure, skipped ranks, unnamed regions, invalid ARIA heading levels, positive tabindex and hidden focus targets. The focus calculation groups native radios and excludes disabled, inert and closed-details content; modal scope is considered.
**Impact:** Testers can inspect the page's structure on each device, including responsive hidden content. The UI explicitly identifies this as a DOM estimate, not a complete accessibility-tree or keyboard-conformance result.

## 2. Measurements and suggestions
**Files:** `extension/agent.js`, `docs/agent.js`, `extension/outline.js`, `docs/outline.js`.
**What:** Returns actual computed CSS geometry, box-model values, typography, colors and available contrast measurements for a listed or picked element. Advice links directly to W3C/WAI sources. The 24px AA pointer-target guidance includes its exceptions; 44px advice is labelled AAA guidance. Reading-line and line-spacing estimates are recommendations rather than automatic failures. Unavailable measurements remain labelled as such.
**Impact:** A tester sees what was measured, how it compares with relevant guidance and what requires human judgment. Measurements are before preview scaling and visual filters; they are not physical millimetres.

## 3. Overlays and safe element selection
**Files:** `extension/agent.js`, `docs/agent.js`.
**What:** Adds separate heading, landmark and numbered focus-path overlays inside a shadow root under Samestate's own layer. They redraw after relevant scrolling, resize and page changes, and are ignored by snapshots and synchronization. Picking intercepts the interaction before the normal click handlers, does not submit or navigate, supports cancellation, and returns only inspection facts. Field values and private text are excluded from names and exported data.
**Impact:** Inspection does not turn into an accidental click on the tested site, and the page's selectors do not alter overlay contents. Focus paths are capped at the first 200 stops and show visible stops; outline lists are capped at 800 items per type, with truncation identified.

## 4. UI, lifecycle and grouped checks
**Files:** `extension/app.html`, `docs/index.html`, `extension/app.css`, `docs/app.css`, `extension/app.js`, `docs/app.js`, `extension/checks.js`, `docs/checks.js`, `extension/outline.js`, `docs/outline.js`.
**What:** Adds the toolbar entry, tab, screen/type selectors, overlay switches, measurement cards, source links, suggestions filter and JSON export. Preview reloads clear element selection; selecting a preview in Focus mode makes that preview measurable. Run all checks includes a specific visual-review task and locks inspector controls while automation runs.
**Impact:** The feature is available directly in the UI and works through the same bridge on cross-origin extension previews. The tester retains control over visual acceptance.

## 5. Live-demo resource consistency
**Files:** `extension/app.js`, `docs/app.js`, `extension/demo/index.html`, `docs/demo/index.html`, `extension/demo/pricing.html`, `docs/demo/pricing.html`.
**What:** Versions the web demo's initial page and the bundled demo pages' agent script URL for this feature. The inspector's mutation observer attaches to the document, which is available during early script injection.
**Impact:** Reloading the shell does not leave cached preview pages running an agent that predates the new inspection messages.

---

## Testing

- `node tests/outline.mjs`: **23/23 passed** UI checks covering structure, hidden states, positive tabindex, radio/disabled/inert/closed-details handling, private-data exclusions, measured CSS pixels, guidance, boxes/arrows, report isolation, safe picking, cancellation, filtering/export, Focus-preview switching and ARIA headings in reports.
- `node tests/testrun.mjs`: **19/19 passed**, including actual cross-origin extension outline/measurement requests and the existing saved/AI-journey regressions. AI requests use a local stand-in; no paid model was called.
- `node tests/checks.mjs`: **15/15 passed** grouped-workflow regression checks.
- `node tests/smoke.mjs`: **42/42 passed** existing Chrome smoke checks; zero page errors.
- Verified the live app in the user's in-app browser after the resource-cache fix: the selected Desktop heading reported 542.7 × 121.8 CSS pixels, with margin/padding, typography and 15.1:1 contrast shown. Saved screenshots of the real UI and the wider Chrome layout.
- Syntax, HTML IDs/script paths, mirrored extension/demo assets and whitespace checked before delivery.
- Limits: no claim of full WCAG conformance. Verify real keyboard/screen-reader behaviour and custom widgets manually; nested frame/shadow-root contents are not traversed. No paid OpenRouter call or universal real-site/browser accessibility certification was performed.

---

## Files Changed (20 total)

| Files | Change |
|---|---|
| `extension/agent.js`, `docs/agent.js` | Outline facts, measurements, safe picking, overlays, ARIA report headings |
| `extension/outline.js`, `docs/outline.js` | New panel controller, selection, suggestions and export |
| `extension/app.js`, `docs/app.js` | Message routing, lifecycle, command, demo version |
| `extension/app.html`, `docs/index.html` | Measure entry, Outline controls and script |
| `extension/app.css`, `docs/app.css` | Inspector, measurement and suggestion styles |
| `extension/checks.js`, `docs/checks.js` | Visual task and run-time control locking |
| `extension/demo/index.html`, `docs/demo/index.html` | Matching versioned agent script |
| `extension/demo/pricing.html`, `docs/demo/pricing.html` | Matching versioned agent script |
| `tests/outline.mjs` | New UI acceptance suite |
| `tests/testrun.mjs` | Cross-origin extension inspection checks |
| `README.md` | Usage, sources, limitations and release note |
| `changelogs/CHANGELOG-outline-measurements.md` | This change record |
