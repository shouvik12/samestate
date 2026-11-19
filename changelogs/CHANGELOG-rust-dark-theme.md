# Samestate Rust dark mode

Replace Samestate's default blue dark palette with Rust: deeper red/orange Rust surfaces, the original blue accents, warm light text and matching borders and shadows. Samestate's dark device bezels also use a red-tinted near-black.

The existing **Samestate** picker entry and saved theme ID continue to work. Day mode, the other interface palettes and report severity colors keep their existing values.

Update both extension and web-demo styles and version the stylesheet URL so an existing browser loads the palette after refresh.

The surface palette is shifted toward deeper red/orange after the first brown version appeared copper-like. The original blue accent tokens remain unchanged.

## Verification

- Confirmed the running local app renders Samestate dark with Rust surfaces and the original blue accents. Switched to day mode and Clean Green and checked their rendered colors.
- Restored the original accent tokens: `--acc: #6ea8ff` and `--on-acc: #10203f`.
- Extension/demo CSS and HTML copies match; `git diff --check` passes.
