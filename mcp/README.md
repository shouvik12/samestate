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

For an existing installation, run `claude plugin update samestate@samestate` and restart Claude Code. The plugin and extension share release version **0.2.0**.

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
| `check_responsive` | `url`; optional `devices`, `reference`, `sign_in`, `include_adaptations`, `check_links` | The difference report grouped by problem: severity, category, affected screens, each screen's detail with a CSS selector for each element involved (up to five), and the CSS that usually fixes it or a suggestion |
| `screenshot` | `url`; optional `devices` (default `iphone`, `ipad`, `desktop`), `width`, `sign_in` | One PNG per screen at the screen's own width, at most 900px, in the order of `devices` |
| `run_checks` | `url`; optional `devices`, `reference`, `sign_in`, `groups` (`layout`, `accessibility`, `meta`, `performance`, `links`, `widths`, `settings`) | Pass, warning, fail or incomplete per group with its findings, as in **Run all checks** |
| `list_devices` | none | Every screen id with its name, CSS size, kind and whether it is on by default |

`devices` takes ids from `list_devices`; without it the seven starter screens open. Addresses without a scheme get `https://`, or `http://` for `localhost` and `127.x`. A screen that does not load and connect within 30 seconds is listed as not measured; if none load, the tool returns an error.

## Test-account sign-in

Pass `sign_in` on each call to `check_responsive`, `run_checks`, or `screenshot` that needs a test account. Samestate creates a separate temporary Chrome profile. The same explicit option can reuse that session on the same site. Changing the account, changing the site, or making a page-tool call without `sign_in` starts a fresh profile.

For a saved session, place a test-account storage-state JSON file inside your project and provide its path. Relative paths use the MCP server's working directory. The `.samestate/auth/` directory is ignored by Git.

```json
{
  "url": "http://localhost:3000/dashboard",
  "devices": ["iphone", "desktop"],
  "sign_in": {
    "state_file": ".samestate/auth/test-account.json"
  }
}
```

The file uses the storage-state shape `{"cookies":[…],"origins":[{"origin":"http://localhost:3000","localStorage":[{"name":"…","value":"…"}]}]}`. Standard cookie fields are `name`, `value`, `domain`, `path`, `expires` (Unix seconds, or `-1` for a session cookie), `httpOnly`, `secure`, and `sameSite`. Only cookies matching the tested hostname and localStorage for the tested origin are restored. Saved-state import supports cookies and localStorage.

To sign in manually, provide the login page and the full URL that indicates successful sign-in. Chrome opens a separate window for the test account. Finish login there, including any MFA. Samestate continues after that window reaches `success_url`, which must be on the tested site's origin.

```json
{
  "url": "http://localhost:3000/dashboard",
  "sign_in": {
    "login_url": "http://localhost:3000/login",
    "success_url": "http://localhost:3000/dashboard",
    "timeout_seconds": 120
  }
}
```

Manual login needs a desktop display. The window stays open while its authenticated checks run. Cancel the tool call to close its temporary browser. Session data is removed when the profile closes, and saved files are read locally. Keep those files out of source control. Reports and screenshots contain the tested page, so use accounts populated with test data.

For authenticated checks, use the final page URL. A preview that redirects to a different path returns an error so a login page cannot silently replace the page being checked.

## How it works

1. On the first tool call, `chrome.mjs` copies `extension/` to a temporary folder, turns its optional site access into granted access (nobody is there to answer Chrome's prompt), and starts Chrome headless with `--remote-debugging-pipe`.
2. The extension is loaded with the DevTools `Extensions.loadUnpacked` command, as `tools/samestate-ci.mjs` does, and its app page is opened with `?open=<url>`, the same path as the toolbar button.
3. Each tool selects the screens, waits until every one has loaded and connected, then calls the app's own functions: `detect()` for the difference report, the **Run all checks** button for combined checks, and a capture of each screen shown at 100% for screenshots.
4. Each finding carries the elements' child positions from `<body>`. The server resolves them inside the screen's frame and only returns selectors that match exactly the intended element. It prefers readable IDs and class names and can use the full path when the element is nested deeply.
5. Chrome stays open between calls, one call at a time. A cancellation skips the matching queued call or closes Chrome and deletes its temporary profile and extension copy for a running call. The next call starts a fresh Chrome session. Stopping the server also closes Chrome and deletes its temporary files.

Chrome starts with an empty temporary profile. Explicit test-account sign-in adds the provided session to that profile. Session values stay within the local authentication flow.

## Release versions

Increment both `.claude-plugin/plugin.json` and `extension/manifest.json` when releasing changes to the bundled plugin. Run `node tools/check-versions.mjs` locally. CI checks that the versions match and that bundled changes advance the plugin version relative to the base commit, so existing installations can receive the update.

## Test

```
node tests/mcp.mjs
```

Serves the sample site on localhost, starts the server and checks the protocol, all four tools and the error cases.
