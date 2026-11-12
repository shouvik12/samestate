# Remove Node Server — Drop the Optional Local Proxy

- Deleted the `server/` folder (12 files): `server.js`, its copy of the app in `server/public/`, and its demo pages in `server/demo/`
- Removed the `server/` entry from the "How it works" tree in `README.md`
- Removed the "(The Node version sends per-device user-agents.)" note from "Known limits" in `README.md`
- Fixed: `/api/open` in `server.js` accepted a POST from any web page with no origin, host or token check, and could then clone a repo and run `npm install` and its dev script

---

## Summary
The Chrome extension and the live demo never use the Node server. It carried a request-forgery hole that led to code execution, and its copy of the app had drifted from `extension/` and `docs/`, so it was removed instead of repaired.

---

## 1. Server Removal
**Files:** `server/server.js`, `server/package.json`, `server/public/*`, `server/demo/*`
**What:** Deleted the zero-dependency proxy server, the shell UI it served on `localhost:4700`, the per-device proxies on the following ports, and the repo/folder runner.
**Impact:** Removes the unauthenticated `/api/open`, `/api/close` and `/api/devices` endpoints. Per-device user-agents and "preview a repo or folder directly" are no longer available; with the extension, start the dev server yourself and enter `localhost:<port>`.

## 2. README Cleanup
**Files:** `README.md`
**What:** Removed the two places that described the Node version.
**Impact:** The README no longer points readers at code that does not exist.

---

## Files Changed (13 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `server/` (12 files) | +0 −1665 | Deleted |
| `README.md` | +1 −4 | Docs |
