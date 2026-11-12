---
description: How to commit and push code changes with a detailed changelog
---

# Commit Workflow

When committing code changes, **always** include a changelog file that documents what was changed.

## Steps

1. Run `git status --short` in the project root to see all changed files.

2. If you changed `extension/agent.js`, `extension/app.js` or `extension/app.css`, copy them to `docs/` so the live demo stays identical:
```
cp extension/agent.js extension/app.js extension/app.css docs/
```
   Apply the same edits to `docs/index.html` that you made to `extension/app.html`.

3. Create a `changelogs/CHANGELOG-<topic>.md` file. The changelog MUST follow this two-part format:

### Part 1: Quick-Read Bullet List (at the top)
A flat list of every change made, one bullet per change. This is for fast scanning. No headers, no grouping, just bullets.

```markdown
# <Title> — <Short Description>

- <change 1>
- <change 2>
- <change 3>
- Fixed: <bug fix 1>
- Fixed: <bug fix 2>
```

**Rules for the bullet list:**
- One bullet per discrete change (not per file)
- Be specific: say what was changed, not just "updated X"
- Prefix bug fixes with `Fixed:`
- Include technical details where helpful (function names, message types, selectors)
- This section should be readable in 30 seconds

### Part 2: Detailed Sections (after a `---` divider)

```markdown
---

## Summary
<1-2 sentence overview of the change and its purpose>

---

## 1. <Feature/Fix Name>
**Files:** `<file1>`, `<file2>`
**What:** <Describe the specific technical change made>
**Impact:** <Describe the user-visible or architectural impact>

## 2. <Feature/Fix Name>
**Files:** `<file3>`
**What:** <Describe the specific technical change made>
**Impact:** <Describe the user-visible or architectural impact>

---

## Testing
- <what was checked, and what was not>

---

## Files Changed (N total)

| File | Lines Changed | Type |
|------|:---:|------|
| `<file>` | +X −Y | <Brief description> |
```

**Rules for detailed sections:**
- Every feature/fix gets its own numbered section
- Each section MUST list the specific files changed (`**Files:**`)
- Each section MUST describe what changed (`**What:**`) and why it matters (`**Impact:**`)
- Say honestly what was tested in Chrome and what was not
- Include a summary table at the bottom listing ALL files with approximate line counts

4. Update `README.md` to reflect the changes:
   - Update **What it does** or **Known limits** if behaviour changed
   - Add a row to the **Release Notes** table (date descending), one row per distinct feature/fix

5. Stage the changelog, README, and all changed files:
```
git add changelogs/CHANGELOG-<topic>.md README.md <files...>
```

6. Commit with a descriptive message:
```
git commit -m "<short description>

<bullet list of key changes>"
```

7. Push the branch and open a pull request into `main`:
```
git push origin <branch>
```

## Rules

- **Never commit code without an accompanying `changelogs/CHANGELOG-<topic>.md` file.** The `Require changelog` GitHub Action rejects a push or pull request to `main` that contains code changes without one.
- **All changelogs go in the `changelogs/` directory.** Do not create changelog files in the repo root.
- **Never use `--no-verify`.** It bypasses the pre-commit hook.
- **Never make empty commits** (`--allow-empty`).
- Use descriptive topic names (`CHANGELOG-redirect-follow.md`, `CHANGELOG-align-screens.md`).
- One topic per file. A commit that covers several topics gets several changelog files.
- If amending a commit, include the changelog in the amended commit.
- A commit that only changes `.md` or `.txt` files, or files under `.github/`, `.githooks/` and `.agents/`, does not need a changelog. `.json` files do, because `extension/manifest.json` controls the extension's permissions.
- Turn the local hook on once per clone: `git config core.hooksPath .githooks`
