# Run All Checks — Grouped UI checks, combined results and human review

- New **Run all checks** top-bar button, sidebar setup drawer and **Checks** results tab; also available from the command bar.
- Select groups for layout/content, accessibility/usability, metadata/errors, performance/network, broken links, test journeys, screen settings/long text, width sweeps, visual tools, capture and workspaces.
- Report groups share one measurement of the current wall; the selected journey runs first and reports measure its final page state.
- Run a saved journey without AI, or use the existing OpenRouter / OpenAI-compatible connection and plan; AI runs first to preserve Chrome's permission gesture and existing sign-in confirmations.
- Screen-setting scans cover all non-vision options and long text; inapplicable settings and missing measurements are incomplete, never passes.
- Progress appears in the setup drawer and sticky combined summary, with **Stop** available in both places.
- Combine automated findings and journey step outcomes with explicit human tasks for visual tools, panels, simulators, forms, sync, live reload, capture and workspaces.
- Human tasks start as **Needs human review**, with **Open tools**, **Pass**, **Fail**, **Skip**, **Reset** and optional notes.
- Export combined results as HTML or JSON, including pending reviews, notes, findings, journey steps and scope limits; no AI key or raw test file is exported.
- Lock competing controls during automation and restore temporary screen settings, rotations, long text, link selection and live reload afterwards, including on cancellation.
- Fixed: the combined journey result now fails for report issues, warns for warnings, and rejects an unfinished AI plan.
- Fixed: width sweeps return their completion and missing-width coverage so a partial sweep cannot appear clean in combined results.
- Added Chrome UI acceptance coverage and extension tests using a local AI stand-in; kept extension/demo assets identical.

---

## Summary

A tester can start grouped checks from Samestate's UI, watch progress, review visual items beside the previews and export a single result. AI is optional and uses the existing Test runs connection; this feature requires no CI setup.

---

## 1. Selection and automatic groups
**Files:** `extension/checks.js`, `extension/app.html`, `extension/app.js`, `extension/app.css`, and their demo counterparts.
**What:** Adds eleven selectable groups, shared report measurements, optional existing saved/AI journeys, sequential screen-setting scans and an optional width sweep. Selection is remembered locally. The current device wall and reference are used; Compare sites and Page steps must be off.
**Impact:** A tester starts a batch from the top bar instead of invoking each automatic check separately. The journey establishes the page state measured by the report groups; earlier states can have explicit report steps.

## 2. Evidence and human review
**Files:** `extension/checks.js`, `docs/checks.js`.
**What:** Stores independent results for automatic jobs and human decisions. Findings include category, severity and screen; journey steps retain per-screen outcomes. Visual tasks cover metadata/social cards, console, breakpoints, all debug-tool families, simulators, design overlays, element search/commands, forms/sync, live reload, captures/recordings, report files and workspace portability. Human decisions and notes update the combined outcome. HTML and JSON exports include the same evidence.
**Impact:** Visual correctness is never inferred from a successful script. Pending, skipped, missing and stopped work stays distinguishable from a pass. Results stay in the current tab until a new run or reload, so testers should export before leaving.

## 3. Optional AI journey and truthful outcomes
**Files:** `extension/testrun.js`, `docs/testrun.js`, `extension/checks.js`, `docs/checks.js`.
**What:** Adds UI-safe journey methods that retain sign-in and service-access prompts, exposes cancellation/busy state, and returns the AI run's outcome. A model must finish successfully and execute steps for the AI journey to pass. Report issues/warnings recorded in steps affect the combined outcome even when click/text expectations pass. The saved-test and existing automation APIs remain available.
**Impact:** Testers can use a saved test with no AI calls or explicitly choose their AI connection. No API key is copied into combined results.

## 4. Progress, cancellation and state restoration
**Files:** `extension/checks.js`, `extension/app.js`, `extension/capture.js`, and their demo counterparts.
**What:** Displays running jobs and journey/sweep progress, locks competing controls, stops in-flight AI/sweeps and marks remaining jobs stopped. Restores temporary settings and rotations in cleanup. Existing captures, tests, measurements, demos and sweeps must finish before a new batch starts. Sweeps expose missing-width coverage.
**Impact:** A cancelled or partial run cannot become a clean result or leave temporary test settings behind. Visual tasks stay available after the automatic run so the tester can use the app normally.

---

## Testing

- `node tests/checks.mjs`: **15/15** Chrome UI checks passed, no page errors. Covers opening the UI, group selection, shared scans and known failures, pending human tasks, decisions/notes, escaped HTML and JSON evidence, a failing saved journey, missing previews, control locking, cancellation/restoration, all non-vision settings/long text and sweep cancellation.
- `node tests/testrun.mjs`: **17/17** checks passed with the extension loaded and a local OpenAI-compatible stand-in. Covers the new UI's AI journey across phone/tablet/desktop, report findings affecting its outcome, an unfinished plan failing, existing request privacy/key handling and saved-test replay. The script's existing replay-tool regressions also passed.
- `node tests/smoke.mjs`: **42/42** checks passed in Chrome, **0 page errors**.
- Syntax checks passed for changed JavaScript. Extension/demo script and style copies match; both HTML entry points have unique IDs and valid script paths/loading order. `git diff --check` passed.
- Inspected screenshots in dark and light modes. Real paid OpenRouter calls and a tester's hands-on visual acceptance of every tool/capture were not performed in this change; those are explicitly represented as human review.

---

## Files Changed (16 total)

| Files | Change |
|---|---|
| `extension/checks.js`, `docs/checks.js` | New grouped-check runner, results, review and exports |
| `extension/app.html`, `docs/index.html` | Setup drawer, toolbar entry, results tab and script |
| `extension/app.css`, `docs/app.css` | Setup, progress, statuses, review controls and responsive layout |
| `extension/app.js`, `docs/app.js` | Command entry, shortcut guard and sweep coverage result |
| `extension/testrun.js`, `docs/testrun.js` | UI journey API, cancellation and AI completion outcome |
| `extension/capture.js`, `docs/capture.js` | Expose busy state for run preflight |
| `tests/checks.mjs` | New UI acceptance checks |
| `tests/testrun.mjs` | Exercise grouped UI AI workflow and false-pass cases |
| `README.md` | User guide and release notes |
| `changelogs/CHANGELOG-run-all-checks.md` | This change record |
