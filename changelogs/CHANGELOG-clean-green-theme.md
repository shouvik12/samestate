# Clean Green theme

Add the supplied [Clean Green theme](https://tweakcn.com/r/themes/cmqcc0ezq000604l829v82n75) to Samestate's existing CSS theme system.

- Choose **Clean Green** from the interface theme picker. Both day and night modes use the supplied palette, radius, tracking and shadows. Existing theme and mode persistence applies to this choice too.
- Bundle Latin variable Inter and JetBrains Mono WOFF2 files locally, with their SIL Open Font License files. Georgia remains the system serif fallback. No runtime font request to Google is needed.
- Scope the new styling to Clean Green, retaining Samestate's existing severity colors and device chrome. Adapt the supplied complete shadow token separately from Samestate's shadow-color token.
- Include **Clean Green** in the preview Theme drawer. Its color/radius palette is bundled, so selecting it does not require a registry request. The preview CSS whitelist remains unchanged; interface fonts do not change the inspected site's fonts.
- Keep the extension and web demo assets identical. Version the changed script URLs so an existing open demo picks up the new theme option after reload.
- Update the existing smoke check to recognize the added theme without hard-coding the previous count.

## Verification

- Checked the live local app in the browser: Clean Green appears in both pickers; day/night interface colors and typography render; the saved interface theme/mode survives reload; switching to Samestate restores its original font and colors.
- Applied the built-in preset to all seven demo previews. Checked the rendered background and text colors in the iPhone preview for both light and dark palettes.
- JavaScript syntax, local font assets, matching extension/demo copies and whitespace checked before delivery.

Samestate is a plain JavaScript/CSS app, so the provided Next.js layout and Tailwind directives are adapted into its existing theme controls. Its app title and framework stay intact.
