# Samestate MCP server

Lets an AI assistant check a web page on phones, tablets and desktops at once. It runs on your computer: the assistant starts `server.mjs` and talks to it over stdio, and the server drives the Samestate extension from `../extension` in a hidden Chrome. No service is hosted anywhere, and pages on `localhost` work.

Needs Node 22 or later and Google Chrome (or set `CHROME_PATH`, for example to Chromium or Chrome for Testing). No npm packages.

## Install

As a Claude Code plugin (adds the server and the `/samestate:check` skill):

```
/plugin marketplace add shouvik12/samestate
/plugin install samestate@samestate
```

Only the server, from a checkout of this repository:

```
claude mcp add samestate -- node /path/to/samestate/mcp/server.mjs
```

Any other MCP client that runs local stdio servers takes the same command: `node /path/to/samestate/mcp/server.mjs`.

## Tools

| Tool | Arguments | Returns |
|------|-----------|---------|
| `check_responsive` | `url`; optional `devices`, `reference`, `include_adaptations`, `check_links` | The difference report grouped by problem: severity, category, affected screens, each screen's detail with a CSS selector for each element involved (up to five), and the CSS that usually fixes it or a suggestion |
| `screenshot` | `url`; optional `devices` (default `iphone`, `ipad`, `desktop`), `width` | One PNG per screen at the screen's own width, at most 900px, in the order of `devices` |
| `run_checks` | `url`; optional `devices`, `reference`, `groups` (`layout`, `accessibility`, `meta`, `performance`, `links`, `widths`, `settings`) | Pass, warning, fail or incomplete per group with its findings, as in **Run all checks** |
| `list_devices` | none | Every screen id with its name, CSS size, kind and whether it is on by default |

`devices` takes ids from `list_devices`; without it the seven starter screens open. Addresses without a scheme get `https://`, or `http://` for `localhost` and `127.x`. A screen that does not load and connect within 30 seconds is listed as not measured; if none load, the tool returns an error.

## How it works

1. On the first tool call, `chrome.mjs` copies `extension/` to a temporary folder, turns its optional site access into granted access (nobody is there to answer Chrome's prompt), and starts Chrome headless with `--remote-debugging-pipe`.
2. The extension is loaded with the DevTools `Extensions.loadUnpacked` command, as `tools/samestate-ci.mjs` does, and its app page is opened with `?open=<url>`, the same path as the toolbar button.
3. Each tool selects the screens, waits until every one has loaded and connected, then calls the app's own functions: `detect()` for the difference report, the **Run all checks** button for combined checks, and a capture of each screen shown at 100% for screenshots.
4. Element selectors: each finding carries the elements' paths in the page (child positions from `<body>`; numbered keys such as `ov|0` get theirs from the snapshot's `keyPaths`). The server reads them inside each screen's frame through its own DevTools session and builds a short selector that matches one element, preferring ids and readable class names over generated ones. Only the assistant on your computer receives them.
5. Chrome stays open between calls, one call at a time. It closes, and the temporary profile and extension copy are deleted, when the assistant stops the server.

The hidden Chrome uses its own empty profile: none of your sign-ins, cookies or extensions are in it, and nothing is sent anywhere except the requests the pages themselves make.

## Test

```
node tests/mcp.mjs
```

Serves the sample site on localhost, starts the server and checks the protocol, all four tools and the error cases.
