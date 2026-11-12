# Device Pointers — Fingertip Circle on Touch Screens, White Arrow on Desktops

- Phone and tablet screens now show a 28px semi-transparent circle instead of the mouse arrow, the way browser device modes do
- Desktop and MacBook screens now show a white arrow with a black outline as their default pointer, whatever the computer's own pointer looks like
- On desktop screens links keep the hand and form fields keep the I-beam; only the plain arrow is replaced
- Both pointers are inline SVG data URLs set as the CSS `cursor`: `FINGER` with its hotspot at the centre (`14 14`), `ARROW` with its hotspot at the tip (`4 2`)
- `applyTouchMode()` now always keeps the `#__samestate_touch` style in the page and switches its content with each device's `touch` setting

---

## Summary
Every screen showed the computer's own mouse pointer, which made phone and tablet previews feel like small desktop windows. Each screen now shows the pointer its device would: a fingertip-sized circle on touch devices and a white mouse arrow on desktops and laptops.

---

## 1. Touch Pointer
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** When `cfg.touch` is true, the injected style sets `html, html *, html *::before, html *::after { cursor: FINGER !important }` next to the existing `user-select` rules.
**Impact:** On phones and tablets the pointer is a grey circle with a light rim, visible on light and dark pages. Links and buttons do not switch to the hand there, as on a real touch device.

## 2. Desktop Pointer
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** When `cfg.touch` is false, the injected style is `html { cursor: ARROW }`. The value is inherited, so elements that set their own cursor (links, buttons styled by the site, inputs) keep it.
**Impact:** Desktop and MacBook screens show a white arrow, so it is clear which screens are mouse devices. Over plain text the arrow is shown instead of the I-beam.

---

## Testing
- Applied both CSS rules on a live page in Chrome: the cursor values were accepted, the hotspots parsed, the circle image loaded at 28×28, and a link kept `cursor: pointer` under the arrow rule
- Rendered the arrow SVG to an image to check its shape
- Not yet confirmed inside the extension's device wall

---

## Files Changed (2 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | ≈ +11 −5 | `FINGER`, `ARROW`, `applyTouchMode()` |
| `docs/agent.js` | ≈ +11 −5 | Copy of `extension/agent.js` |
