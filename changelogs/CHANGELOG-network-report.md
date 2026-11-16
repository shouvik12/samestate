# Network Report — Page Weight and Unused Downloads per Screen

- Added a **Network** category to the difference report (`CATS` in `app.js`)
- **Page weight** (info): every screen's total download size, request count and API call count (`fetch` and `XMLHttpRequest`), with a note when requests to other sites report no size
- **Downloads as much as Desktop** (warning): a phone or tablet downloads at least 85% of what the desktop reference does, when the reference page is 300 KB or more; lists the largest files
- **Hidden images still downloaded** (warning): images that loaded but have no box on this screen (inside `display: none`), with their size
- **Images larger than shown** (warning): a raster image whose source is over 1.5× the width needed at 3× (phones) or 2× (other screens) and at least 400px wider; SVGs are skipped. Clicking the issue outlines the images
- **Large API responses** (info): API responses over 100 KB, by path
- Repeat requests for one address (video ranges, polling) are merged in the lists, with a request count
- `agent.js`: `snapshot()` now returns `requests` (from `performance.getEntriesByType('navigation' | 'resource')`) and `dpr`; image items carry `src`, `loaded` and `boxed`
- `agent.js`: raises the resource timing buffer to 1500 entries (`performance.setResourceTimingBufferSize`)
- `agent.js`: `requestAddress()` drops query strings and fragments and replaces ID-like path segments (long numbers, hex and UUIDs, tokens, anything with `@`) with `:id`; request and response contents are never read
- The demo's own `agent.js` and `emulate.js` are left out of the demo's page weight
- README: Network row in **What the report catches**, privacy note, two **Known limits**, release notes row
- `docs/privacy.html`: one line on Network findings

---

## Summary
The report now shows what each screen downloads and what it downloads but doesn't use, from the browser's resource timing. It needs no new permission and reads no request or response contents.

---

## 1. Request Collection
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** `requests()` reads the navigation and resource timing entries and returns `{ url, type, bytes }` per request, capped at 800. `bytes` is `encodedBodySize`, falling back to `transferSize`, so a body served from the shared cache still counts. `requestAddress()` keeps the origin and path only, with ID-like segments replaced by `:id`. Image snapshot items gain `src` (same treatment), `loaded` (`complete` with a natural width) and `boxed` (`getClientRects().length > 0`).
**Impact:** Each snapshot carries the page's request list. Addresses in the report and its exports don't include query strings, tokens or user IDs.

## 2. Network Findings
**Files:** `extension/app.js`, `docs/app.js`
**What:** `analyze()` adds four per-screen checks (page weight, large API responses, hidden images still downloaded, images larger than shown) and one check against the reference (downloads as much as the desktop). Helpers: `kb()`, `weight()`, `byAddress()`, `requestPath()`, `fileName()`, `plural()`, `more()`. Requests count as "other sites" when they have no size and a different origin from the page.
**Impact:** A new **Network** chip in the report. Findings group across screens in **By issue** like the other categories and appear in Markdown, CSV and HTML exports.

---

## Testing
- `node tests/smoke.mjs`: 28/28 checks passed, 0 page errors
- In the web demo (`docs/`, served locally): the plain demo shows only **Page weight** on 7 screens (18–19 KB, 5–6 requests); a same-origin video range request with no body is not counted as another site
- With a 2400px PNG shown at 300px, the same PNG inside a `display: none` box and a 148 KB `fetch` injected into every preview: **Images larger than shown**, **Hidden images still downloaded** and **Large API responses** appeared on all 7 screens; the `?user=42` query was not in the reported address
- With three 148 KB fetches per preview: **Downloads as much as Desktop** appeared on the 4 phones and 2 tablets (96%, and 124% on the Nexus 7), with the repeated file merged as "443 KB (3 requests)"
- Not run inside the Chrome extension, and not run on a real third-party site

---

## Files Changed (8 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | +30 −1 | Request collection, image load state |
| `extension/app.js` | +38 −1 | Network category and checks |
| `docs/agent.js`, `docs/app.js` | same | Copies |
| `docs/privacy.html` | +2 −1 | Network line, date |
| `README.md` | +7 | Report table, privacy note, known limits, release notes |
| `changelogs/CHANGELOG-network-report.md` | new | This file |
