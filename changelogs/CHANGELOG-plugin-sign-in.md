# Plugin test-account sign-in

- Added `sign_in` to responsive checks, combined checks, and screenshots.
- Added loading of test-account cookies and localStorage from a project storage-state file.
- Added a separate Chrome window for manual test-account login with a success URL and timeout.
- Kept authenticated calls in dedicated temporary profiles, with explicit session selection on each page-tool call.
- Added redirect detection so an authenticated check reports a login redirect.
- Added an ignored `.samestate/auth/` directory for project session files.

---

## Summary

The plugin can check protected dashboards and account pages using an explicitly supplied test account.

## 1. Restore saved test sessions

**Files** `mcp/auth.mjs`, `mcp/chrome.mjs`, `mcp/server.mjs`

**What changed** Each page tool accepts `sign_in.state_file`. The server validates a project-local JSON file and restores cookies matching the tested hostname and localStorage matching its origin. Preview storage is initialized before the page's own scripts run.

**Impact** Cookie and localStorage login flows work across the selected screen sizes. Saved-state import supports these two storage types.

## 2. Complete login in an isolated window

**Files** `mcp/auth.mjs`, `mcp/chrome.mjs`, `mcp/server.mjs`

**What changed** `sign_in.login_url` opens a fresh Chrome window and waits for `success_url` on the tested origin. The default timeout is 120 seconds. Successful login state is available to its previews. Repeating the same option can reuse the test session. A changed account, changed origin, or omitted option starts a fresh profile.

**Impact** Users can complete test-account login and MFA in a separate browser window. Authenticated previews that land on another path return an error. Browser profiles are deleted on shutdown or cancellation.

## 3. Document and test the workflow

**Files** `mcp/README.md`, `README.md`, `skills/check/SKILL.md`, `.gitignore`, `tests/mcp.mjs`

**What changed** Added saved-state and manual-login examples, instructions to repeat the sign-in option, and a Git ignore entry for session files. MCP regression cases use synthetic local accounts.

**Impact** Assistants can request authenticated checks without exposing session-file contents in their output.

---

## Testing

- `node tests/mcp.mjs` passed all 35 checks.
- `node tests/smoke.mjs` passed all 69 checks with zero page errors before merging.
- Verified saved cookie sessions and localStorage restoration on phone and desktop previews.
- Verified isolated login-window completion, timeout handling, omitted-session isolation, expired-session redirects, project path validation, and errors that omit session-file contents.
- The login-window fixture simulates successful login locally. External identity-provider and MFA flows require completion in the user's test-account window.

---

## Files changed

| File | Approximate lines changed | Purpose |
|---|---:|---|
| `mcp/auth.mjs` | 101 | Validate and scope test sessions |
| `mcp/chrome.mjs` | 90 | Restore sessions and manage isolated login |
| `mcp/server.mjs` | 21 | Tool parameters and routing |
| `tests/mcp.mjs` | 98 | Authentication regression cases |
| `mcp/README.md` | 45 | Setup, examples, and session behavior |
| `skills/check/SKILL.md` | 2 | Assistant workflow |
| `.gitignore` | 1 | Ignore project login files |
| `README.md` | 8 | Setup and release notes |
| `changelogs/CHANGELOG-plugin-sign-in.md` | 64 | Change details |
