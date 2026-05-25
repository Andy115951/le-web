# Timing Lite (Tauri + React)

A local-first desktop MVP inspired by timing-style activity tracking.

## What this MVP does

- Captures the current frontmost macOS app + window title.
- Runs a background collector loop (capture does not depend on UI button clicks).
- Closing the main window hides the app and keeps the collector running in the background.
- Shows a macOS menu-bar status icon for reopening and quick control.
- Stores timeline entries in local SQLite:
  - `~/.timing-lite/timing-lite.db`
- Supports rule-based auto classification:
  - rule match -> `project` / `tag`
- Ignores large sleep / shutdown gaps so one open segment will not suddenly inflate by hours.
- Renders:
  - Chinese / English UI switch
  - Current active window
  - Stats dashboard with range switch (6h / 1d / 1w)
  - Top project/app totals
  - Rule management panel
  - Timeline table (with project/tag/source)
  - Timeline search + pagination

## Stack

- Frontend: React + Vite + TypeScript
- Desktop shell: Tauri 2
- Backend: Rust + rusqlite

## Run (dev)

```bash
cd /Users/apple/Documents/code/other/le-web/timing-lite-tauri
npm install
npm run tauri dev
```

## Build (silent dmg)

This command avoids Finder popups from `bundle_dmg.sh` and generates a dmg silently:

```bash
cd /Users/apple/Documents/code/other/le-web/timing-lite-tauri
npm run build:dmg:silent
```

Output:

- App bundle: `src-tauri/target/release/bundle/macos/Timing Lite.app`
- DMG: `src-tauri/target/release/bundle/dmg/Timing-Lite.dmg`

## macOS permission note

On first run, macOS may block front-window capture until you grant permissions:

- System Settings -> Privacy & Security -> Accessibility
- Allow your terminal / built app

If permission is missing, the app will show a warning banner.

## Progress log

- See [PROGRESS.md](/Users/apple/Documents/code/other/le-web/timing-lite-tauri/PROGRESS.md)

## Next steps

- Manual edit/merge for timeline segments
- Daily/weekly report export (CSV)
- Better menu-bar icon styling (template monochrome variant)
