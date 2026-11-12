# Redirect Follow — Reopen the Preview Where the Site Redirects

- Added redirect detection in `background.js`: `onBeforeNavigate` records where each preview frame starts, `onCommitted` and `onErrorOccurred` compare it with where the frame lands
- The background worker sends a `redirected` message (`tabId`, `from`, `url`) when a frame starts on the selected origin and ends on another
- Added `followRedirect()` in `app.js`: reopens the preview on the new origin when Chrome access already exists
- When access is missing, the wall closes, the new address is filled into the address bar, and a message asks the user to press Enter
- `open()` takes an `alreadyAllowed` argument so an automatic reopen does not call `chrome.permissions.request` without a user gesture
- Added a limit of three automatic redirect hops per address
- Fixed: typing `example.com` for a site that redirects to `www.example.com` (or from `http` to `https`) left every frame blank with no message

---

## Summary
Chrome access, the header rule and agent injection are all tied to the exact origin the user typed. A site that redirects to another hostname fell outside all three. The extension now notices the redirect and moves the preview to the final origin.

---

## 1. Redirect Detection
**Files:** `extension/background.js`
**What:** A `started` map keyed by `tabId:frameId` holds the URL from `webNavigation.onBeforeNavigate` for direct child frames. `takeStart()` reads and clears it when the navigation commits or fails. `reportRedirect()` sends the message only if the start URL was on the registered origin and the final URL is an `http(s)` URL on a different one. Entries are cleared when the tab closes.
**Impact:** Covers both a redirect that loads and one whose target refuses to be framed. Stays silent for normal loads, external links clicked inside a preview, site-down errors, nested frames and tabs that are not Samestate previews.

## 2. Following the Redirect
**Files:** `extension/app.js`, `docs/app.js`
**What:** A `chrome.runtime.onMessage` listener passes `redirected` messages to `followRedirect()`, which acts only for its own tab and only when `from` equals the preview's first URL. All device frames report the same redirect, so `redirectHandled` makes it act once per open.
**Impact:** Sites with an apex-to-`www` or `http`-to-`https` redirect load after at most one extra Enter and one access prompt. A link inside a preview that redirects elsewhere does not tear the wall down.

---

## Testing
- 10 simulated navigation cases against `background.js` with a mock `chrome` object: all pass
- Not yet confirmed in Chrome: the `app.js` side, and that a blocked redirect reports its final address

---

## Files Changed (3 total)

Line counts are approximate; these changes are part of commit `f631c39`.

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/background.js` | ≈ +42 −3 | Redirect detection |
| `extension/app.js` | ≈ +38 −3 | `followRedirect()`, `open()` argument |
| `docs/app.js` | ≈ +38 −3 | Copy of `extension/app.js` |
