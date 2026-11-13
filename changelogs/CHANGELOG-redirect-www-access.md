# Redirect www Access — Ask for the Bare and www Host Together

- Opening a site now asks Chrome for access to both its bare and `www` host in one prompt, for example `example.com` and `www.example.com`
- When the site then redirects between the two, the redirect is followed without a second access prompt
- Added `twinOrigins(url)` in `app.js`, used by `open()` and by `openSite()` in **Compare sites**
- No twin is added for IP addresses, single-label hosts such as `localhost`, or subdomains other than `www` (`app.example.com` asks for itself only)

---

## Summary
Most sites redirect between the bare and `www` host. Access was asked for one host at a time, so the redirect stopped at a second prompt and the address had to be confirmed again. Both hosts are now requested up front.

---

## 1. Paired Access Request
**Files:** `extension/app.js`, `docs/app.js`
**What:** `twinOrigins()` returns the URL's own origin pattern, plus the `www.` form of a two-label host or the bare form of a `www.` host. `chrome.permissions.request()` in `open()` and `openSite()` receives that list.
**Impact:** Chrome's prompt lists both hosts. Redirect handling in `followRedirect()` and `followSiteRedirect()` already reopens the preview when access exists, so the second host now opens straight away.

---

## Testing
- Commit `ba6f473` (2026-11-13 13:28:34 +05:30) shipped without a changelog; this file was added afterwards from the commit's diff
- Not covered by the smoke test, which runs the web build where access prompts do not apply
- **Saved workspaces** did not use the pairing at first; that is fixed separately (see `CHANGELOG-workspace-www-access.md`)

---

## Files Changed (2 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/app.js` | +10 −2 | `twinOrigins()`, both access requests |
| `docs/app.js` | +10 −2 | Copy of `extension/app.js` |
