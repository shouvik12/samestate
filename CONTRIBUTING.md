# Contributing to Samestate

Thanks for helping. Samestate is small and maintained by one person, so short, focused changes are easiest to review.

## Good first contributions

- **False positives in the difference report.** Run Samestate on a real site, and if a finding is wrong or noisy, open an issue with the site, the device and the finding text.
- **Sync misses.** If a click on one device doesn't reach the others, open **Sync log** and include what it shows (`same`, `matched` or `no match`).
- **v2: fixing issues.** Samestate only reports issues today. Ideas and prototypes for suggesting or previewing fixes are welcome; open an issue first so we can agree on the approach.

## Running it locally

1. Fork and clone the repo.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `extension` folder.
3. After editing a file, click the reload icon on the Samestate card and reopen the Samestate tab.

The live demo lives in `docs/` and is served by GitHub Pages.

## Where things are

- `extension/background.js`: header handling and frame injection for Samestate tabs only
- `extension/agent.js`: captures interactions and replays them by meaning
- `extension/app.js`, `app.html`, `app.css`: the device wall, sync log and difference engine
- `docs/`: the live demo and guided tour

## Pull requests

- One change per PR, with a sentence on what it fixes and how you tested it.
- Include a `changelogs/CHANGELOG-<topic>.md` file (see [Changelogs](#changelogs)).
- For difference-report changes, say which real site you tested on and how the finding count changed.
- Keep it dependency-free; the extension has no build step.
- Don't widen what `background.js` touches: it must only affect Samestate tabs.

## Changelogs

Every code change comes with a short changelog file, `changelogs/CHANGELOG-<topic>.md`, and a row in the **Release Notes** table in the README. The format is in [`.agents/workflows/commit.md`](.agents/workflows/commit.md): a bullet list of what changed, then what, why and which files.

Turn on the local check once after cloning:

```
git config core.hooksPath .githooks
```

It blocks a commit that changes code without a changelog. The **Require changelog** check on GitHub does the same for pull requests. Changes that only touch `.md` or `.txt` files don't need one.

## Reporting a security issue

Samestate removes frame-blocking headers inside its own tabs. If you find a way that affects normal browsing, please email devtv.developers@gmail.com instead of opening a public issue.

## License

By contributing, you agree your work is released under the repo's MIT license.
