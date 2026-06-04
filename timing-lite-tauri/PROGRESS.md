# Timing Lite Progress

## 2026-04-23

### Milestone: MVP v0.2 (Background + Rules)

Completed:

- Added background collector loop in Rust runtime.
  - Capture continues independently of the frontend polling cycle.
  - Runtime controls: tracking on/off and capture interval.
- Upgraded activity schema with classification fields:
  - `project`, `tag`, `source`
- Added rules table and commands:
  - list rules
  - add rule
  - enable/disable rule
  - delete rule
- Added automatic classification during capture:
  - First enabled matching rule applies project/tag.
  - Match logic: case-insensitive substring on app/window title.
- Upgraded frontend dashboard:
  - Runtime status controls
  - Rules management panel
  - Timeline now shows project/tag/source
- Added Stats Dashboard:
  - Today total
  - Running segments
  - Uncategorized duration
  - Rule coverage (today)
  - Last 7 days trend bars
  - Top project/tag ranking
- Added language support:
  - Chinese / English switch in UI
- Added dashboard time window switch:
  - Last 6 hours / last 1 day / last 1 week
- Added timeline pagination:
  - page size selector
  - prev/next navigation
- Added timeline quick search:
  - app/window/project/tag/source text filter
- Switched long scrolling layout to single-view tabs:
  - Overview / Dashboard / Rules / Timeline
  - One main module visible at a time
- Added silent dmg packaging script:
  - `npm run build:dmg:silent`
  - build app first, then create dmg via `hdiutil` (no Finder popup)
  - Top stats aggregate by `project` first, fallback to app name

Files touched:

- `src-tauri/src/main.rs`
- `src/App.tsx`
- `src/styles.css`

### Known limitations

- Background loop runs while app process is alive; no tray/menu-bar keepalive UX yet.
- Rule matching supports substring only (no regex/wildcards yet).
- Manual timeline edit/merge UI is not implemented yet.

### Next candidates

1. Tray + hide-to-background UX.
2. Daily/weekly report and CSV export.
3. Idle detection and auto-segmentation.
4. Rule tester preview (simulate match before saving).

## 2026-05-25

### Milestone: Stability pass (background + sleep/shutdown gap fix)

Completed:

- Window close now hides the app instead of exiting immediately.
  - The collector keeps running while the app process is alive.
  - Reopening the app from macOS reopen events shows the main window again.
- Timeline duration logic now tracks `last_seen_at` for open segments.
  - Large gaps caused by sleep, shutdown, or long pauses are no longer added into one segment.
  - Existing rows are backfilled automatically on startup.
- App exit now flushes the current open segment before quitting.
- Added a macOS menu-bar status icon.
  - Left click toggles the main window.
  - Menu supports open window, toggle tracking, and quit.
  - App now uses accessory activation policy, so it behaves more like a menu-bar utility.
- Dock visibility is now forced off when the app hides back to the menu bar.

Current limitations:

- The app still relies on the Dock / reopen behavior; there is no dedicated tray or menu-bar icon yet.
- If the process is force-killed, the current segment is only preserved up to the last successful capture tick.

## 2026-06-01

### Milestone: Desktop guardrails

Completed:

- Added single-instance startup behavior.
  - Launching the app again now signals the existing instance to show the main window.
  - Duplicate collector processes are prevented in normal app launches.
- Added desktop window guardrails.
  - Window now starts centered.
  - Minimum window size is enforced to protect the layout.
  - File drag-drop navigation is disabled to avoid accidental webview navigation.
- Improved DMG packaging layout.
  - The generated DMG now includes `Timing Lite.app` and an `Applications` shortcut for drag-to-install.
