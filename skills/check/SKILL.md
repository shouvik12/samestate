---
name: check
description: Check a web page on phones, tablets and desktops at once with Samestate and fix what breaks. Use after changing a page's layout, CSS or HTML, when the user asks whether a page works on mobile or is responsive, or asks to test a page on several screen sizes.
argument-hint: "[url] [what to focus on]"
---

# Check a page on every screen size

Samestate opens the page on several screen sizes at once in a hidden Chrome and reports what breaks. It runs on this computer, so `http://localhost:…` pages work.

Page and focus from the user: $ARGUMENTS

## Steps

1. **Find the address.** Use the one given. Otherwise use the dev server this project runs (check its start script, `.claude/launch.json` or the terminal), and start it if it is not running. Don't guess a production address.
2. **Run `check_responsive`** with the URL. Leave `devices` out for the seven default screens; add ids from `list_devices` (for example `small` for 320px, `galaxy-s20`, `iphone-14`) when the user names a device or a narrow width matters.
3. **Read the report by severity.** Issues are real breakage (sideways scroll, a table wider than its container, tap targets under 24px, broken images, a missing viewport tag). Warnings are likely problems. Adaptations (only with `include_adaptations`) are layout changes between screens, usually intended.
4. **Look before fixing.** If the cause isn't clear from the report, call `screenshot` for the one or two screens involved.
5. **Fix it in the source.** Find the element named in the report and change the project's own CSS or markup. The report's "usually fixed by" CSS is a starting point; adapt it to the codebase's conventions instead of pasting it in.
6. **Check again** with the same URL and screens, and confirm the issue is gone and nothing new appeared.
7. **Report** what was found, what you changed (file and line), and what is left, including warnings you chose not to fix and why.

Use `run_checks` when the user wants the full automated check groups (layout, accessibility, meta, performance, links) or a pass/fail summary. Add the `widths` group only when asked for a width sweep; it takes minutes.

If a screen is listed as not measured, the page did not load there in 30 seconds: check the address and the dev server before trusting the rest of the report.
