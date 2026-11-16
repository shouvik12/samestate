# Auto Capture — Timed Screenshots, Recording Frame Rate, 10 MB Parts and a Save Folder

- **Auto screenshots** in the Capture drawer: saves a PNG of the device wall again and again until **Stop screenshots**, at **Screenshots per second** (0.1–10). Files are numbered in one series (`samestate-<time>-shot-0001.png`)
- **Recording frames per second** (1–60, default 30) sets the recording's frame rate; the bitrate scales with it (4 Mbit/s at 30 fps, at least 0.4 Mbit/s)
- Recordings are split into files of about 10 MB: when the next half-second of video would pass 10 MB, the part is saved and the next one starts on the same capture (`samestate-<time>-part-01.webm`, `part-02.webm`…). Each part is a complete WebM
- **Save to folder…** writes every screenshot and recording part into a chosen folder as it is made, through the File System Access API. The folder is kept in IndexedDB and Chrome asks for permission again after a restart; **Use Downloads** goes back to downloads, which is also the default
- Both rates are remembered in this browser (`samestate.shotRate`, `samestate.recordRate`)
- Messages say how many files were saved and where; stopping Chrome's tab sharing stops a recording and saves the last part
- README: **Capture the device wall** describes the new options

---

## Summary
Screenshots and recordings can now be taken unattended: screenshots at a steady rate, recordings at a chosen frame rate in files of about 10 MB, all saved straight into one folder.

---

## 1. Auto Screenshots
**Files:** `extension/capture.js`, `extension/app.html`, `extension/app.css` (and `docs/` copies)
**What:** A loop grabs a frame from the wall capture (`ImageCapture.grabFrame`), saves it as PNG, then waits for the rest of the interval. The rate is read before each wait, so changing it applies at once, and a slow save delays the next shot instead of piling shots up. It reuses a running recording's capture when there is one. Device wall only: in Compare sites the button is disabled, as frames there come from a short recording.
**Impact:** A sequence of screenshots without clicking for each one.

## 2. Recording Rate and Parts
**Files:** `extension/capture.js`
**What:** `captureWall()` takes a frame rate for `getDisplayMedia`. `recordPart()` runs one `MediaRecorder` per file with 500 ms chunks; when the bytes so far plus one more average chunk would pass the limit, it stops, starts the next part immediately, and then writes the finished one.
**Impact:** Long recordings become files of about 10 MB that each play on their own.

## 3. Save Folder
**Files:** `extension/capture.js`
**What:** `showDirectoryPicker()` (hidden where Chrome lacks it); `save()` writes with `createWritable()` and falls back to a download if writing fails. Permission is requested at the start of a capture, while the click still counts as a user action.
**Impact:** No download prompts or Downloads clutter for long captures.

---

## Testing
- Headless Chrome (`--auto-accept-this-tab-capture`), web demo, with the browser's private storage folder (`navigator.storage.getDirectory()`) as the save folder:
  - Auto screenshots at 4 per second for about 3 s: 12–13 PNGs (about 3.8 per second), numbered from `shot-0001`; **Stop screenshots** ended the series with "Auto screenshots stopped: 13 saved in caps."
  - Recording at 10 fps with the part size lowered to 200 KB for the test: `part-01.webm` 202,364 bytes and `part-02.webm` 77,119 bytes, both opening as 800×428 videos; "Recording saved in caps: 2 files."
- The drawer checked in Samestate night and Clay day
- `node tests/smoke.mjs`: 37/37 checks passed, 0 page errors; the capture step now also checks the new controls
- Not tested: a real folder picked with Chrome's folder picker, the permission prompt after a restart, a full 10 MB part, and the installed extension
