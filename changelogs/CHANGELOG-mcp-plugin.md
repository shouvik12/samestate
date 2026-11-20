# MCP Plugin — Samestate as a Tool for AI Assistants, Packaged for Claude Code

- New MCP server, `mcp/server.mjs`: an AI assistant can open a page on several screen sizes at once and get Samestate's results, then fix the layout and check again.
- Four tools: `check_responsive` (the difference report grouped by problem, with affected screens and the CSS that usually fixes it), `screenshot` (one sharp image per screen), `run_checks` (the automated check groups with pass, warning or fail) and `list_devices` (screen ids and sizes).
- It runs on the user's computer over stdio, started by the assistant: no hosted service, and `localhost` pages work.
- The checks are the app's own: the server loads the extension from `extension/` in a hidden Chrome and calls its report, checks and layout code.
- Claude Code plugin: `.claude-plugin/plugin.json` starts the server, `.claude-plugin/marketplace.json` makes the repository installable with `/plugin marketplace add shouvik12/samestate`, and the `/samestate:check` skill (`skills/check/SKILL.md`) tells Claude to check, look, fix in the source, check again and report.
- Clear errors for unknown screen ids, addresses that are not http or https, and pages that never load.
- No npm packages; needs Node 22 or later and Google Chrome (or `CHROME_PATH`).
- README: a "Use it from Claude Code" section and the new test in the test list; `mcp/README.md` has the details.

---

## Summary

Samestate's responsive checks, usable by Claude while it edits a site.

---

## 1. Chrome driver
**Files:** `mcp/chrome.mjs`
**What:** Copies the extension to a temporary folder with site access granted, starts Chrome with `--remote-debugging-pipe` and loads it with `Extensions.loadUnpacked` (as `tools/samestate-ci.mjs` does), then opens `app.html?open=<url>`. Selects screens with `selectDevice`, sets the reference, waits until every screen is ready, and runs `detect()`, the Run all checks button, or captures each screen while it is shown at 100% (`scaleOverride = 1`) so desktop screenshots are sharp. Calls are queued; Chrome and the temporary profile are removed on exit.
**Impact:** One code path for the app, CI and AI assistants.

## 2. MCP protocol
**Files:** `mcp/server.mjs`
**What:** JSON-RPC 2.0 over stdio with `initialize`, `ping`, `tools/list` and `tools/call`; tool results as text (and PNG images for screenshots); tool failures returned as `isError` results the assistant can read.

## 3. Plugin
**Files:** `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `skills/check/SKILL.md`
**What:** The repository root is the plugin, so the server finds `extension/` next to it. Both manifests pass `claude plugin validate`.

## 4. Docs and tests
**Files:** `mcp/README.md`, `README.md`, `tests/mcp.mjs`

---

## Testing
- `node tests/mcp.mjs`: 13/13 (protocol, all four tools on the sample site served on localhost, adaptations on and off, screenshot widths, combined checks, unknown screen, non-web address, page that never loads)
- Installed from this checkout into a temporary Claude Code config: the plugin installs with its skill, and `claude mcp list` shows `plugin:samestate:samestate` connected
- Screenshots of iPhone, iPad, Desktop and the 2560px display checked by eye: each complete and sharp
