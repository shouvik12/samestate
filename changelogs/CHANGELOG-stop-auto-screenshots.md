# Stop auto screenshots

- **Stop screenshots** ends the wait for the next automatic screenshot, even at the one-hour setting.

---

## Summary

Stopping auto screenshots interrupts the current countdown and releases the stream when auto screenshots started it.

## 1. Cancel the timer

**Files** `extension/capture.js`, `docs/capture.js`

The stop button clears the interval timer and lets the capture loop clean up immediately. A screenshot already being saved can finish before cleanup.

## Testing

- Saved a real PNG in headless Chrome and stopped auto screenshots during the one-hour interval. The start button returned and one file was saved.
- The Chrome smoke suite passed 37 of 37 checks with zero page errors.

## Files changed

| Files | Change |
|---|---|
| `extension/capture.js`, `docs/capture.js` | Cancel the wait between screenshots |
| `README.md` | Release notes |
