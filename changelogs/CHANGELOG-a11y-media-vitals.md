# Accessibility, Media and Web Vitals — Checks in the report and Screen settings

- **Screen settings** add *Default and reduced motion*, *Default and more contrast* and *Screen and print styles*: every second screen gets `prefers-reduced-motion: reduce`, `prefers-contrast: more` or the `print` media type, by rewriting the page's media rules (`REWRITES` in `agent.js`, generalising the old `forceScheme()`)
- **Vision** group in Screen settings: protanopia, deuteranopia, tritanopia (SVG `feColorMatrix` filters in `app.html`), no color (`grayscale`) and blurred vision (`blur`), set on the preview's iframe (`visionFilter()`, `VISION` in `app.js`)
- New **Accessibility** findings: *Low contrast text* (WCAG AA, 4.5:1 or 3:1 for large text; issue below 3:1 or 2:1), *Images without alt text*, *Controls without a name*, *No main heading*, *Heading levels skip*, *Page has no language*, *Zoom is turned off* (touch screens)
- Contrast is measured against the backgrounds painted under the text (`contrastOf()`), with colors read back through a 1px canvas so `oklch()` and `color-mix()` work; text over images, video, gradients and background images is skipped
- New **Performance** category: a *Web Vitals* row per screen (LCP, CLS, slowest interaction) with the shifted elements outlined, *Layout shifts* (CLS over 0.1, issue over 0.25) and *Slow interaction* (INP over 200 ms, issue over 500 ms); LCP is shown but never flagged
- Layout shifts and interactions within 800 ms of a message from Samestate (a mirrored click, a setting, a fix) are left out (`quietUntil`)
- **Compare → Check links** (off by default): `detect()` passes `links: true` to `snapshot`; each screen HEAD-requests up to 60 same-origin links without cookies and reports 404, 410 and 5xx as *Broken links* (Navigation), with action-like paths (sign out, delete…) skipped
- `tools/samestate-ci.mjs --links` turns the link check on in CI
- Width sweeps leave out Performance findings, as they already left out Network
- Privacy page and README describe the link check's requests
- Fixed: broken links that differ only in their query string are listed once, with all their anchors outlined
- Fixed: a layout shift near a preview's first config message was dropped; config now starts the quiet time only when it changes the page (`lastLook`)
- Fixed: a preview Chrome was not drawing (out of view, mostly in headless CI) read CLS 0.00; it now reads "not measured" (`drawn` from a `requestAnimationFrame` probe)
- Fixed: a baseline saved with Check links on no longer counts every broken link as fixed in a scan without it, in the app (`lastScan.links`) and in CI

---

## Summary
Adds checks that fit Samestate's "every second screen" and difference-report model: more media emulation, color-vision previews, content accessibility checks, Web Vitals and a broken-link check.

---

## 1. Media emulation
**Files:** `extension/agent.js`, `extension/app.js`, `extension/app.html`
**What:** `setVariant()` now takes any key of `REWRITES`. Feature queries are rewritten to `(min-width: 0px)` or `(max-width: 0px)`; media types are rewritten per query by `printQuery()` (`print` → `all`, `screen` → `not all`, negations flipped).
**Impact:** Animations, high-contrast styles and print stylesheets can be compared side by side with the default.

## 2. Vision filters
**Files:** `extension/app.js`, `extension/app.html`, `extension/app.css`
**What:** Five new Screen settings apply a CSS filter to every second preview's iframe in `layout()` and `applyScreenSettings()`.
**Impact:** Shows which states rely on color alone; filters appear in screenshots and recordings.

## 3. Accessibility checks
**Files:** `extension/agent.js`, `extension/app.js`
**What:** `snapshot()` adds `contrast`/`large` to visible text items, `unnamed` to controls (`hasName()`), `noAlt` to images, and `lang`/`zoomBlocked` to the page. `analyze()` turns them into findings.
**Impact:** The Accessibility category covers the WCAG problems testers check most, per screen size.

## 4. Web Vitals
**Files:** `extension/agent.js`, `extension/app.js`
**What:** `PerformanceObserver`s for `largest-contentful-paint`, `layout-shift` (largest 5 s session window) and `event` (duration ≥ 40 ms) feed `vitals`, returned with the snapshot along with keys for the shifted elements.
**Impact:** Shows when a layout shifts on phones but not on the desktop. LCP is informational: previews load at once and off-screen ones paint late, so it read 6 s on a local static page.

## 5. Link check
**Files:** `extension/agent.js`, `extension/app.js`, `extension/app.html`, `tools/samestate-ci.mjs`, `docs/privacy.html`
**What:** `checkLinks()` with 6 parallel HEAD requests, a 5 s budget, `credentials: 'omit'` and a per-page cache; 401/403/405/501 are not judged. Snapshot timeout rises to 9 s while it runs.
**Impact:** Finds dead links on each screen, including links that only phones show.

---

## Testing
- `node tests/smoke.mjs`: 37/37 checks passed, 0 page errors
- In the web demo (`docs/`, served locally) in the Browser pane: the sample site gives no new Accessibility issues; after adding pale text, an image without alt, an icon-only button, a link to a missing page, a "Log out" link, an h2 → h4 jump, no `lang` and `user-scalable=no` to one preview, each produced its finding (contrast 1.9:1, broken link 404) and the Log out link was skipped
- Screen settings checked with injected media rules: reduced motion (with and without a value), more contrast, print (`print` on, `screen` and `not print` off) applied to every second screen and were undone when switched back; the protanopia filter shows on the preview
- `tools/samestate-ci.mjs https://shouvik12.github.io/samestate/demo/` with and without `--links` (extension path, headless): Web Vitals rows on every screen, Accessibility only the existing hidden-control warnings. One earlier run had the iPhone preview on GitHub's 404 page; two reruns with the new code, with and without `--links`, loaded it correctly
- Second pass, on a local test site with a good and a bad page and a server that logs every request:
  - All 13 Screen settings reach every second screen only, switch from one to another with nothing left over, survive a preview reload and a rotate; print matches `print`, `not screen and …` and `print, (…)` lists; protanopia turns red olive and leaves blue
  - Contrast flags 1.6:1 (oklch), 2.3:1 and 3.0:1 normal text, passes 3.0:1 large text, skips text over an image and a gradient, and in dark mode flags the dark headings instead of the grey text; alt, name, heading, language and zoom checks hit exactly the planted elements; the good page has none
  - CLS caught on every screen of the bad page, 0.00 on the good page and after Long text and 200% text; a real click on a 350 ms handler read 448 ms on that screen only
  - Link check: 49 HEAD requests, none with the page's cookie; log out, delete, unsubscribe, download, external and `#` links never requested; 403 and HEAD 501 not reported; second scan served from the cache
  - Through the extension with `tools/samestate-ci.mjs --links --sweep`: same findings, no Performance in the width sweep; three runs gave identical CLS; exit code 1 with issues
- Not tested by hand in the installed extension, and not on a large real-world site

---

## Files Changed

| File | Type |
|------|------|
| `extension/agent.js` | Media rewrites, contrast, names, alt, Web Vitals, link check |
| `extension/app.js` | Settings, vision filters, findings, Performance category |
| `extension/app.html`, `docs/index.html` | Options, Check links, SVG filters |
| `extension/app.css` | Hidden filter SVG |
| `tools/samestate-ci.mjs` | `--links` |
| `docs/privacy.html`, `README.md` | Docs |
| `docs/agent.js`, `docs/app.js`, `docs/app.css` | Copies |
