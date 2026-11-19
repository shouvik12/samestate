# Demo narration

These are finished natural AI voice clips generated with Kokoro v1.0, using the stock `af_heart` voice at normal speed. Playback only reads the bundled MP3 files.

- 46 clips match the current web-demo explanations.
- `that-is-the-tour-extension.mp3` supplies the extension-specific closing explanation.
- `manifest.js` maps step titles to files, captions, spoken text and duration. Titles keep the mapping stable when steps move.
- Each build includes about 4.6 MB of mono, 64 kbps MP3 audio, normalized to a consistent narration level.

The [Kokoro model](https://huggingface.co/hexgrad/Kokoro-82M) is published under Apache 2.0. The build-only [kokoro-onnx runner](https://github.com/thewh1teagle/kokoro-onnx) is MIT licensed. Model weights and the synthesis runtime are not distributed with Samestate.

To regenerate, use an isolated Python environment with `kokoro-onnx` and `soundfile`, the official Kokoro v1.0 ONNX model and voices, and ffmpeg:

```sh
python tools/build-demo-narration.py --model /path/to/kokoro-v1.0.onnx --voices /path/to/voices-v1.0.bin
```

`tools/demo-narration.json` contains the narration source captions exported from the 46-step demo. Update it when a caption changes; `tests/tour-voice.mjs` verifies the match against the live steps. The generator writes the MP3 files and manifest into both builds. No credentials or network access are needed for generation once the model is downloaded, or for narration playback.
