# Long Text — Text a Third Longer, as Translations Are

- **Compare → Long text (+35%)** (`#long-text`) lengthens every text node in every preview by about 35%, with accented vowels (`setLongText()` in `agent.js`)
- Form fields, editable regions, `data-samestate-private`, scripts and styles are left alone (the same `privateContent` list as text matching)
- Turning it off puts every changed text node back
- The setting travels in the `config` message (`longText`), so pages that load later in a preview get it too

---

## Summary
Find what breaks in other languages without translating the site: run Detect differences with long text on.

---

## 1. Long text
**Files:** `extension/agent.js`, `extension/app.js`, `extension/app.html`, `docs/index.html`
**What:** A tree walker keeps each text node's original text and appends filler words (`lörem ipsüm…`) so the line can still wrap.
**Impact:** Cut-off text and sideways scrolling show up before translators find them.

---

## Testing
- In the web demo (`docs/`, served locally) in the Browser pane: the heading became "Nümbérs thát éxpláîn thémsélvés lörem ipsüm" and went back exactly; with it on, Text cut off and Page scrolls sideways appeared on the four phones
- `node tests/smoke.mjs`: 34/34 checks passed, 0 page errors (6 new checks after the tour)
- Not run by hand in the installed extension; the extension path was run headless through `tools/samestate-ci.mjs`

---

## Files Changed (4 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | +18 | `setLongText()` |
| `extension/app.js` | +6 | Toggle, config |
| `extension/app.html` | +1 | Checkbox |
| `docs/*` | same | Copies |
