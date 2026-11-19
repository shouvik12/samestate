# Preview Tools — Meta, console, breakpoints, overlays, command bar, forms, live reload, capture

- **Report — Meta** (reference screen only): no title / title over 60 characters, no or long or short description, missing social card tags, relative `og:image`, no `og:image:alt`, no canonical, no favicon link, `noindex`, no charset, duplicate meta tags, invalid JSON-LD (`pageMeta()`, `metaFindings()`)
- **Report — Accessibility and Usability**: no or repeated main landmark, repeated banner/contentinfo, unlabelled navigation landmarks, vague link text ("click here"), the same link text for different pages, fields labelled only by a placeholder, unknown `autocomplete` values, positive `tabindex` (`outlineFacts()`)
- **Report — Typography**: paragraphs with lines over 80 characters (`charsPerLine()`, WCAG 1.4.8)
- **Report — Errors**: JavaScript errors and files that failed to load, including failures from before Samestate's script started (resource timing `responseStatus`, `errorsNow()`)
- **Meta panel**: title, description, canonical, language, robots, theme color, manifest, Apple touch icon, structured data, the meta checks, and Google, X, Facebook, LinkedIn, Slack, Discord and WhatsApp previews in light or dark
- **Console panel**: console messages and errors from every screen, once each, with the screens that sent them and a level filter; `console.js` (new, page world, registered with `emulate.js`) forwards them in the extension; the web demo installs the same forwarding in `agent.js`
- **Breakpoints** (Views): reads min-width/max-width and range-syntax breakpoints in px, em and rem from readable stylesheets and opens one screen per breakpoint, optionally with the width just below each; **Back to my devices** restores the selection
- **Screen settings**: forced-colors styles, reduced data, reduced transparency, wide color (P3), right-to-left, another page language (with a language field)
- **Debug tools**: Rulers and guides (click a ruler to add or remove a guide), Column grid and Baseline grid with **Grid settings…**, Measure area, Peek (hold Alt; lights the same element on the other screens), Readability (ARI grade per paragraph), Measure text (selected text's characters, words, sentences)
- **Debug actions**: Design overlay… (per screen: 1×/2×/3×, opacity, normal/difference/invert, split, offsets; kept across reloads; not counted as an image), Fill forms with test data, Fill forms with edge cases, Clear forms
- **Find elements** drawer (⌘⇧F / Ctrl+Shift+F): CSS selector on every screen, counts per screen, next/previous
- **Command bar** (⌘K / Ctrl+K): every action, debug tool, simulator, Screen setting, panel and drawer, ranked by exact name first
- **Sync → Typing & form fields** (off by default): typed values, selects and checkboxes reach the same field on the other screens, found by place in the page or by name (`fieldTarget()`); never passwords, file fields or `data-samestate-private`; values are set without moving focus
- **Sync → Live reload**: every 5/10/30/60 seconds, or when the site changes (local sites only): fingerprints of the page, stylesheets and scripts every 1.5 s; CSS-only changes swap stylesheets in place, other changes reload every screen; navigation is not a change; pages whose HTML changes on every load fall back to watching CSS and JS
- **Capture**: Full page (scrolls one screen and stitches it; fixed and sticky elements only in the first screenful), Overview (every screen on one sheet), and PNG, JPEG or PDF for every screenshot (`saveCanvas()`, `pdfFromJpeg()`)
- **Workspaces**: Export… and Import… as JSON, with renamed duplicates and the 30-workspace limit
- `ask()` in `app.js`: one request to one preview, answered by rid, with a timeout
- Overlays (rulers, measuring) are ignored by click, hover and touch sync (`own()`)
- Smoke test: Command bar, Find elements and Meta panel checks
- Fixed: the overview could stall after its first screen (re-cropping a live capture) and while setting up the capture; it now captures the wall once, cuts each screen out by position, and the crop target is part of the 8 s time limit

---

## Summary
Adds meta and outline checks, console output, breakpoint previews, layout tools, form tools, live reload, capture formats and workspace import/export.

---

## 1. Report checks
**Files:** `extension/agent.js`, `extension/app.js`
**What:** The snapshot adds `meta`, `outline`, `errors` and per-paragraph `cpl`; `analyze()` turns them into findings in the new **Meta** and **Errors** categories and in Accessibility, Usability and Typography. Width sweeps leave out Meta, Errors, Network and Performance.
**Impact:** The report covers meta and page-outline checks per screen size.

## 2. Panels
**Files:** `extension/app.js`, `extension/app.html`, `extension/app.css`, `extension/console.js`, `extension/background.js`
**What:** Two new tabs in the right panel; `showTab()` now works for any pane. `background.js` registers `console.js` next to `emulate.js`; it exits unless it runs in a frame of a `chrome-extension://` top page.
**Impact:** Errors that happen on one screen size only are visible.

## 3. Overlays, tools and actions
**Files:** `extension/agent.js`, `extension/app.js`, `extension/app.html`
**What:** New tool ids in `DEBUG_TOOLS` and `DEBUG_MENU`; `drawRulers()`, `drawGrids()`, `drawMeasure()`, `drawReadability()`, Peek and selection measuring; `setDesign()` draws a `samestate-design` element outside the layer so `mix-blend-mode` works; `fillForms()`.

## 4. Breakpoints, find, command bar, sync, live reload
**Files:** `extension/agent.js`, `extension/app.js`, `extension/app.html`
**What:** `cssBreakpoints()`, `openBreakpoints()` (temporary devices), `findElements()`, `commands()`, `applyField()`, `siteFingerprint()` / `pollSite()`.

## 5. Capture and workspaces
**Files:** `extension/capture.js`, `extension/workspaces.js`
**What:** Full page and overview use Focus mode one screen at a time; PDF is a one-page file holding the JPEG.

---

## Testing
- `node tests/smoke.mjs`: 42/42 checks passed, 0 page errors (three new checks: Command bar, Find elements, Meta panel)
- Web demo served locally, in the Browser pane, on test pages built for this:
  - Report: 17 new findings on a page with planted problems (no main, two unlabelled navs, "click here" and "read more", placeholder-only field, `autocomplete="emial"`, `tabindex=3`, an 80-character title, a 10-character description, a relative og:image, noindex, a duplicate description, invalid JSON-LD, a thrown error, a 404 script); long lines on desktop but not on the phone; Meta findings on the reference screen only
  - Console: the thrown error once with all 7 screens, a live `console.log` from one screen, the level filter; Meta: rows, 10 checks, 7 social previews with the og:image
  - Screen settings: each new setting reached every second screen and was undone; changing the language field re-applied
  - Breakpoints: 640, 768 (from 48em), 1024 (from max-width 1023px) and 1280; with edges, 9 screens at exactly those widths; back to the 7 devices
  - Debug: guide added at 300px by a ruler click without moving other screens; column grid with 4 columns from Grid settings; baseline; a 200 × 100 measured box; Peek on the h1 with its twin lit on 6 of 6 other screens; readability grades 2 and 15; 40 characters · 6 words · 1 sentence
  - Forms: valid, edge-case and clear fills on one screen or 7 of 7; typed values from one screen reached the other 6 with a checkbox, never the password, and nothing with the toggle off
  - Find: 3 matches on each screen, next match, invalid selector, no matches; design overlay at 2×, difference, 0.8, split 30%, kept after reload, not in the report, removed; command bar ranked "Simulator: Night mode" first and ran it
  - Live reload: no reloads on an unchanged site; a stylesheet edit swapped on 7 of 7 screens with no reload; an HTML edit reloaded every screen once and then stayed quiet; the timer reloaded twice in 11 s; a non-local site was refused for "when it changes"
  - Workspaces: empty export refused, export of 2, re-import as "(2)" copies, invalid and empty files refused
- Headless Chrome with tab capture auto-accepted (scratch script on the smoke test's launcher): full page PNG 276 × 2377, JPEG and PDF; overview of 7 screens as PNG and PDF (2836 × 508); PDFs open with `%PDF-1.4` … `%%EOF`
- Fixed during testing: early failed loads not caught; "name" fields not filled with a name; typing sync used the click matcher, which skips fields; command bar ranking; live reload could loop on pages that change every load; overview stalled after the first screen and on a session's first capture
- Not tested by hand in the installed extension

---

## Files Changed

| File | Type |
|------|------|
| `extension/agent.js` | Facts, overlays, design, find, autofill, field sync, breakpoints, fingerprints, page size |
| `extension/app.js` | Report checks, panels, breakpoints, settings, menus, design, find, command bar, live reload |
| `extension/app.html`, `docs/index.html` | Tabs, capture options, workspace export, breakpoints, settings, live reload, find, dialogs |
| `extension/app.css` | Panels, cards, command bar, dialogs |
| `extension/capture.js` | Full page, overview, formats |
| `extension/workspaces.js` | Export and import |
| `extension/console.js` (new), `extension/background.js` | Console forwarding |
| `tests/smoke.mjs` | Three checks |
| `README.md`, `docs/privacy.html` | Docs |
| `docs/*.js`, `docs/app.css` | Copies |
