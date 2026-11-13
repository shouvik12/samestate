# Workspace www Access — Ask for the Bare and www Host When Opening a Workspace

- Opening a saved workspace now asks Chrome for each site's bare and `www` host together, the same way opening a site does since `ba6f473`
- Fixed: reopening a workspace on a site that redirects between `example.com` and `www.example.com` could show a second access prompt
- Changed in `restore()` in `workspaces.js`: the single access request uses `twinOrigins()` instead of `originPattern()`, with duplicates removed

---

## Summary
`ba6f473` made opening a site request both hosts so a bare/www redirect needs no second prompt. Saved workspaces still requested only the saved host. They now use the same pairing.

---

## 1. Paired Access Request for Workspaces
**Files:** `extension/workspaces.js`, `docs/workspaces.js`
**What:** `restore()` builds its one `chrome.permissions.request()` from `external.flatMap(twinOrigins)` in a `Set`, so the main site and every **Compare sites** column get their bare and `www` host, each listed once.
**Impact:** Chrome's prompt can list up to twice as many hosts. Hosts with no `www` partner are unchanged: IP addresses, single-label hosts such as `localhost`, subdomains such as `app.example.com`, and domains with more than two labels such as `example.co.uk`, which `twinOrigins()` leaves alone.

---

## Testing
- Ran `twinOrigins()` from `app.js` on sample addresses: `example.com` and `www.example.com` gave the pair once; `app.example.com`, `localhost:3000` and `example.co.uk` gave only themselves
- Smoke test passes; it runs the web build, so the access prompt itself is not exercised
- Not checked in the Chrome extension

---

## Files Changed (3 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/workspaces.js` | +3 −2 | Paired access request |
| `docs/workspaces.js` | +3 −2 | Copy of `extension/workspaces.js` |
| `README.md` | +1 | Release note |
