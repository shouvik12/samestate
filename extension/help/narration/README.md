# App-wide voiced feature help

This folder contains 473 finished natural AI voice explanations and their generated manifest. The stock Kokoro v1.0 `af_heart` voice matches the guided-demo narrator. Audio uses mono, 64 kbps MP3 files, about 26 MB per build. Individual clips are fetched only when a user chooses **Hear explanation**.

The source descriptions are app metadata in `feature-help-catalog.js`. They cover static controls, settings and sections, plus reusable descriptions for dynamic preview tools, reports, reviews, annotations, workspaces and search results. User field values and website content are not narrated. Search tools uses these descriptions too.

`tools/feature-help.json` is the exported narration script. Regenerate both builds with:

```sh
python tools/build-demo-narration.py --help-catalog tools/feature-help.json --model /path/to/kokoro-v1.0.onnx --voices /path/to/voices-v1.0.bin
```

The build environment needs `kokoro-onnx`, `soundfile` and ffmpeg. The [Kokoro model](https://huggingface.co/hexgrad/Kokoro-82M) is Apache 2.0 licensed; the [build-only runner](https://github.com/thewh1teagle/kokoro-onnx) is MIT licensed. Models and synthesis dependencies are not included in the app.

When changing a description, update its source script and regenerate the audio. `tests/feature-help.mjs` checks every caption against the live catalogue, decodes all audio, and checks dynamic control coverage, keyboard access, modal behaviour and playback.
