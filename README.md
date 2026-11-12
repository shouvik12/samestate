<h1 align="center">Samestate</h1>
<p align="center"><b>One interaction, every device.</b><br>
Click once. Every screen size follows to the same state, even when the layouts are completely different.</p>

<p align="center">
  <a href="https://shouvik12.github.io/samestate/"><b>▶ Live demo</b></a> ·
  <a href="#install">Install the Chrome extension</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#release-notes">Release notes</a>
</p>

<p align="center"><a href="https://shouvik12.github.io/samestate/"><img src="docs/media/samestate-demo.gif" alt="Clicking Products on the desktop opens the drawer and the Products accordion on every phone and tablet" width="900"></a></p>

## Screenshots

| Logical sync | Difference report |
|---|---|
| ![Desktop clicks Products; every phone opens its drawer and the Products accordion](docs/media/screenshot-sync.png) | ![Per-device findings: sideways scroll, wide table, small tap targets, hidden content](docs/media/screenshot-report.png) |
| Desktop clicks **Products**. Each phone opens its own drawer, then Products. | Every device measured against the Desktop, grouped by category. |

## What it does

Samestate opens a site in a wall of responsive previews for phones, tablets, laptops, and desktops.

- **Click and scroll sync.** Samestate matches controls and scroll sections by their position in the page structure.
  Enable **Match visible text** to help match controls and compare content when layouts use different markup.
  The bundled demo also maps the desktop Products menu to the phone’s navigation drawer.
- **Difference report.** Every device is measured against a reference device. Click a finding to outline
  the elements in the preview.
- **Sync log.** Shows which devices matched, skipped, or could not reach a control.

### What the report catches

| Category | Examples |
|---|---|
| Layout | Page scrolls sideways, side-by-side blocks that stack, text touching the screen edge |
| Navigation | Nav collapses behind a menu button, or items that vanish with no way to reach them |
| Content | Text and controls hidden on smaller screens, cut-off text |
| Images | Changed shape, stretched or broken images |
| Typography | Type scale changes, text under 12px |
| Tables | Tables wider than the screen, tables that need a sideways swipe |
| Input | Tap targets under 24px and 40px |
| Usability | Overlays that sit on top of buttons (cookie banners), missing viewport tag |

## Install

Samestate is a Chrome extension. No server and no terminal.

1. Download this repo (**Code → Download ZIP**) and unzip it.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `extension` folder **inside** the unzipped repo
   (the one that contains `manifest.json`), not the repo's top-level folder.
5. Pin the Samestate icon from the puzzle-piece menu.

Click the Samestate icon to open the preview tab. It starts with `claude.com` on every screen. To preview
another site, enter its address and grant Chrome access to that site. The **Demo** button plays a short guided demo.

## Chrome extension privacy

Samestate uses element structure, visibility, and layout measurements to produce its reports. **Match visible text**
is off when you open a preview. When enabled, the preview reads rendered text locally and uses temporary
fingerprints for comparison. Raw page text stays out of the report and sync log. Visible text can contain
personal data. Mark elements with `data-samestate-private` to exclude their text from matching.

Form fields, editable regions, page titles, cookies, and site storage are excluded from inspection. Form input
and in-page navigation stay in the device where you use them. Samestate scopes inspection to the site you open
in its preview tab. Live previews start with separate, temporary browser storage and do not reuse existing sign-ins.

## How it works

```
extension/
  background.js   Lets the selected origin load inside a Samestate tab and injects the agent
                  into its preview frames.
  agent.js        Measures layout and mirrors interactions using element positions and control types.
  app.html/js/css The device wall, the message router, the sync log and the difference engine.
  demo/           The sample site used by the guided demo.
docs/             The same app as a static page for the live demo (GitHub Pages).
```

## Known limits

- Clicks and report comparisons can miss matches when a site uses different markup and text across screen sizes.
- Device frames have the device's size but send your browser's own user-agent. Sites that pick a
  mobile layout on the server by user-agent will show desktop markup.
- CSS `hover` / `pointer` media queries and device pixel ratio report your real computer.
- Security headers are removed inside Samestate tabs so pages can be framed. Use those tabs for
  previewing, not for sensitive browsing. Other tabs are untouched.

## Roadmap

- Screenshot all devices in one click
- Chrome Web Store listing
- Per-device user-agent in the extension
- Group identical findings across devices

## Release Notes

Each change has a file in [`changelogs/`](changelogs/) with the details.

| Date | Commits | Feature / Update |
|------|---------|-----------------:|
| **2026-11-12** | — | **Free placement** — drag a screen by its title bar to any spot on the wall, such as a phone between two laptops; Grid or Row returns to the automatic layout, and Lock layout keeps the arrangement ([details](changelogs/CHANGELOG-free-placement.md)) |
| **2026-11-12** | `86b6a1d` | **Default site** — Samestate opens `claude.com` on every screen at start-up, with access built into the manifest; the guided demo moves to the Demo button ([details](changelogs/CHANGELOG-default-site.md)) |
| **2026-11-12** | `d14d868` | **Arrange screens** — drag a screen by its title bar onto another to move it, and lock the layout so it stays put; the arrangement resets when the Samestate tab is reopened ([details](changelogs/CHANGELOG-arrange-screens.md)) |
| **2026-11-12** | `d14d868` | **Device pointers** — phone and tablet screens show a fingertip circle instead of the mouse arrow; desktop and MacBook screens show a white mouse arrow ([details](changelogs/CHANGELOG-touch-pointer.md)) |
| **2026-11-12** | `0185838` | **Changelog setup** — one `changelogs/CHANGELOG-<topic>.md` per change, a pre-commit hook and a CI check that require one for code changes, and this table ([details](changelogs/CHANGELOG-changelog-setup.md)) |
| **2026-11-12** | `f631c39` | **Demo sandbox warning** — the bundled demo frame loads without a sandbox, which Chrome warned could not isolate a same-origin page; real sites keep it ([details](changelogs/CHANGELOG-demo-sandbox.md)) |
| **2026-11-12** | `f631c39` | **Twin control matching** — a control the site renders twice (desktop bar and mobile bar) is paired by its attributes, so a day/night toggle clicked on a phone reaches the desktops; toggles already in the target state are skipped ([details](changelogs/CHANGELOG-twin-control-matching.md)) |
| **2026-11-12** | `f631c39` | **Align screens** — one button brings every linked screen to the page and scroll position of the screen used last; a link toggle on each screen chooses which screens move together ([details](changelogs/CHANGELOG-align-screens.md)) |
| **2026-11-12** | `f631c39` | **Redirect follow** — a site that redirects to another hostname (`example.com` → `www.example.com`) reopens there instead of showing blank frames ([details](changelogs/CHANGELOG-redirect-follow.md)) |
| **2026-11-12** | `f631c39` | **Per-site access** — the extension asks Chrome for one site at a time instead of all sites, limits header removal and inspection to that site, and matches controls by page structure with optional visible-text matching ([details](changelogs/CHANGELOG-per-site-access.md)) |
| **2026-11-12** | `35d7207` | **Node server removed** — dropped the optional local proxy, whose `/api/open` endpoint accepted requests from any web page ([details](changelogs/CHANGELOG-remove-node-server.md)) |
| **2026-11-12** | `42fc89c` | **Contributing guide** added |
| **2026-11-12** | `a264396` | **README** — screenshots, and which folder to load in Chrome |
| **2026-11-11** | `63cb071` | **First release** |

## License

MIT © Souvik Palit
