#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="$ROOT_DIR/src-tauri/target/release/bundle/macos/Timing Lite.app"
DMG_DIR="$ROOT_DIR/src-tauri/target/release/bundle/dmg"
STAGE_DIR="$DMG_DIR/.stage"
RENDER_DIR="$DMG_DIR/.background-render"
DMG_PATH="$DMG_DIR/Timing-Lite.dmg"
RW_DMG_PATH="$DMG_DIR/Timing-Lite-rw.dmg"
BUILD_VOLUME_NAME="Timing Lite Builder"
FINAL_VOLUME_NAME="Timing Lite"
MOUNT_DIR="/Volumes/$BUILD_VOLUME_NAME"
BACKGROUND_SVG="$ROOT_DIR/scripts/assets/dmg-background.svg"
BACKGROUND_PNG="$STAGE_DIR/.background/installer-bg.png"

if [ ! -d "$APP_PATH" ]; then
  echo "App bundle not found: $APP_PATH" >&2
  exit 1
fi

osascript <<EOF >/dev/null 2>&1 || true
tell application "Finder"
  repeat with w in every Finder window
    try
      if (name of w as text) contains "Timing Lite" then
        close w
      end if
    end try
  end repeat
end tell
EOF

for mount in /Volumes/Timing\ Lite*(N); do
  hdiutil detach "$mount" >/dev/null 2>&1 || hdiutil detach -force "$mount" >/dev/null 2>&1 || true
done

for image in "$DMG_PATH" "$RW_DMG_PATH"; do
  for dev in $(hdiutil info | awk -v image="$image" '$1 == "image-path" { current = ($3 == image); next } current && $1 ~ /^\/dev\/disk[0-9]+$/ { print $1 }'); do
    hdiutil detach "$dev" >/dev/null 2>&1 || hdiutil detach -force "$dev" >/dev/null 2>&1 || true
  done
done

rm -rf "$STAGE_DIR" "$RENDER_DIR" "$RW_DMG_PATH"
mkdir -p "$STAGE_DIR/.background" "$RENDER_DIR" "$DMG_DIR"

ditto "$APP_PATH" "$STAGE_DIR/Timing Lite.app"
ln -s /Applications "$STAGE_DIR/Applications"

qlmanage -t -s 900 -o "$RENDER_DIR" "$BACKGROUND_SVG" >/dev/null 2>&1
mv "$RENDER_DIR/dmg-background.svg.png" "$BACKGROUND_PNG"

hdiutil create \
  -srcfolder "$STAGE_DIR" \
  -volname "$BUILD_VOLUME_NAME" \
  -fs HFS+ \
  -format UDRW \
  -ov \
  "$RW_DMG_PATH" >/dev/null

ATTACH_OUTPUT="$(hdiutil attach \
  -readwrite \
  -noverify \
  -noautoopen \
  -mountpoint "$MOUNT_DIR" \
  "$RW_DMG_PATH")"

DEVICE_NAME="$(printf '%s\n' "$ATTACH_OUTPUT" | awk 'NR == 1 { print $1 }')"

osascript <<EOF >/dev/null
tell application "Finder"
  tell disk "$BUILD_VOLUME_NAME"
    open
    delay 1
    set current view of container window to icon view
    set viewOptions to the icon view options of container window
    set arrangement of viewOptions to not arranged
    set icon size of viewOptions to 160
    set text size of viewOptions to 16
    set background picture of viewOptions to file ".background:installer-bg.png"
    update
    delay 2
    set position of application file "Timing Lite.app" to {180, 250}
    set position of alias file "Applications" to {560, 250}
    delay 1
    close
  end tell
end tell
EOF

diskutil rename "$MOUNT_DIR" "$FINAL_VOLUME_NAME" >/dev/null 2>&1 || true
sync
hdiutil detach "$DEVICE_NAME" >/dev/null

hdiutil convert "$RW_DMG_PATH" \
  -format UDZO \
  -imagekey zlib-level=9 \
  -ov \
  -o "$DMG_PATH" >/dev/null

rm -rf "$STAGE_DIR" "$RENDER_DIR"
rm -f "$RW_DMG_PATH"
