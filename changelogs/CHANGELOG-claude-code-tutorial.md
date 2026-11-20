# Claude Code Tutorial — A 75-Second Video on Using Samestate From Claude Code

- New narrated video, `docs/media/samestate-claude-code.mp4` (1600×900, 75 s): a terminal plays a Claude Code session beside step cards, with captions under the narration.
- Steps: install the plugin (two commands), ask Claude to check a page on iPhone and Desktop, read the report with each element's selector and the usual fix, look at the iPhone screenshot, fix the CSS, check again (4 issues → 2), and the `/samestate:check` skill; it ends on the install commands.
- The tool output is real: the MCP server was run on the sample site, the same CSS fix was applied to a copy, and it was run again. The iPhone image is the `screenshot` tool's. Claude's own sentences between tool calls are written for the video.
- Same Kokoro af_heart voice; the music is the Samestate track (128 BPM) with bars 5–12 played four times, so every cut and line stays on a bar.
- README: a new "Samestate with Claude Code — demo" section near the top shows a play-button thumbnail (`docs/media/claude-code-video.png`, from `promo/tutorial.html?poster`) that opens the video; "Use with Claude Code" in the top links jumps there and has a "75s video" link; the Claude Code section has a Watch it line; `mcp/README.md` links it too.

---

## Summary

A short how-to that shows the whole check, fix, check-again loop.

---

## 1. Video
**Files:** `promo/tutorial.html`, `promo/tutorial.json`, `promo/tutorial/iphone-before.png`
**What:** `render(t)` draws the terminal transcript (typed prompts, tool calls, real results, the diff), step cards, the phone screenshot, captions and the end card from the time alone.

## 2. Soundtrack and rendering
**Files:** `promo/voiceover.py`, `promo/record-motion.mjs`, `tools/store-assets.mjs`, `tools/readme-media.mjs`
**What:** `voiceover.py` builds a longer music bed from `musicLoop` (bar-aligned, with short crossfades) and takes a custom `music` file; `record-motion.mjs --story <file>` renders any story's `page` to its `output` name; the store tile script follows the new frames folder name; `readme-media.mjs` copies the tutorial to `docs/media`.

## 3. Docs
**Files:** `README.md`, `mcp/README.md`, `docs/media/samestate-claude-code.mp4`

---

## Testing
- Video 75.0 s, audio 74.9 s, peak −2.3 dB; every narration line fit its slot
- Stills from all scenes and a full-size frame checked (terminal text readable)
- Before/after reports and the screenshot captured with `mcp/server.mjs` on `docs/` served on localhost
