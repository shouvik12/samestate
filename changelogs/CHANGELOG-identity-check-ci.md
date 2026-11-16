# Identity Check on CI — Desktop Compared with Its Own Browser

- `tests/smoke.mjs`: the guided demo's **Device identity** check no longer expects the Desktop preview to have a mouse. It now checks that Desktop matches the browser it runs in: the same user-agent, touch points, and `hover` and `pointer` media queries
- The check's message shows Desktop's `(hover: none)` and `(pointer: coarse)` results

---

## Summary
The smoke test failed on GitHub on every run since November 14, always at step 6, **Device identity**, with "Desktop unchanged: false". GitHub's Linux runners have no pointing device, so Chrome reports `(hover: none)` for every page there, including the real Desktop preview. The extension was right; the check assumed a mouse.

---

## 1. Desktop Check
**Files:** `tests/smoke.mjs`
**What:** `deskOk` compared `(hover: none)` with `false`. It now compares the Desktop frame's `(hover: none)`, `(pointer: coarse)`, `navigator.userAgent` and `navigator.maxTouchPoints` with the Samestate page's own, which phone and tablet identity never changes.
**Impact:** The check still fails if phone or tablet identity leaks into the Desktop preview, and passes on machines with or without a mouse.

---

## Testing
- `node tests/smoke.mjs` on macOS: 37/37 checks passed, 0 page errors; step 6 reported "hover none, coarse: false,false"
- GitHub's smoke test on this change's pull request: see the pull request
