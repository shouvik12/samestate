# ChatGPT Installation — Desktop Plugin Commands

- Added ChatGPT Desktop and Codex installation commands to the main README and MCP setup guide.
- Added a command to verify the plugin listing, restart/new-local-chat instructions and a working-style localhost prompt.
- Documented Node 22+, Chrome, current Codex CLI plugin support and desktop execution requirements.
- Added a prominent Use with ChatGPT link and references to official OpenAI installation guidance.

---

## Summary

GitHub readers can now find the commands and requirements for using the existing Samestate plugin in ChatGPT Desktop and Codex. The documentation reuses the Claude-compatible marketplace and distinguishes local desktop execution from a remote MCP integration.

---

## 1. Main README installation

**Files:** `README.md`

**What:** Added a top navigation link and a dedicated ChatGPT Desktop and Codex section with `codex plugin marketplace add shouvik12/samestate`, `codex plugin add samestate@samestate`, and `codex plugin list --marketplace samestate`. Included local chat setup, a localhost example, requirements and official documentation links.

**Impact:** Visitors can install the plugin from the same GitHub marketplace and understand where its local browser tools run.

## 2. Standalone MCP setup guide

**Files:** `mcp/README.md`

**What:** Added the same ChatGPT instructions and separated the existing Claude Code and standalone MCP installation paths with headings.

**Impact:** Readers arriving directly at the MCP guide receive the full setup instructions while existing Claude commands remain available.

---

## Validation

- Checked command syntax against the installed Codex CLI help for plugin marketplace add, plugin add and plugin list.
- Checked OpenAI's current plugin packaging, marketplace compatibility and desktop-only MCP documentation.
- Checked both installation snippets match the repository's plugin and marketplace names.
- Checked the new README anchors, relative documentation links and whitespace.
- Documentation-only update: no app, MCP server, manifest, dependency or user configuration changes. No plugin was installed into the user's account.

---

## Files Changed (3 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `README.md` | +26 | Navigation, install commands and release note |
| `mcp/README.md` | +26 | ChatGPT setup and install headings |
| `changelogs/CHANGELOG-chatgpt-install.md` | +49 | Change documentation |
