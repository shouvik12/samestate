# MCP Selectors — The Report Names Each Element, Screenshots Keep Their Order

- `check_responsive` now lists the elements behind each finding as short CSS selectors, up to five per screen, for example `#cookies`, `table` or `div.tabs > button:nth-of-type(1)`. An assistant can go straight to the element in the source instead of guessing from “button (55×18)”.
- Every kind of finding is covered, including sideways scroll, overlays, fixed elements, scroll areas and hidden focusable controls, which used numbered keys.
- Selectors match exactly one element on that screen, prefer ids and readable class names, and skip names that look generated (long digit runs, CSS-in-JS prefixes).
- `screenshot` returns images in the order of `devices`, not the wall's order.
- Plugin version 0.1.4, so `claude plugin update samestate@samestate` picks up the change.

---

## Summary

Findings point at real elements, so fixes can start from the right line.

---

## 1. Element paths for numbered keys
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** `reg()` records the element path (child positions from `<body>`) for any key that is not itself a path (`ov|0`, `fx|1`, `cv|2`, `sc|0`, `hf|3`, `ls|0`), and the snapshot returns them as `keyPaths`. No text or attribute leaves the page; the app ignores the field.

## 2. Selectors in the MCP server
**Files:** `mcp/chrome.mjs`, `mcp/server.mjs`
**What:** The server keeps a DevTools session for each screen's frame (`Target.setAutoAttach`), keeps `detect()`'s snapshots on the way through, maps each finding's keys to paths, and builds a unique selector for each path inside that frame. Findings get `elements`; the text report adds an `Elements:` line per screen.

## 3. Screenshot order
**Files:** `mcp/chrome.mjs`
**What:** Screens are captured in the order of `devices`.

## 4. Docs and tests
**Files:** `mcp/README.md`, `README.md`, `tests/mcp.mjs`, `.claude-plugin/plugin.json`

---

## Testing
- `node tests/mcp.mjs`: 17/17, including the element behind sideways scroll (`table`), the overlay (`#cookies`), unique tap-target selectors and screenshot order
- news.ycombinator.com: unlabelled controls resolve to the vote links (`td.votelinks > center > a`); screenshots returned Small mobile first as asked
- `node tests/outline.mjs`: 23/23; `node tests/checks.mjs`: 15/15 after the agent change
