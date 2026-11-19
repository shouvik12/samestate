# Search Tools — A single lookup for tools and features

- Add a visible **Search tools** button; keep ⌘K / Ctrl+K as the keyboard entry to the same lookup.
- Expand the command catalog to include panels, sidebar controls, settings, themes, debug tools, simulators, reference-screen design overlays, test/AI setup, report exports, baselines and the newer inspection/check workflows.
- Add descriptions, searchable aliases, purpose phrases, light typo tolerance and category filtering; exact names rank first.
- Show every matching result in the scrollable list instead of truncating at 60.
- Keep unavailable tools discoverable with a reason; recheck availability before activation and explain a blocked action without running it.
- Support arrow selection, Enter, Escape and focus restoration, with live result counts and accessible active-result state.
- Index controls without reading API-key or text-field values; searching makes no AI request.
- Fix opening closed drawers through search and preserve the single-screen design-overlay action.
- Add metadata refresh and richer metadata aliases so a tester can find its overview by name or purpose.
- Mirror extension/demo markup, styling and scripts; document the workflow and add targeted Chrome UI acceptance checks.

---

## Summary

One lookup now helps testers find Samestate features without remembering which drawer, panel or menu holds them. Results explain the feature and its current requirements, then open or run the existing control when available.

## 1. Catalog and search
**Files:** `extension/app.js`, `docs/app.js`.
**What:** Rebuild the catalog from explicit feature entries, all debug/simulator definitions and current sidebar/panel controls. Add normalized names, aliases, descriptions, purpose-word matching, one-edit typo tolerance and categories. Remove the 60-result cap. Preserve exact simulator-name priority.
**Impact:** Metadata, measurement, AI setup, captures, exports, themes and less visible tools are discoverable from the same entry point, including currently unavailable features.

## 2. UI and activation
**Files:** `extension/app.html`, `docs/index.html`, `extension/app.css`, `docs/app.css`, `extension/app.js`, `docs/app.js`.
**What:** Add the toolbar trigger and improve the command dialog with a heading, close button, category selector, counts, descriptions and availability messages. Keep keyboard selection and focus restoration. Recheck availability before acting; open the relevant panel or drawer before using its control. The command executes from the selecting gesture, preserving existing permission and test-confirmation flows.
**Impact:** Testers can use either the visible button or the shortcut. A blocked control explains what is needed and performs no action. Search itself does not send requests to an AI service or inspect stored field values.

## Testing

- `node tests/tool-search.mjs`: **23/23 passed**, zero page errors. Covers the full catalog, purpose/alias/typo search, exact ranking, category filtering, blocked actions, empty results, keyboard selection and execution, Meta/drawer/AI setup routes, all debug definitions, exports, reference-screen tools, sync discovery, field-value exclusions, shortcut/Escape and focus restoration.
- Confirmed the live local demo in the in-app browser: **Search tools** opens the lookup and “meta” returns the Meta overview and metadata-refresh actions with descriptions. The tested default state indexed 257 entries; the catalog is rebuilt from current UI state.
- Inspected desktop and narrow live-browser screenshots. Syntax, HTML IDs/script paths, extension/demo copies and whitespace checked before delivery.
- No real AI service call or capture permission was requested during search testing. Existing action-specific permissions and confirmations still apply when a user runs those actions.

## Files Changed (9 total)

| Files | Change |
|---|---|
| `extension/app.js`, `docs/app.js` | Catalog, ranking, routing and activation |
| `extension/app.html`, `docs/index.html` | Toolbar button and lookup dialog |
| `extension/app.css`, `docs/app.css` | Search layout, descriptions and states |
| `tests/tool-search.mjs` | Targeted UI acceptance suite |
| `README.md` | Usage and release note |
| `changelogs/CHANGELOG-tool-search.md` | This change record |
