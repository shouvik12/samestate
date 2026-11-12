# Changelog Setup — One Changelog File per Change, Enforced

- Added the `changelogs/` directory with one `CHANGELOG-<topic>.md` file per change
- Added changelogs for the work already on this branch: `remove-node-server`, `per-site-access`, `redirect-follow`, `align-screens`, `twin-control-matching`, `demo-sandbox`
- Added `.githooks/pre-commit`: blocks a commit that changes code without staging a `changelogs/CHANGELOG-*.md` file
- Added `.github/workflows/require-changelog.yml`: fails a push or pull request to `main` that changes code without a changelog, or that puts one in the repo root
- Added `.agents/workflows/commit.md`: the commit steps and the two-part changelog format
- Added a **Release Notes** table to `README.md`, newest first
- Added a "Changelogs" section to `CONTRIBUTING.md` with the one-time hook setup command

---

## Summary
Changes are now recorded the same way as in the TextAgent repo: a short changelog file per change, a release-notes table in the README, and a local hook plus a CI check that keep code changes from landing without one.

---

## 1. Changelog Files
**Files:** `changelogs/CHANGELOG-*.md`
**What:** Each file starts with a flat bullet list for quick reading, then a divider, a summary, numbered sections with **Files**, **What** and **Impact**, and a table of files changed.
**Impact:** Every change on the branch has a readable record of what changed and why.

## 2. Enforcement
**Files:** `.githooks/pre-commit`, `.github/workflows/require-changelog.yml`
**What:** Both look at added, copied, modified and renamed files. Commits that touch only `.md` or `.txt` files, or only `.github/`, `.githooks/` and `.agents/`, are exempt. The CI check compares the whole pull request against its base, and the pushed range on a push.
**Impact:** A code change without a changelog is stopped locally and again on GitHub. Unlike TextAgent, `.json` files count as code here, because `extension/manifest.json` controls the extension's permissions.

## 3. Workflow and Docs
**Files:** `.agents/workflows/commit.md`, `README.md`, `CONTRIBUTING.md`
**What:** The workflow file lists the commit steps for people and coding agents. The README gains a Release Notes table; the contributing guide explains the rule and how to turn the hook on with `git config core.hooksPath .githooks`.
**Impact:** Contributors can find the rule and the format without reading the hook.

---

## Files Changed (12 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `changelogs/` (7 files) | new | Changelog files |
| `.githooks/pre-commit` | new | Local hook |
| `.github/workflows/require-changelog.yml` | new | CI check |
| `.agents/workflows/commit.md` | new | Commit workflow |
| `README.md` | ≈ +14 −0 | Release Notes table |
| `CONTRIBUTING.md` | ≈ +12 −0 | Changelogs section |
