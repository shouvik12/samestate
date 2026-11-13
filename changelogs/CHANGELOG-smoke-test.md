# Smoke Test — Play the Guided Demo in Headless Chrome and Check Every Step

- Added `tests/smoke.mjs`, an end-to-end test with no npm packages: it serves `docs/`, starts Chrome over the DevTools protocol using Node 22's built-in `WebSocket`, and plays the guided demo
- After each of the 21 tour steps it checks what the step should leave behind, such as 7 open menus, 7 dark screens with the Desktop "matched", 7 playing videos, the iPhone placed between the Desktop and the MacBook, or three page steps ending on `pricing.html`
- After the tour it checks report export (Markdown, CSV, HTML) and a saved workspace being reopened
- Any uncaught page error or `console.error` fails the run; the exit code is 1 when anything fails
- Added `.github/workflows/smoke-test.yml`, which runs the test on every push and pull request to `main` with Node 22 and the runner's Chrome
- `app.js`: the tour dispatches a `samestate-tour-step` event after each step, and `?tour-pace=0.3` shortens reading pauses and the pause after each step (not the waits a step needs)
- Options: `CHROME_PATH` for another Chrome, `SMOKE_HEADED=1` to watch, `SMOKE_ROOT` to serve another copy of the web build
- Documented the test in `CONTRIBUTING.md` and the README, and in the commit workflow

---

## Summary
The repo had no tests, and the click matching and report checks could break without anyone noticing. The guided demo already exercises most of the app on the sample site, so it now doubles as a smoke test.

---

## 1. Test Runner
**Files:** `tests/smoke.mjs`
**What:** A static server on a random port, Chrome with a temporary profile, a small DevTools-protocol client, and a probe injected with `Page.addScriptToEvaluateOnNewDocument`. The probe listens for `samestate-tour-step` and runs the check for that step title against the app's own state (`DEVICES`, `findings`, `reportGroups`, `pageScreens`, `sitePanels`). Results print as the tour runs.
**Impact:** About 100 seconds locally. Checks are keyed by step title, so a changed step needs its check updated.

## 2. Tour Hooks
**Files:** `extension/app.js`, `docs/app.js`
**What:** `tourPace` from the `tour-pace` URL parameter (0.05 to 1, default 1) multiplies the reading pause and `step.wait`. The step event is dispatched after each step's pause.
**Impact:** No change to the tour without the parameter.

## 3. CI
**Files:** `.github/workflows/smoke-test.yml`
**What:** Ubuntu runner, Node 22, `CHROME_PATH="$(command -v google-chrome)"`. With `CI` set, Chrome starts with `--no-sandbox`.
**Impact:** Pull requests show a **Smoke test** check next to **Require changelog**.

---

## Testing
- 25 of 25 checks passed locally in about 104 seconds (macOS, Chrome)
- With twin matching deliberately broken in a copy of `docs/` (`findTwin()` returning nothing), the run failed the two dark-mode steps ("Desktop: unreachable") and exited with code 1
- The GitHub Actions workflow has not run yet

---

## Files Changed (6 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `tests/smoke.mjs` | +252 | New test |
| `.github/workflows/smoke-test.yml` | +24 | New workflow |
| `extension/app.js`, `docs/app.js` | +3 −2 each | Tour pace and step event |
| `CONTRIBUTING.md`, `.agents/workflows/commit.md` | ≈ +10 −3 | How to run it |
