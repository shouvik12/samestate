# Samestate MCP server

Lets an AI assistant check a web page on phones, tablets and desktops at once. It runs on your computer: the assistant starts `server.mjs` and talks to it over stdio, and the server drives the Samestate extension from `../extension` in a hidden Chrome. No service is hosted anywhere, and pages on `localhost` work.

Needs Node 22 or later and Google Chrome (or set `CHROME_PATH`, for example to Chromium or Chrome for Testing). No npm packages.

## Install

### ChatGPT Desktop and Codex

With a current Codex CLI that supports plugins, run in a terminal:

```bash
codex plugin marketplace add shouvik12/samestate
codex plugin add samestate@samestate
```

Verify the installation:

```bash
codex plugin list --marketplace samestate
```

Restart ChatGPT Desktop, open **Plugins** and find **Samestate**, then start a new **local Work or Codex chat**. Select `@Samestate` when the plugin picker is available. With your site's development server running, ask:

> Use Samestate to check http://localhost:3000 on iPhone and Desktop. Show the layout issues and take a screenshot of each screen.

Node 22+ and Chrome must be installed on the computer running the local chat. The existing Claude-compatible marketplace and plugin configuration supply the same four tools listed below. This stdio server runs locally; connecting the tools to ChatGPT in a browser requires a remote MCP integration. Availability depends on client version and workspace settings.

References: OpenAI's [plugin packaging and marketplace guide](https://developers.openai.com/plugins/build/plugins) and [desktop-only MCP guidance](https://developers.openai.com/plugins/deploy/desktop-only).

### Claude Code

As a Claude Code plugin (adds the server and the `/samestate:check` skill):

```
/plugin marketplace add shouvik12/samestate
/plugin install samestate@samestate
```

### Local MCP server only

Only the server, from a checkout of this repository:

```
claude mcp add samestate -- node /path/to/samestate/mcp/server.mjs
```

Any other MCP client that runs local stdio servers takes the same command: `node /path/to/samestate/mcp/server.mjs`.

A 75-second tutorial video shows it in use: https://shouvik12.github.io/samestate/media/samestate-claude-code.mp4

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
4. Each finding carries the elements' child positions from `<body>`. The server resolves them inside the screen's frame and only returns selectors that match exactly the intended element. It prefers readable IDs and class names and can use the full path when the element is nested deeply.
5. Chrome stays open between calls, one call at a time. A cancellation skips the matching queued call or closes Chrome and deletes its temporary profile and extension copy for a running call. The next call starts a fresh Chrome session. Stopping the server also closes Chrome and deletes its temporary files.

The hidden Chrome uses its own empty profile: none of your sign-ins, cookies or extensions are in it, and nothing is sent anywhere except the requests the pages themselves make.

## Test

```
node tests/mcp.mjs
```

Serves the sample site on localhost, starts the server and checks the protocol, all four tools and the error cases.
