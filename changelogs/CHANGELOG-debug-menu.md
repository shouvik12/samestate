# Debug Menu — Debug tools and simulators, per screen and for every screen

- New bug button (`data-a="debug"`) in every preview's title bar opens that screen's **Debug** menu; a badge shows how many tools and simulators are on
- New **Debug** button in the top bar opens the same menu for every visible screen (`workspaceScreens()`); items on some screens show a dash (`aria-checked="mixed"`) and turn on for all when chosen
- Screens opened later start with what the top-bar menu set (`wallDebug`)
- The menu is a `role=menu` popover with `menuitemcheckbox` tools and `menuitemradio` simulators, group headings, an **i** tooltip per item, arrow keys, Home/End, Escape and outside click to close, and focus back on the button
- 19 debug tools in `agent.js` (`setDebug()`): Layout debugging, Show z-index, Reachability (right or left hand), Contrast checker, Track focus, Target size, Small text, Text spacing (WCAG 1.4.12), Show roles, Show ARIA attributes, Apply all hover styles, Apply all focus-visible styles, Edit content, Hostile CSS, Audible changes, Disable CSS, Disable images, Hide cursor
- Overlay tools draw boxes and labels in a host inside `samestate-layer` (`drawDebug()`), only for elements on screen and at most 400, redrawn on scroll, resize, focus changes and page changes; `requestAnimationFrame` with a timer fallback so they still redraw while frames are paused
- Forced hover and focus-visible copy readable rules with the pseudo-class removed into their own style, keeping `@media`, `@supports` and `@layer` wrappers (`forcedRules()`)
- Disable CSS turns off the page's stylesheets and adopted stylesheets and lifts `style` attributes, and puts them back when turned off (`disableCss()`)
- Audible changes: a `MutationObserver` sends `changed` (at most every 120 ms per screen); the app beeps with an `AudioContext` created on the menu click, each screen in its own pitch
- 20 simulators: protanomaly, deuteranomaly and tritanomaly (new Machado matrices at severity 0.6), protanopia, deuteranopia, tritanopia, achromatomaly, achromatopsia, cataracts, farsightedness, astigmatism horizontal and vertical (new SVG filters), photophobia, bright sunshine, dimmed screen and night mode as filters on the preview (`SIM_FILTER`); glaucoma, tunnel vision, macular degeneration (follow the pointer) and CMV retinitis as overlays in the preview
- `previewFilter()` combines the Screen settings vision filter with the screen's simulator
- `configure()` sends `debug` and `sim`; the agent accepts only known ids, and a change starts the 800 ms layout-shift quiet time
- Smoke test: two new checks (a tool on one screen only; a simulator on every screen)

---

## Summary
Adds debug overlays and simulators on every preview and for the whole wall at once.

---

## 1. Menus
**Files:** `extension/app.js`, `extension/app.html`, `extension/app.css`
**What:** `DEBUG_MENU` describes every item. `openDebugMenu(target, opener)` renders it for one screen or `'all'`; `setTool()` and `setSim()` update `d.debug` / `d.sim` and `wallDebug`, then `applyDebug()` sets the filter and sends the config.
**Impact:** The same menu works for one screen, to compare it with the rest, or for all of them.

## 2. Debug tools
**Files:** `extension/agent.js`
**What:** Style tools are one injected `<style>` (`DEBUG_CSS`); overlay tools reuse `contrastOf()`, `roleOf()`, `nameOf()` and `visible()`; reachability and cursor simulators are fixed overlays in the layer.
**Impact:** Snapshots skip `samestate-layer`, so overlays never become findings: the demo's report had the same 46 findings with six overlay tools on.

## 3. Simulators
**Files:** `extension/app.js`, `extension/app.html`, `extension/agent.js`
**What:** Filters on the iframe in `layout()` and `applyScreenSettings()`; the pointer-following ones are drawn in the preview.
**Impact:** Appear in wall screenshots and recordings.

---

## Testing
- `node tests/smoke.mjs`: 39/39 checks passed, 0 page errors
- In the web demo (served locally) in the Browser pane, on a test page with hover, focus, z-index, overflow, small text, small targets, pale text and a ticking counter:
  - Every tool had its effect on the chosen screen and none on the others, and was undone when turned off (outline, labels, line height 24px, hover colors, focus-visible outline, designMode, hostile fonts, CSS and inline style off and back, images hidden, cursor none)
  - Labels: "+976px" overflow, "z 5" / "z 99", "1.9:1 needs 4.5:1", target sizes with the sentence link left out, "10px" text and a 13.3px field, role and aria labels, "textbox: Field" → "link: Focus link" → "button: Hover me" as focus moved
  - Top-bar menu: Night mode and Layout debugging reached 7 of 7 screens; a change on one screen made both "mixed"; choosing a mixed item turned it on everywhere; a screen opened afterwards started with the same tools and simulator; overlays came back after a preview reload
  - All 20 simulators set their filter or overlay and None cleared every screen; a simulator combined with a Screen settings vision filter; tunnel vision followed the pointer on its screen only; right and left reachability replace each other; audible changes sent 35 change messages in 2 s from 7 screens
  - Arrow keys, End and wrap-around move through the menu; Escape closes it and returns focus to the button
  - Detect differences: 46 findings with and without six overlay tools on
- In the extension (headless, through the CI tool's setup) on the published demo: Text spacing from the top-bar menu grew text height on all 7 screens; turning it off on one screen restored only that one; Dimmed screen set the filter on all 7
- Fixed during testing: Track focus missed focus changes without focus events; overlays stopped redrawing while animation frames were paused; reachability and a cursor simulator could not show together
- Not tested by hand in the installed extension

---

## Files Changed

| File | Type |
|------|------|
| `extension/agent.js` | Debug tools, overlays, cursor simulators |
| `extension/app.js` | Menu, state, simulator filters, beeps |
| `extension/app.html`, `docs/index.html` | Debug button, SVG filters |
| `extension/app.css` | Menu and badge styles |
| `tests/smoke.mjs` | Two checks |
| `README.md` | New section, limits, release notes |
| `docs/agent.js`, `docs/app.js`, `docs/app.css` | Copies |
