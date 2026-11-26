# Plugin release versions

- Raised the Claude Code plugin version from 0.1.4 to 0.2.0 to match the bundled extension.
- Added a CI check for matching plugin and extension versions.
- Added a CI check requiring a newer plugin version when bundled code changes.
- Documented the update command for existing plugin installations.

---

## Summary

Versioned plugin installations can receive the extension updates included in the current release.

## 1. Publish a matching plugin version

**Files** `.claude-plugin/plugin.json`, `README.md`, `mcp/README.md`

**What changed** The plugin declares version 0.2.0, matching `extension/manifest.json`. Setup instructions include `claude plugin update samestate@samestate` for existing installations.

**Impact** Claude Code can identify the release as an update to its cached 0.1.4 plugin.

## 2. Check release versions in CI

**Files** `tools/check-versions.mjs`, `.github/workflows/smoke-test.yml`

**What changed** A plugin CI job checks version equality, compares bundled files with the base commit, and requires an advancing version for code changes. It also runs the MCP tests.

**Impact** A pull request with a mismatched or unchanged release version fails the plugin job.

---

## Testing

- Ran the version guard against the current release and the release base.
- Used a temporary Git repository to confirm failures for mismatched versions, unchanged versions with bundled changes, and a version downgrade, plus success for a matching version bump.

---

## Files changed

| File | Approximate lines changed | Purpose |
|---|---:|---|
| `.claude-plugin/plugin.json` | 2 | Plugin release version |
| `tools/check-versions.mjs` | 28 | Release guard |
| `.github/workflows/smoke-test.yml` | 20 | Plugin CI job |
| `README.md`, `mcp/README.md` | 6 | Update and release instructions |
| `changelogs/CHANGELOG-plugin-version-sync.md` | 47 | Change details |
