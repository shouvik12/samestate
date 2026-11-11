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

Samestate opens any page on a wall of devices (phones, tablets, laptops, desktops) and keeps them in the
same **logical** state.

- **Logical sync.** Click "Products" in the desktop nav bar. The phones have no nav bar, so each one opens
  its hamburger drawer, then the Products accordion. Actions are matched by meaning (label, role, link
  target), not by pixel position or DOM path.
- **Everything mirrors.** Clicks, typing, checkboxes, Enter and Escape, hover, navigation, and scrolling by
  section, so devices with different page lengths stay on the same content.
- **Difference report.** Every device is measured against a reference device. Click a finding to outline
  the elements in the preview.
- **Sync log.** Shows how each device reached the same state: `opened "Open navigation" → clicked "Products"`.

### What the report catches

| Category | Examples |
|---|---|
| Layout | Page scrolls sideways, side-by-side blocks that stack, text touching the screen edge |
| Navigation | Nav collapses behind a menu button, or items that vanish with no way to reach them |
| Content | Text and controls hidden on smaller screens, cut-off text |
| Images | Different source file per device, changed shape, stretched or broken images |
| Typography | Type scale changes, font family changes, text under 12px |
| Tables | Tables wider than the screen, tables that need a sideways swipe |
| Input | Tap targets under 24px and 40px, hover-only interactions on touch devices |
| Usability | Overlays that sit on top of buttons (cookie banners), missing viewport tag |

## Install

Samestate is a Chrome extension. No server and no terminal.

1. Download this repo (**Code → Download ZIP**) and unzip it.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `extension` folder **inside** the unzipped repo
   (the one that contains `manifest.json`), not the repo's top-level folder.
5. Pin the Samestate icon from the puzzle-piece menu.

Then go to any page and click the icon. The page opens in a new tab on every device.
The first run plays a short guided demo; **Skip demo** dismisses it.

## How it works

```
extension/
  background.js   For Samestate tabs only: removes frame-blocking response headers on the
                  device frames and injects the agent into each one.
  agent.js        Runs inside every device frame. Describes each real interaction semantically,
                  and on the other devices finds the equivalent control. If that control is
                  hidden, it opens whatever reveals it first (aria-controls, details/summary,
                  accordion buttons, the menu button), then acts.
  app.html/js/css The device wall, the message router, the sync log and the difference engine.
  demo/           The sample site used by the guided demo.
docs/             The same app as a static page for the live demo (GitHub Pages).
server/           Optional Node version: a local proxy that can also clone and run a Git repo
                  or a project folder.  node server/server.js <url | repo | folder>
```

Matching a control across layouts is a score over id, test id, link target, accessible name, role
and position. A control with the same job but a different design (a "Menu" button on one device, a
hamburger icon on another) is matched by role.

## How this differs from other multi-device previews

Most multi-device browsers mirror the *same event on the same element*. That works when every
breakpoint shares its markup. It stops working when the desktop has a nav bar and the phone has a
drawer with separate markup. Samestate is built for that case, and adds a report of what differs.

## Known limits

- Device frames have the device's size but send your browser's own user-agent. Sites that pick a
  mobile layout on the server by user-agent will show desktop markup. (The Node version sends
  per-device user-agents.)
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
