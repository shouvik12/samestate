# Link Sync — Follow Links on Every Screen

- Following a link on one screen now opens the same address on every other linked screen; before, only that screen moved until **Align screens** was pressed
- Covers links to other pages, same-page links (`#features`), and page changes that single-page apps make after a click
- Added **Links & pages** to the **Sync** drawer (on by default); it turns link sync off without affecting click sync
- The Sync log shows one entry per followed link ("Desktop · open /pricing") with **opened** or **skipped** for each other screen
- Form submissions, downloads, links to other sites and back/forward are not shared; **Page steps** keeps its own link handling
- An unlinked screen neither follows nor leads, and in **Compare sites** a link is followed only within its own column
- Each receiving screen checks the address belongs to its own site before opening it
- Added two guided demo steps: the Desktop follows **Pricing**, then the iPhone follows **Back to overview**; the smoke test checks both
- Fixed: the guided demo pointed at the hidden "Warehouse sync" dropdown item instead of the visible **Pricing** link in the Desktop's bar

---

## Summary
Link clicks were never mirrored, so clicking through a site moved one screen and left the rest behind. A link followed on any screen is now followed on all of them.

---

## 1. Sharing a Navigation
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** A `navigate` listener (Navigation API) sends a `navigate` action for same-origin `push` navigations that the user started: `event.userInitiated`, or within a second of a trusted click or key press for single-page apps. When the navigation loads a new document, the agent cancels it, sends the action, and then goes to the address itself 120 ms later.
**Impact:** Without that delay the message was lost: the page unloaded before Samestate received it, and the message arrived with no sender. With the delay, the screen you clicked opens the page about 0.1 seconds later than it would on its own.

## 2. Following a Navigation
**Files:** `extension/agent.js`, `docs/agent.js`
**What:** The `navigate` handler (`followAddress()`) ignores addresses on other sites or with credentials, reports **skipped** when the screen is already there, sets the hash for same-page links, and otherwise calls `location.assign()` after replying. The address it was sent is remembered so its own navigation is not shared back.
**Impact:** Single-page apps load the address as a full page on the other screens.

## 3. App Routing and Sync Log
**Files:** `extension/app.js`, `docs/app.js`
**What:** `SYNC.nav` ("Links & pages") and `KIND_SYNC.navigate` route the action like a click: numbered, logged and sent to the other ready, linked screens. `pageLabel()` shortens the address for the log heading, and the result label is **opened**.
**Impact:** Uses the existing message path, so unlinked screens, Page steps and Compare sites columns behave as they do for clicks.

## 4. Guided Demo and Smoke Test
**Files:** `extension/app.js`, `extension/agent.js`, `tests/smoke.mjs`, and the copies in `docs/`
**What:** Two steps after **Align screens** use a new demo action (`do: 'link'`), since the tour's synthetic clicks are not user-initiated. The smoke test checks all 7 screens reach `pricing.html` with 6 **opened** results, then all 7 return to `index.html`.
**Impact:** The tour has 23 steps.

---

## Testing
- Smoke test: 27 of 27 checks passed (the two new steps included)
- With real clicks in the web demo: the Desktop's **Pricing** link moved all 7 screens to the pricing page with one Sync log entry; the iPhone's **Back to overview** moved them all back; **See features** on the Nexus 7 moved every screen to `#features`; with **Links & pages** off only the clicked screen moved
- The first real-click test failed because of the lost message described in section 1; the cancel-and-delay fix is what made it pass
- Not run inside the Chrome extension, where messages travel over a runtime port instead of `postMessage`

---

## Files Changed (6 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `extension/agent.js` | +39 | Share and follow navigations, demo link action |
| `extension/app.js` | +24 −5 | Sync setting, routing, log, tour steps |
| `tests/smoke.mjs` | +7 | Checks for the two new steps |
| `docs/agent.js`, `docs/app.js` | same | Copies |
| `README.md` | +7 −1 | Link sync, known limit, release note |
