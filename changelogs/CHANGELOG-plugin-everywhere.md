# Plugin Everywhere — Demo, Video, How It Works, Media and the Store Listing

- **Demo:** the last step, "That is the tour", now mentions the Claude Code plugin: on the web, "…install the Chrome extension to open any page, or add the Claude Code plugin to run these checks while you code"; in the extension, "…The Claude Code plugin runs these checks while you code." Both voice clips were rebuilt with the same Kokoro af_heart voice; the other 46 were reused.
- **Video:** the motion promo's end card adds "Chrome extension · Claude Code plugin" under the address, in the wide and mobile versions. Same music, words and timing.
- **How it works:** the file list adds `mcp/server.mjs`, `mcp/chrome.mjs`, `.claude-plugin/`, `tests/mcp.mjs` and `store/`, with a paragraph on how the MCP server reuses the extension.
- **Media re-recorded** from the current app: the narrated walkthrough video, the README GIF, the nine screenshots, the banner and the link card.
- **Links refreshed:** every README media link uses the new cache key `?v=20261120-plugin`; the app's script and narration manifest cache keys moved to `plugin-20261120` so the live demo loads the new final step and its voice.
- **Chrome Web Store:** `store/listing.md` has the name, a 121-character summary, category, the full description (including the Claude Code plugin and privacy), image list, promo video note and links. `store/images/` has five 1280×800 screenshots and the 440×280 and 1400×560 promo tiles, built by `node tools/store-assets.mjs`. Publishing them is done by the owner in the Developer Dashboard.

---

## Summary

Every place the README links to now tells people about the Claude Code plugin, and the media matches today's app.

---

## 1. Demo
**Files:** `extension/app.js`, `docs/app.js`, `tools/demo-narration.json`, `extension/demo/narration/*`, `docs/demo/narration/*`, `extension/app.html`, `docs/index.html`
**What:** New captions for the last step in both builds; `that-is-the-tour.mp3` and `that-is-the-tour-extension.mp3` rebuilt with `tools/build-demo-narration.py --reuse-existing`; cache keys bumped.

## 2. Video
**Files:** `promo/motion.html`, `docs/media/samestate-promo.mp4`, `docs/media/samestate-promo-mobile.mp4`
**What:** A `#plat` line on the end card, animated in at 28.75 s; both formats re-rendered.

## 3. README media and links
**Files:** `README.md`, `docs/media/*`
**What:** Re-recorded with `node promo/record.mjs landscape` and `node tools/readme-media.mjs`; How it works extended; cache keys updated.

## 4. Store listing
**Files:** `store/listing.md`, `store/images/*`, `tools/store-assets.mjs`
**What:** Listing text within the store's limits and images at the store's sizes.

---

## Testing
- `node tests/tour-voice.mjs`: 25/25 (captions match narration, all clips decode, both builds identical)
- End card checked in both video formats; README media and store images checked by eye
