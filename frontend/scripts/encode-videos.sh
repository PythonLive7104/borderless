#!/usr/bin/env bash
# Prepare the dashboard walkthrough recordings for the web.
#
#   frontend/scripts/encode-videos.sh <source-dir>
#
# Reads the raw recordings from <source-dir> (any container ffmpeg can open —
# .mp4, .mov, .mkv, .webm) and writes, into frontend/public/videos/, up to three
# files per walkthrough, sharing one basename:
#
#   <name>.mp4    H.264/AAC — the baseline every browser plays
#   <name>.webm   VP9/Opus  — offered first, but ONLY when it comes out smaller
#   <name>.jpg    poster frame, shown before playback starts
#
# Two things here are deliberate and easy to get wrong:
#
# 1. A source that is ALREADY web-ready is stream-copied, not re-encoded. These
#    recordings come out of a screen recorder as 720p H.264/yuv420p — exactly
#    what we would encode to. Running them through libx264 again would spend a
#    second lossy pass to arrive back where we started, keeping the first pass's
#    artefacts and adding its own, and on an already-compressed screencast it
#    can easily come out LARGER. Only a source that fails the check below is
#    re-encoded.
#
# 2. The WebM is kept only if it beats the MP4 on size, because that is its
#    entire reason for being in the list. VP9 usually wins big on a screencast,
#    but a short clip or a noisy source can go the other way, and shipping a
#    larger first choice would make every viewer download the worse file.
#
# Re-runnable: it overwrites its own outputs and never touches the sources.
set -euo pipefail

SRC="${1:-}"
if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "usage: $0 <source-dir>   (folder holding the raw recordings)" >&2
  exit 2
fi
command -v ffmpeg >/dev/null || { echo "ffmpeg not found on PATH" >&2; exit 2; }
command -v ffprobe >/dev/null || { echo "ffprobe not found on PATH" >&2; exit 2; }

OUT="$(cd "$(dirname "$0")/.." && pwd)/public/videos"
mkdir -p "$OUT"

# Generated for the component to import; see the note where it is written.
MANIFEST="$(cd "$(dirname "$0")/.." && pwd)/src/components/dashboard/helpVideoFormats.ts"
with_webm=""

probe() { ffprobe -v error -select_streams v:0 -show_entries "stream=$1" -of csv=p=0 "$2" 2>/dev/null | head -1; }
kb()    { echo $(( ($(wc -c < "$1") + 1023) / 1024 )); }

# "<output name>:<source basename>|<source basename>|..." — the output name is
# what HelpVideo.tsx asks for, the alternatives are what the recording may
# actually be called, tried in order. Adding a walkthrough means adding a row
# here and a <HelpVideo name="..."> on the page.
for entry in "traffic-rules:traffic-rules|traffic" "shield:shield" "redirection:redirection|links"; do
  name="${entry%%:*}"
  src=""
  for base in $(echo "${entry#*:}" | tr '|' ' '); do
    for ext in mp4 mov mkv webm avi m4v MP4 MOV MKV; do
      [ -f "$SRC/$base.$ext" ] && { src="$SRC/$base.$ext"; break 2; }
    done
  done
  if [ -z "$src" ]; then
    echo "skip   $name — nothing matching ${entry#*:} in $SRC"
    continue
  fi
  echo "== $name  <- $(basename "$src") ($(kb "$src") KB)"

  # Cap at 1280x720 and only ever scale down. force_original_aspect_ratio plus
  # the -2 height keeps the aspect ratio and an even height, which both encoders
  # require. A dashboard screencast is legible at 720p in a column this wide,
  # and a 4K capture would otherwise ship tens of megabytes to read the same text.
  scale="scale='min(1280,iw)':-2:force_original_aspect_ratio=decrease"

  # Web-ready means: H.264 in 8-bit 4:2:0 at no more than 720p. Those are the
  # constraints Safari and iOS enforce — a 10-bit or 4:4:4 source plays fine on
  # a desktop while showing an iPhone nothing but a black rectangle.
  vcodec=$(probe codec_name "$src"); pixfmt=$(probe pix_fmt "$src"); h=$(probe height "$src")
  if [ "$vcodec" = "h264" ] && [ "$pixfmt" = "yuv420p" ] && [ "${h:-9999}" -le 720 ]; then
    # Stream copy. -movflags +faststart still matters: it moves the index to the
    # head of the file, and without it the browser must fetch the tail before the
    # first frame — on a cold cache that looks like a player hanging on black.
    echo "   mp4   copy (already H.264/yuv420p/${h}p — no re-encode)"
    ffmpeg -nostdin -y -loglevel error -i "$src" -c copy -movflags +faststart "$OUT/$name.mp4"
  else
    echo "   mp4   re-encode ($vcodec/$pixfmt/${h}p)"
    # CRF, not a bitrate target: on a screencast the long still stretches cost
    # almost nothing and the occasional scroll is what needs the bits.
    ffmpeg -nostdin -y -loglevel error -i "$src" \
      -vf "$scale" -c:v libx264 -crf 24 -preset slow -profile:v high -pix_fmt yuv420p \
      -c:a aac -b:a 128k -movflags +faststart "$OUT/$name.mp4"
  fi

  # -c:a libopus applies only if the source has an audio stream; a silent
  # screen recording simply produces a video-only file, which is not an error.
  # -f webm is required, not decorative: the output lands on a .tmp name while
  # its size is compared with the mp4's, and ffmpeg picks its muxer from the
  # extension unless told otherwise.
  ffmpeg -nostdin -y -loglevel error -i "$src" \
    -vf "$scale" -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 \
    -c:a libopus -b:a 96k -f webm "$OUT/$name.webm.tmp"

  if [ "$(kb "$OUT/$name.webm.tmp")" -lt "$(kb "$OUT/$name.mp4")" ]; then
    mv -f "$OUT/$name.webm.tmp" "$OUT/$name.webm"
    with_webm="$with_webm $name"
    echo "   webm  $(kb "$OUT/$name.webm") KB — kept (mp4 is $(kb "$OUT/$name.mp4") KB)"
  else
    # Drop it, and drop any webm left by an earlier run, so the set on disk
    # always matches what this run decided.
    rm -f "$OUT/$name.webm.tmp" "$OUT/$name.webm"
    echo "   webm  dropped — VP9 was no smaller than the $(kb "$OUT/$name.mp4") KB mp4"
  fi

  # Poster from one second in: frame zero of a screen recording is usually a
  # half-drawn window or a flash of desktop.
  ffmpeg -nostdin -y -loglevel error -ss 1 -i "$src" -vf "$scale" -frames:v 1 -q:v 3 "$OUT/$name.jpg"
done

# Which walkthroughs ended up with a WebM worth offering. The component needs
# this at build time and cannot find out for itself: these files live in
# public/, which Vite copies verbatim without indexing, so import.meta.glob
# cannot see them. Hardcoding the list in the component instead would go stale
# the first time a re-recorded video changed which codec won — and the failure
# is quiet, costing every viewer a 404 before playback starts rather than
# breaking anything outright.
{
  echo "// GENERATED by frontend/scripts/encode-videos.sh — do not edit by hand."
  echo "//"
  echo "// Walkthroughs whose VP9 encode came out smaller than the H.264 one, and so"
  echo "// are worth offering ahead of the mp4. A name missing here is mp4-only."
  echo "export const HAS_WEBM: ReadonlySet<string> = new Set(["
  for n in $with_webm; do echo "  \"$n\","; done
  echo "]);"
} > "$MANIFEST"
echo
echo "wrote $MANIFEST"

echo
echo "in $OUT:"
ls -l "$OUT" | tail -n +2 | awk '{printf "  %-26s %8.1f KB\n", $9, $5/1024}'
