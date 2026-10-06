# Dashboard walkthrough videos

The encoded files live in `frontend/public/videos/` and are served as-is at
`/videos/…` (Vite copies `public/` verbatim into `dist/`). They are played by
`src/components/dashboard/HelpVideo.tsx`. This note sits here, beside the
script, rather than in `public/` — anything in there is world-readable on the
live site.

Each walkthrough is three files sharing one basename:

| File          | Role                                                          |
| ------------- | ------------------------------------------------------------- |
| `<name>.mp4`  | H.264/AAC — the baseline every browser plays                   |
| `<name>.webm` | VP9/Opus — offered first, but only where it came out smaller   |
| `<name>.jpg`  | Poster frame, shown before playback starts                     |

The `.webm` is optional by design. These recordings arrive already well
compressed, and VP9 does not always beat them; where it loses, the script drops
it and records that in the generated `helpVideoFormats.ts`, which `HelpVideo`
reads so it never offers a file that isn't there.

Current basenames, one per dashboard page:

- `traffic-rules` — Traffic Rules
- `shield` — Server-side Shield
- `redirection` — Redirection / short links

Don't hand-encode these. Drop the raw recordings in a scratch folder named
`<basename>.<ext>` and run:

    frontend/scripts/encode-videos.sh ~/path/to/recordings

That script holds the encoder settings (720p cap, CRF, faststart, Safari-safe
pixel format), stream-copies any source that is already web-ready instead of
re-encoding it, and regenerates `helpVideoFormats.ts`.

These are committed, not fetched at deploy time — the web image is built from
this tree alone, so a video that isn't here isn't on the site. Keep each one
small enough to be comfortable in git; if a walkthrough ever runs past a few
minutes, move the set to object storage and point `HelpVideo` at the CDN URL
instead of growing the repo.
