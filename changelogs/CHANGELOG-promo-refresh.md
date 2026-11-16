# Promo Refresh — New Video with Fixes and Network

- `docs/media/samestate-promo.mp4`: the 30-second landscape promo, re-recorded from the current `docs/` build; the README's video link points to it ("Watch the 30s video")
- Removed `docs/media/samestate-demo-x.mp4`, the earlier 36-second video, which nothing else links to
- `promo/stage.js`: the montage's **Video** and **Notes** beats are now **Fixes** (Preview fix grows the phone's 18px Monthly/Yearly buttons to 44px) and **Network** (the report filtered to Network, with the Accessibility chip in view)
- `promo/stage.js`: keeps the report scene's findings and restores them after Compare sites, which clears the report; the screens scroll to the plans during the Themes beat
- `promo/voiceover.py`: narration says "Fixes." and "Network." in those beats

---

## Summary
The video on the GitHub page now shows the report tools added in this branch. Music, cuts and the other scenes are unchanged.

---

## Testing
- Narration with Piper (`promo/.venv/bin/python promo/voiceover.py`; system Python lacks numpy); every line fits its scene
- `node promo/record.mjs landscape` and `portrait`: 30.0 s each, about 42 fps
- Checked landscape frames at 23.9 s, 24.6 s and 25.3 s and a portrait frame at 24.6 s: the buttons grow on the iPhone, and the Network filter shows page weight for all four screens
- The portrait video stays in `promo/out/` (git-ignored); only the landscape one is committed

---

## Files Changed (6 total)

| File | Lines Changed | Type |
|------|:---:|------|
| `promo/stage.js` | +18 −11 | Fixes and Network beats, findings kept |
| `promo/voiceover.py` | +2 −2 | Narration |
| `docs/media/samestate-promo.mp4` | new (8.2 MB) | Video |
| `docs/media/samestate-demo-x.mp4` | removed | Old video |
| `README.md` | +2 −1 | Video link, release notes |
| `changelogs/CHANGELOG-promo-refresh.md` | new | This file |
