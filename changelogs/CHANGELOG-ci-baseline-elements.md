# CI baseline comparison

- CI detects newly affected elements on a screen that already has a finding of the same kind.
- Older baseline reports remain usable and can detect increases in the number of affected elements reported by a grouped finding.

---

## Summary

CI baselines compare the affected elements within each finding on measured screens.

## 1. Compare affected elements

**Files** `tools/samestate-ci.mjs`

The CI report records structural element keys alongside each finding. The comparison uses those keys to recognize added and removed elements, including when the number affected stays the same. Older baseline files use the affected count because they contain no element keys. CI only reports fixes on screens measured in the current run.

## Testing

- Ran CI against a local fixture with clean, unchanged, added, replaced, and resolved broken images.
- Compared against an older report format with the element keys removed.
- Verified exit code 1 for added and replaced broken images and exit code 0 for clean, unchanged, and resolved cases.

## Files changed

| Files | Change |
|---|---|
| `tools/samestate-ci.mjs` | Compare affected elements and support older baseline reports |
| `README.md` | CI baseline behavior and release notes |
