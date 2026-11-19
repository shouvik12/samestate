# Demo carousel navigation

The walkthrough previously advanced automatically and offered Pause/Skip. Testers can now move backward or forward through its 46 steps and jump directly to a feature.

- Add **Previous**, **Next** and a labeled step picker. Disable the arrows at the first/last step.
- Support Left/Right arrows, Home/End within the demo controls and horizontal swipes on the demo bar. Editable controls retain their own keyboard behavior.
- Hold manually selected steps after their demonstration finishes. **Resume** continues autoplay. A completed step advances immediately without reloading its scene.
- Backward moves and direct jumps prepare only the selected feature’s prerequisites on the bundled sample site: dialogs, page navigation, keyboard outlines, combined reports and page-step journeys show the matching real state.
- Keep navigation usable in modal dialogs and during demo-owned checks/sweeps. New requests cancel older work; the latest requested step wins. Skip also cancels pending navigation.
- Keep step-picker input events out of the surrounding design/grid forms, preserving those preferences.
- Guard cancelled pointer/scroll animations and final-step callbacks against later navigation. Preserve saved tests, group selections and demo cleanup behavior.

Both the Chrome extension and web-demo builds include the controls and script/style versions. README usage is updated.

Verified in desktop Chrome:

- `node tests/tour-navigation.mjs`: **27/27** carousel checks passed, including real scene restoration, modal navigation, rapid requests, both swipe directions, sweep cancellation and saved preferences.
- `node tests/tour-cleanup.mjs`: **16/16** cleanup checks passed.
- `SMOKE_PACE=0.05 node tests/smoke.mjs`: **62/62** checks passed across all 46 steps and the subsequent tool checks, with **0 page errors**. Only reading delays are accelerated.
- Reviewed the rendered carousel controls; verified script syntax, unique HTML IDs and matching extension/web files.
