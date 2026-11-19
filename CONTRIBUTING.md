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

The live demo lives in `docs/` and is served by GitHub Pages. Copy changed scripts and styles from `extension/` to `docs/` so the two stay identical.

## Testing

`node tests/smoke.mjs` plays the guided demo from `docs/` in headless Chrome and checks what each step did, then checks report export and saved workspaces. It needs Node 22 or later and Chrome, and no packages. Set `CHROME_PATH` if Chrome is not in the usual place, or `SMOKE_HEADED=1` to watch it run. The **Smoke test** check runs it on every pull request.

If you change what a tour step does, update its check in `tests/smoke.mjs` (the checks are keyed by step title).

## Where things are

- `extension/background.js`: header handling and frame injection for Samestate tabs only, the device user-agent for page loads marked `samestate-ua`, and registration of `emulate.js` for the sites those tabs have open
- `extension/emulate.js`: phone and tablet identity inside a preview; it exits at once anywhere else
- `extension/agent.js`: captures interactions and replays them by meaning
- `extension/app.js`, `app.html`, `app.css`: the device wall, sync log, difference engine and guided tour
- `extension/report.js`: report export; `extension/workspaces.js`: saved setups
- `extension/testrun.js`: test runs (recording, test files, running steps on every screen, writing tests with AI)
- `tests/testrun.mjs`: checks test runs in the extension with a stand-in AI service
- `docs/`: the live demo
- `tests/smoke.mjs`: the end-to-end smoke test
- `tools/samestate-ci.mjs`: runs the difference report on any site in headless Chrome, for CI
- `tools/readme-media.mjs`: captures the README screenshots, banner and link card from `docs/`, then publishes the freshly recorded promo and derives its silent GIF
- `tools/media-browser.mjs`: shared headless Chrome capture harness for media tooling
- `promo/`: `showcase.json` defines the eight scenes and narration, `stage.js` drives real app controls, and `banner.html` surrounds the fresh app screenshot with brand text; re-render after visible app changes

### Refreshing the GitHub demos

Use Node 22+, Chrome and ffmpeg. Narration generation additionally needs Python with `kokoro-onnx`, `onnxruntime`, `numpy` and `soundfile`, plus the Kokoro ONNX model and voice pack used by the app’s narration builder. These are build-only dependencies; models and intermediate media stay out of Git.

```sh
python promo/voiceover.py --model /path/to/kokoro-v1.0.onnx --voices /path/to/voices-v1.0.bin
node promo/record.mjs landscape
node tools/readme-media.mjs
```

The first command generates the original music if needed and mixes eight natural AI explanations into the 30-second soundtrack. The recorder prepares each real app state before recording it, so loading time does not consume a scene. It checks measured elements and pending human reviews before producing H.264/AAC video. `portrait` is also accepted by the recorder for a separate vertical export.

Inspect the PNGs in `docs/media/` and the scene captures in `promo/out/`. Check the final video’s sound, 30-second duration and captions before committing. The 15-second GIF is intentionally silent; README links open the narrated video or the 46-step interactive demo. Both public MP4 filenames are refreshed together to preserve existing links.

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

By contributing, you agree your work is released under the repo's Apache 2.0 license.
