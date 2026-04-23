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
