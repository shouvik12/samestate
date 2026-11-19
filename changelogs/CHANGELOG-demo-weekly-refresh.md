# Guided demo refresh — November 12–19, 2026

Expand the current 25-stop walkthrough to 46 stops after comparing the past week’s release notes and local changes with its existing steps. The existing sync, layout, annotations, page journeys and site-comparison demonstrations remain in the flow.

## Added coverage

| Recent feature group | New walkthrough stops |
|---|---|
| Suggested fixes and saved baselines | Preview fixes and baselines |
| Accessibility, Web Vitals and network report | Accessibility, vitals and page weight |
| Responsive width scanning | Sweep responsive widths — a real 320–1920px sweep |
| Media settings, RTL and translated copy | Screen settings and long text |
| CSS breakpoint devices | Breakpoint screens, including the width just below a boundary |
| Debug tools and visual simulations | Debug overlays; Visual simulators |
| Rulers, guides, columns, baselines and design comparison | Rulers and layout grids; Design reference overlay |
| Selector search, autofill, typing sync and live reload | Find elements across screens; Forms, typing sync and live reload |
| Unified lookup | Search every tool |
| Metadata and grouped page logs | Meta and social previews; Console across devices |
| Measurements, suggestions, headings, landmarks and keyboard order | Outline and measurements; Keyboard order and landmarks |
| Test runs and optional AI setup | Replay a saved test; Optional AI test writing |
| Selectable check groups, progress, combined results and human decisions | Run all checks; Human review and combined results |
| Workspace portability and report formats | Share workspaces and reports |

The existing theme stop now uses the bundled Clean Green preview palette. The day/night stop includes Clean Green and describes Samestate’s Zinc night palette. The capture stop covers full-page/overview captures, PNG/JPEG/PDF, automatic screenshot pace, recording frame rate, 10 MB parts and saving to a folder.

## Real behavior and cleanup

- Replay four bundled saved-test steps on every linked screen. Show AI setup with no provider request and retain the tester’s saved test and credentials.
- Run real layout, accessibility, metadata/error and performance groups. Keep visual/capture/workspace rows in Needs human review, with their notes and export controls visible.
- Keep Pause and Skip available during demo-owned grouped checks. Pause holds the current explanation, including after an asynchronous tool finishes. Normal check launches remain blocked while a demo is running.
- Restore temporary test/report state, group selection and storage, the demo baseline, screen settings, typing sync, overlays, design references and live-reload mode when finishing or skipping. Stop owned checks/tests/sweeps before restoring state.
- Move the explanation, pointer and Pause/Skip into native dialogs while those dialogs are demonstrated, so the tour remains readable and operable above their backdrops.
- Start the app after all its modules have loaded; version the changed scripts and demo agent references for an already-open web build.
- Rebuild picker rows when temporary breakpoint devices are added/removed, wait for every linked page to finish loading, and restore selector-search position/status after the demo.
- Manual Search tools and Measure actions finish demo cleanup before opening, so their dialogs/panels stay visible.

Downloads, capture-sharing prompts and actual AI requests are left to explicit user actions. CI-only and packaging changes are not separate UI-tour steps; bug fixes are represented through the corrected tools.

## Verification

- `SMOKE_PACE=0.05 node tests/smoke.mjs`: **62/62 passed**, zero page errors. All 46 walkthrough stops plus 16 post-tour checks passed in 187 seconds with accelerated reading delays and real page/tool waits.
- `node tests/tour-cleanup.mjs`: **16/16 passed**, including replay success, cancellation during owned tests/checks, prior review-note/report preservation, empty-report restoration, group/settings/search-state restoration, untouched AI credential fields and manual Search/Measure takeover.
- `node tests/tool-search.mjs`: **23/23 passed**, zero page errors.
- Inspected captured Search, Outline/measurements and Human review screenshots. The explanations, pointer, Pause/Skip and result panels are visible in the correct steps, including inside a native modal.
- JavaScript syntax, HTML IDs, referenced assets, matching extension/web-demo files and `git diff --check` pass.
