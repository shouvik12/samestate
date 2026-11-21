# Release 0.2.0 — Chrome Web Store Update

- Version 0.1.3 → 0.2.0, minimum Chrome 111
- New permission: `activeTab`, so clicking the toolbar icon opens the current page in Samestate with your sign-ins
- Difference report: Network category, accessibility checks (hidden controls, Tab order), key controls below the fold, page HTTP errors
- Width sweep from 320 to 1920px, saved baselines with new and fixed findings, preview of suggested CSS fixes on every screen
- Test runs: record a journey and replay it on every screen, or write one with AI (OpenRouter or any OpenAI-compatible service, your own key)
- Screen settings: light and dark, 200% text, orientation; long text mode; device user-agent sent to the server
- Capture: auto screenshots with a pace setting, recording frame rate, 10 MB parts and a save folder
- Interface themes with day and night mode, plus tweakcn presets
- Voiced guided demo with a narrated intro and Start demo button; voice help and hover help icons on every control

---

## Summary
Packages everything since the 0.1.3 store release (Nov 14) as 0.2.0 for the Chrome Web Store.

---

## Files Changed (2 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/manifest.json` | 1 | Config |
| `changelogs/CHANGELOG-release-0.2.0.md` | new | Changelog |
