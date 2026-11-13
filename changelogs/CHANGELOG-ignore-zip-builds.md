# Ignore Zip Builds — Keep Packaged Extension Zips Out of Git

- Added `*.zip` to `.gitignore`, so zip files of the packaged extension (for example, one made for a Chrome Web Store upload) are not committed by accident

---

## Summary
Packaging the extension for the store produces a zip in the working tree. Git now ignores zip files anywhere in the repo.

---

## 1. Ignore Rule
**Files:** `.gitignore`
**What:** One line, `*.zip`, after the existing `node_modules/`, `.DS_Store` and `*.log` rules.
**Impact:** No zip files are tracked today, so nothing already in the repo is affected.

---

## Testing
- Commit `95c6a54` (2026-11-13 22:17:23 +05:30) shipped without a changelog; this file was added afterwards from the commit's diff

---

## Files Changed (1 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `.gitignore` | +1 | Ignore rule |
