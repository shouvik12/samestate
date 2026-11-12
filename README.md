<h1 align="center">Samestate</h1>
<p align="center"><b>One interaction, every device.</b><br>
Click once. Every screen size follows to the same state, even when the layouts are completely different.</p>

<p align="center">
  <a href="https://shouvik12.github.io/samestate/"><b>▶ Live demo</b></a> ·
  <a href="#install">Install the Chrome extension</a> ·
  <a href="#how-it-works">How it works</a>
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

Click the Samestate icon to open the preview tab. Enter the site address and grant Chrome access to that site.
The first run plays a short guided demo. **Skip demo** opens the address field for your own site.

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

## License

MIT © Souvik Palit
