# MCP Selector and Cancellation Fixes

- Fixed: Responsive reports keep the ancestor path needed to identify deeply nested or repeated elements and verify that each selector matches the intended element.
- Fixed: Cancelling a tool call skips it if queued or stops its private Chrome session if running. The next tool call can still run.

---

## Summary

Responsive findings point to individual elements, and assistants can stop scans that are no longer needed.

## 1. Unique element selectors

**Files:** `mcp/chrome.mjs`, `mcp/README.md`, `tests/mcp.mjs`

**What:** Builds selectors up to the document body without trimming them. If the readable selector stays ambiguous, the server tries a selector based on exact child positions. It returns a selector only if it matches the intended element alone.

**Impact:** Reports can distinguish identical controls under deep, repeated layouts.

## 2. Cancel MCP requests

**Files:** `mcp/server.mjs`, `mcp/chrome.mjs`, `mcp/README.md`, `tests/mcp.mjs`

**What:** Tracks `notifications/cancelled` by request ID. Queued calls skip browser work. For a running call, Samestate stops its private Chrome process and removes its temporary files before the next call starts. Cancelled requests produce no reply.

**Impact:** Stopping a scan releases the shared browser queue without disrupting unrelated requests.

## Testing

- `node tests/mcp.mjs` checks repeated controls nested more than six levels deep, a selector longer than 160 characters, cancellation during a live link check, cancellation of a queued call, and recovery on the next call.

## Files Changed (6 total)

| File | Approximate Lines Changed | Type |
|------|:---:|------|
| `mcp/chrome.mjs` | 150 | Selector and Chrome lifecycle fixes |
| `mcp/server.mjs` | 40 | MCP request cancellation |
| `tests/mcp.mjs` | 60 | Regression coverage |
| `mcp/README.md` | 4 | Selector and cancellation behavior |
| `README.md` | 1 | Release notes |
| `changelogs/CHANGELOG-mcp-selector-cancellation.md` | 45 | Change details |
