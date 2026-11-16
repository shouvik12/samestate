# Signed-in Previews — Open the Current Page with Your Sign-ins

- The toolbar icon opens the page it was clicked on, in a new Samestate tab beside it; elsewhere (new tab page, `chrome://` pages) it opens Samestate on the default site as before
- A site Chrome already allows opens on every screen straight away; for a new site the address is filled in and Enter brings up Chrome's access prompt (Chrome only shows it after a click or key press)
- Previews use Chrome's cookies and site storage for the site, so a page you are signed in to opens signed in on every screen
- **Use my sign-ins** under **Views** (on by default, remembered) turns this off: previews then start signed out with separate, temporary storage, as before. Changing it reopens every screen on the page it shows
- `manifest.json`: adds `activeTab`, which lets the icon click read the tab's address (no new install warning)
- README: install and privacy sections, a known limit (synced clicks act on your account on every screen), release notes row
- `docs/privacy.html`: sign-ins line, how the icon reads the tab's address, date

---

## Summary
Clicking the icon on a page you are signed in to opens that page on every device, already signed in. Before, previews were `credentialless` frames, which Chrome loads with no cookies and throwaway storage, so every site asked you to sign in again.

---

## 1. Open the Clicked Page
**Files:** `extension/background.js`, `extension/manifest.json`, `extension/app.js`, `docs/app.js`
**What:** `action.onClicked` opens `app.html?open=<tab address>` for http and https tabs. `openClickedPage()` removes the parameter with `history.replaceState`, so a reload starts fresh, and opens the page with or without a prompt like `openDefault()`. The background accepted messages only from `app.html` exactly; `isApp()` now ignores the query, both for `register` and for the main-frame check that unregisters a tab.
**Impact:** No copying addresses between tabs.

## 2. Use My Sign-ins
**Files:** `extension/app.js`, `extension/app.html`, `docs/app.js`, `docs/index.html`
**What:** `setPreviewSource()` sets `credentialless` only when `useSignIns` is off (`samestate.signins` in localStorage). `setSignIns()` asks each ready screen for its current address (the agent's `state` reply, falling back to the frame's `src`) and loads it again, since a frame's credentialless state is fixed when a page starts loading. The option is hidden in the web demo, whose previews are the bundled sample site.
**Impact:** Chrome treats the extension page as first party for sites it has access to, so HttpOnly `SameSite=Lax` session cookies and localStorage tokens both reach the previews.

---

## Testing
- Headless Chrome 157 with the extension, against a local site that signs in with an HttpOnly `SameSite=Lax` cookie, a `SameSite=None` cookie, a default cookie and a localStorage token, signed in from a normal tab first
- Over HTTPS and over plain `http://localhost`: all 7 screens received all three cookies and the token
- Turning **Use my sign-ins** off reloaded the 7 screens with no cookies and no token; turning it back on reloaded them signed in
- Opening from a tab without Chrome access filled in the address, focused it and showed "Press Enter to open localhost:8791. Chrome asks once for access to the site."
- Ruled out first: with `credentialless` frames, no cookie of any `SameSite` value was sent; Chrome's per-site cookie exception rejects an extension page as the top-level site; and Samestate's page embedded in the site's own tab is still cross-site for its frames
- `node tests/smoke.mjs`: 35/35 checks passed, 0 page errors; the new check confirms the option is hidden in the web demo
- Not tested: clicking the real toolbar icon (headless Chrome has no toolbar; the test opened the same `app.html?open=` address the click opens), and sites that sign in through a third-party identity provider inside the page

---

## Files Changed (11 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/background.js` | +8 −3 | Open the clicked page, accept `app.html?open=` |
| `extension/manifest.json` | +1 −1 | `activeTab` |
| `extension/app.js` | +48 −2 | Clicked page, Use my sign-ins |
| `extension/app.html` | +1 | Option |
| `docs/app.js`, `docs/index.html` | same | Copies |
| `docs/privacy.html` | +3 −3 | Sign-ins, icon, date |
| `README.md` | +8 −3 | Install, privacy, known limit, release notes |
| `tests/smoke.mjs` | +1 | Option hidden in the demo |
| `changelogs/CHANGELOG-signed-in-previews.md` | new | This file |
