# Page HTTP Errors

- Fixed: A preview whose main document returns HTTP 4xx or 5xx now shows a page error with its status code.
- Fixed: **Meta & page errors** fails on those responses, and CI includes them in its report and fails under the default settings.

---

## Summary

Samestate now checks the status of the previewed document alongside JavaScript errors and failed resources.

## 1. Main document status

**Files:** `extension/agent.js`, `extension/app.js`, `docs/agent.js`, `docs/app.js`

**What:** Reads the HTTP status of the document already loaded in each preview. The shared report marks a 4xx or 5xx response as an issue in Errors and includes the exact status code.

**Impact:** An error page that renders normally still fails the combined page error check and the default CI run.

## Testing

- `node tests/testrun.mjs` serves identical HTML with HTTP 200, 404 and 500. It checks the combined results in the extension and verifies the default CI exit code and JSON finding for HTTP 500.
- The guided web demo smoke test checks that the shared report still runs across the sample workflows.

## Files Changed (7 total)

| File | Approximate Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | 1 | Document HTTP status |
| `extension/app.js` | 2 | Page error finding |
| `docs/agent.js` | 1 | Web build mirror |
| `docs/app.js` | 2 | Web build mirror |
| `tests/testrun.mjs` | 40 | Extension and CI regression coverage |
| `README.md` | 3 | Feature description and release notes |
| `changelogs/CHANGELOG-page-http-errors.md` | 37 | Change details |
