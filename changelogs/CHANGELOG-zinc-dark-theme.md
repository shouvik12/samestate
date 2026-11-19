# Samestate Zinc dark mode

Replace the Rust surfaces in Samestate dark mode with Zinc grays: a #18181b canvas, #1c1c20 sidebar, #202024 toolbar, #27272a raised surfaces, #3f3f46 borders, neutral light text and near-black shadows and device bezels.

Retain the original blue accents (`--acc: #6ea8ff`, `--on-acc: #10203f`) and the existing Samestate theme ID. The existing day mode and other themes continue to use their own palettes.

Update the stylesheet version in both builds so a refreshed app loads the new palette. Extension/demo CSS and HTML copies match; whitespace checked before delivery.
