#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{DateTime, Local, NaiveDate, TimeZone, Utc};
#[cfg(target_os = "macos")]
use core_foundation_sys::base::{kCFAllocatorDefault, CFRelease, CFTypeRef};
#[cfg(target_os = "macos")]
use core_foundation_sys::dictionary::{CFDictionaryGetValueIfPresent, CFDictionaryRef};
#[cfg(target_os = "macos")]
use core_foundation_sys::number::{CFBooleanGetValue, CFBooleanRef};
#[cfg(target_os = "macos")]
use core_foundation_sys::string::{CFStringCreateWithCString, CFStringRef, kCFStringEncodingUTF8};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
#[cfg(target_os = "macos")]
use std::ffi::{c_void, CString};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, RunEvent, State, WindowEvent};

#[derive(Clone, Serialize)]
struct ActivityEntry {
  id: i64,
  app_name: String,
  window_title: String,
  bundle_id: Option<String>,
  activity_type: Option<String>,
  entity_name: Option<String>,
  detail: Option<String>,
  workspace: Option<String>,
  file_name: Option<String>,
  domain: Option<String>,
  project: Option<String>,
  tag: Option<String>,
  source: String,
  started_at: String,
  ended_at: Option<String>,
  duration_seconds: i64,
}

#[derive(Clone, Serialize, Default)]
struct StructuredContext {
  bundle_id: Option<String>,
  activity_type: Option<String>,
  entity_name: Option<String>,
  detail: Option<String>,
  workspace: Option<String>,
  file_name: Option<String>,
  domain: Option<String>,
}

#[derive(Clone, Serialize)]
struct ActiveWindow {
  app_name: String,
  window_title: String,
  bundle_id: Option<String>,
  activity_type: Option<String>,
  entity_name: Option<String>,
  detail: Option<String>,
  workspace: Option<String>,
  file_name: Option<String>,
  domain: Option<String>,
  captured_at: String,
}

#[derive(Clone, Serialize)]
struct CaptureResult {
  active: Option<ActiveWindow>,
  warning: Option<String>,
}

#[derive(Clone, Serialize)]
struct RuntimeStatus {
  tracking_enabled: bool,
  interval_ms: u64,
  last_active: Option<ActiveWindow>,
  last_warning: Option<String>,
}

#[derive(Clone, Serialize)]
struct RuleRow {
  id: i64,
  name: String,
  app_pattern: String,
  title_pattern: String,
  project: Option<String>,
  tag: Option<String>,
  enabled: bool,
  priority: i64,
  created_at: String,
}

#[derive(Clone, Serialize)]
struct RuleSuggestions {
  app_names: Vec<String>,
}

#[derive(Clone, Serialize)]
struct DailySummary {
  day_key: String,
  total_seconds: i64,
  uncategorized_seconds: i64,
  running_seconds: i64,
  top_app: Option<String>,
  top_project: Option<String>,
  top_tag: Option<String>,
  entry_count: i64,
  coverage: i64,
  focus_minutes: i64,
}

#[derive(Deserialize)]
struct NewRuleInput {
  name: String,
  app_pattern: String,
  title_pattern: String,
  project: Option<String>,
  tag: Option<String>,
  priority: Option<i64>,
}

#[derive(Clone)]
struct RuntimeState {
  tracking_enabled: bool,
  interval_ms: u64,
  last_active: Option<ActiveWindow>,
  last_warning: Option<String>,
  allow_window_close: bool,
}

type SharedState = Arc<Mutex<RuntimeState>>;

const MENU_SHOW: &str = "tray_show";
const MENU_TOGGLE_TRACKING: &str = "tray_toggle_tracking";
const MENU_QUIT: &str = "tray_quit";
const SINGLE_INSTANCE_ADDR: &str = "127.0.0.1:45873";
const RAW_RETENTION_DAYS: i64 = 30;
const META_RETENTION_LAST_RUN_DAY: &str = "retention_last_run_day";

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
  fn CGSessionCopyCurrentDictionary() -> CFDictionaryRef;
}

fn db_dir() -> Result<PathBuf, String> {
  let home = std::env::var("HOME").map_err(|e| format!("HOME not found: {e}"))?;
  let mut p = PathBuf::from(home);
  p.push(".timing-lite");
  fs::create_dir_all(&p).map_err(|e| format!("create db dir failed: {e}"))?;
  Ok(p)
}

fn db_path() -> Result<PathBuf, String> {
  let mut p = db_dir()?;
  p.push("timing-lite.db");
  Ok(p)
}

fn open_db() -> Result<Connection, String> {
  let path = db_path()?;
  let conn = Connection::open(path).map_err(|e| format!("open db failed: {e}"))?;
  Ok(conn)
}

fn table_has_column(conn: &Connection, table: &str, column: &str) -> Result<bool, String> {
  let sql = format!("pragma table_info({table})");
  let mut stmt = conn
    .prepare(&sql)
    .map_err(|e| format!("prepare pragma failed: {e}"))?;

  let mut rows = stmt
    .query([])
    .map_err(|e| format!("query pragma failed: {e}"))?;
  while let Some(row) = rows.next().map_err(|e| format!("read pragma row failed: {e}"))? {
    let name: String = row.get(1).map_err(|e| format!("decode pragma row failed: {e}"))?;
    if name == column {
      return Ok(true);
    }
  }
  Ok(false)
}

fn ensure_column(conn: &Connection, table: &str, column: &str, ddl: &str) -> Result<(), String> {
  if table_has_column(conn, table, column)? {
    return Ok(());
  }
  conn
    .execute(ddl, [])
    .map_err(|e| format!("add column {table}.{column} failed: {e}"))?;
  Ok(())
}

fn init_db_internal() -> Result<(), String> {
  let mut conn = open_db()?;
  conn
    .execute_batch(
      r#"
      create table if not exists activity_entries (
        id integer primary key autoincrement,
        app_name text not null,
        window_title text not null default '',
        started_at text not null,
        ended_at text null,
        duration_seconds integer not null default 0,
        last_seen_at text null
      );

      create table if not exists rules (
        id integer primary key autoincrement,
        name text not null,
        app_pattern text not null default '',
        title_pattern text not null default '',
        project text null,
        tag text null,
        enabled integer not null default 1,
        priority integer not null default 100,
        created_at text not null
      );

      create table if not exists activity_archive_daily (
        id integer primary key autoincrement,
        archive_day text not null,
        app_name text not null,
        activity_type text null,
        entity_name text null,
        domain text null,
        project text null,
        tag text null,
        source text not null default 'default',
        total_duration_seconds integer not null default 0,
        segment_count integer not null default 0,
        first_started_at text null,
        last_ended_at text null,
        archived_at text not null
      );

      create table if not exists app_meta (
        key text primary key,
        value text not null
      );

      create index if not exists idx_activity_entries_started_at on activity_entries(started_at);
      create index if not exists idx_archive_daily_day on activity_archive_daily(archive_day);
    "#,
    )
    .map_err(|e| format!("create tables failed: {e}"))?;

  ensure_column(
    &conn,
    "activity_entries",
    "project",
    "alter table activity_entries add column project text null",
  )?;
  ensure_column(
    &conn,
    "activity_entries",
    "tag",
    "alter table activity_entries add column tag text null",
  )?;
  ensure_column(
    &conn,
    "activity_entries",
    "source",
    "alter table activity_entries add column source text not null default 'manual'",
  )?;
  ensure_column(
    &conn,
    "activity_entries",
    "last_seen_at",
    "alter table activity_entries add column last_seen_at text null",
  )?;
  ensure_column(
    &conn,
    "activity_entries",
    "bundle_id",
    "alter table activity_entries add column bundle_id text null",
  )?;
  ensure_column(
    &conn,
    "activity_entries",
    "activity_type",
    "alter table activity_entries add column activity_type text null",
  )?;
  ensure_column(
    &conn,
    "activity_entries",
    "entity_name",
    "alter table activity_entries add column entity_name text null",
  )?;
  ensure_column(
    &conn,
    "activity_entries",
    "detail",
    "alter table activity_entries add column detail text null",
  )?;
  ensure_column(
    &conn,
    "activity_entries",
    "workspace",
    "alter table activity_entries add column workspace text null",
  )?;
  ensure_column(
    &conn,
    "activity_entries",
    "file_name",
    "alter table activity_entries add column file_name text null",
  )?;
  ensure_column(
    &conn,
    "activity_entries",
    "domain",
    "alter table activity_entries add column domain text null",
  )?;

  conn
    .execute(
      "update activity_entries
       set last_seen_at = coalesce(ended_at, started_at)
       where last_seen_at is null or trim(last_seen_at) = ''",
      [],
    )
    .map_err(|e| format!("backfill last_seen_at failed: {e}"))?;

  backfill_structured_context(&conn)?;
  run_retention_maintenance(&mut conn)?;

  Ok(())
}

#[tauri::command]
fn init_db() -> Result<(), String> {
  init_db_internal()
}

fn resolve_local_midnight(date: NaiveDate) -> Result<DateTime<Local>, String> {
  let naive = date
    .and_hms_opt(0, 0, 0)
    .ok_or_else(|| format!("invalid local midnight for {date}"))?;
  Local
    .from_local_datetime(&naive)
    .single()
    .or_else(|| Local.from_local_datetime(&naive).earliest())
    .ok_or_else(|| format!("resolve local midnight failed for {date}"))
}

fn local_day_bounds_utc(day_key: &str) -> Result<(i64, i64), String> {
  let day = NaiveDate::parse_from_str(day_key, "%Y-%m-%d")
    .map_err(|e| format!("parse day key failed: {e}"))?;
  let start_local = resolve_local_midnight(day)?;
  let next_day = day
    .succ_opt()
    .ok_or_else(|| "next day overflow".to_string())?;
  let end_local = resolve_local_midnight(next_day)?;
  Ok((
    start_local.with_timezone(&Utc).timestamp(),
    end_local.with_timezone(&Utc).timestamp(),
  ))
}

fn entry_window_seconds(row: &ActivityEntry) -> Result<(i64, i64), String> {
  let started = parse_rfc3339_utc(&row.started_at)?;
  let start_sec = started.timestamp();
  let end_sec = start_sec + row.duration_seconds.max(0);
  Ok((start_sec, end_sec))
}

fn overlap_seconds(window_start_sec: i64, window_end_sec: i64, start_sec: i64, end_sec: i64) -> i64 {
  (window_end_sec.min(end_sec) - window_start_sec.max(start_sec)).max(0)
}

fn top_map_name(map: &HashMap<String, i64>) -> Option<String> {
  map.iter()
    .max_by(|a, b| a.1.cmp(b.1).then_with(|| b.0.cmp(a.0)))
    .map(|(name, _)| name.clone())
}

fn load_entries_overlapping_range(
  conn: &Connection,
  range_start_sec: i64,
  range_end_sec: i64,
  max_gap_seconds: i64,
) -> Result<Vec<ActivityEntry>, String> {
  let effective_tail = "case
      when ended_at is null then min(?3, max(0, strftime('%s','now') - strftime('%s', coalesce(last_seen_at, started_at))))
      else 0
    end";
  let sql = format!(
    "select
       id,
       app_name,
       window_title,
       bundle_id,
       activity_type,
       entity_name,
       detail,
       workspace,
       file_name,
       domain,
       project,
       tag,
       source,
       started_at,
       ended_at,
       duration_seconds + {effective_tail} as effective_duration
     from activity_entries
     where strftime('%s', started_at) < ?2
       and (strftime('%s', started_at) + duration_seconds + {effective_tail}) > ?1
     order by started_at desc"
  );

  let mut stmt = conn
    .prepare(&sql)
    .map_err(|e| format!("prepare overlapping entries failed: {e}"))?;

  let rows = stmt
    .query_map(params![range_start_sec, range_end_sec, max_gap_seconds], |row| {
      Ok(ActivityEntry {
        id: row.get(0)?,
        app_name: row.get(1)?,
        window_title: row.get(2)?,
        bundle_id: row.get(3)?,
        activity_type: row.get(4)?,
        entity_name: row.get(5)?,
        detail: row.get(6)?,
        workspace: row.get(7)?,
        file_name: row.get(8)?,
        domain: row.get(9)?,
        project: row.get(10)?,
        tag: row.get(11)?,
        source: row.get(12)?,
        started_at: row.get(13)?,
        ended_at: row.get(14)?,
        duration_seconds: row.get(15)?,
      })
    })
    .map_err(|e| format!("query overlapping entries failed: {e}"))?;

  let mut out = Vec::new();
  for row in rows {
    out.push(row.map_err(|e| format!("decode overlapping entry failed: {e}"))?);
  }
  Ok(out)
}

fn normalize_frontmost_app(app_name: &str, bundle_id: Option<&str>) -> String {
  match bundle_id.unwrap_or_default() {
    "com.microsoft.VSCode" => "Visual Studio Code".to_string(),
    "com.microsoft.VSCodeInsiders" => "Visual Studio Code Insiders".to_string(),
    "com.vscodium" => "VSCodium".to_string(),
    "com.todesktop.230313mzl4w4u92" => "Cursor".to_string(),
    _ => app_name.to_string(),
  }
}

fn normalize_optional_text(value: &str) -> Option<String> {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    None
  } else {
    Some(trimmed.to_string())
  }
}

fn first_non_empty(values: &[Option<String>]) -> Option<String> {
  values.iter().find_map(|value| value.clone())
}

fn split_title_parts(title: &str) -> Vec<String> {
  let mut normalized = title.to_string();
  for sep in [" — ", " – ", " | ", " · ", " • ", " —", " –", " |", " ·", " •"] {
    normalized = normalized.replace(sep, "||");
  }
  normalized
    .split("||")
    .map(str::trim)
    .filter(|part| !part.is_empty())
    .map(ToOwned::to_owned)
    .collect()
}

fn strip_known_suffix(mut parts: Vec<String>, app_name: &str) -> Vec<String> {
  let app_lower = app_name.trim().to_lowercase();
  while let Some(last) = parts.last() {
    let lower = last.trim().to_lowercase();
    let is_known_suffix = lower == app_lower
      || matches!(
        lower.as_str(),
        "google chrome"
          | "chrome"
          | "arc"
          | "safari"
          | "brave browser"
          | "microsoft edge"
          | "firefox"
          | "visual studio code"
          | "visual studio code insiders"
          | "cursor"
          | "vscodium"
          | "iterm2"
          | "terminal"
      );
    if is_known_suffix {
      parts.pop();
    } else {
      break;
    }
  }
  parts
}

fn infer_known_domain(title_lower: &str) -> Option<String> {
  if let Some(domain) = extract_domain_from_text(title_lower) {
    return Some(domain);
  }

  [
    ("github", "github.com"),
    ("figma", "figma.com"),
    ("vercel", "vercel.com"),
    ("supabase", "supabase.com"),
    ("notion", "notion.so"),
    ("slack", "slack.com"),
    ("docs.google", "docs.google.com"),
    ("google docs", "docs.google.com"),
    ("openai", "openai.com"),
    ("deepseek", "deepseek.com"),
    ("x.com", "x.com"),
    ("twitter", "x.com"),
    ("youtube", "youtube.com"),
  ]
  .into_iter()
  .find_map(|(needle, domain)| title_lower.contains(needle).then(|| domain.to_string()))
}

fn extract_domain_from_text(text: &str) -> Option<String> {
  for prefix in ["https://", "http://"] {
    if let Some(start) = text.find(prefix) {
      let rest = &text[start + prefix.len()..];
      let host = rest
        .split(['/', '?', '#', ' '])
        .next()
        .unwrap_or("")
        .trim()
        .trim_start_matches("www.");
      if !host.is_empty() {
        return Some(host.to_string());
      }
    }
  }
  None
}

fn finalize_context(app_name: &str, mut context: StructuredContext) -> StructuredContext {
  if context.entity_name.is_none() {
    context.entity_name = Some(app_name.to_string());
  }
  context
}

fn should_ignore_app(app_name: &str, bundle_id: Option<&str>) -> bool {
  matches!(
    bundle_id.unwrap_or_default(),
    "com.apple.notificationcenterui" | "com.apple.dock"
  ) || matches!(
    app_name,
    "Timing Lite" | "timing_lite_tauri" | "Window Server" | "Notification Center" | "Dock"
  )
}

fn is_session_locked() -> Result<bool, String> {
  #[cfg(target_os = "macos")]
  unsafe {
    let session = CGSessionCopyCurrentDictionary();
    if session.is_null() {
      return Ok(false);
    }

    let key_name = CString::new("kCGSSessionOnConsoleKey")
      .map_err(|e| format!("build lock-state key failed: {e}"))?;
    let key: CFStringRef =
      CFStringCreateWithCString(kCFAllocatorDefault, key_name.as_ptr(), kCFStringEncodingUTF8);

    if key.is_null() {
      CFRelease(session as CFTypeRef);
      return Ok(false);
    }

    let mut value: *const c_void = std::ptr::null();
    let present = CFDictionaryGetValueIfPresent(
      session,
      key as *const c_void,
      &mut value as *mut *const c_void,
    );

    let locked = present != 0
      && !value.is_null()
      && !CFBooleanGetValue(value as CFBooleanRef);

    CFRelease(key as CFTypeRef);
    CFRelease(session as CFTypeRef);

    Ok(locked)
  }

  #[cfg(not(target_os = "macos"))]
  {
    Ok(false)
  }
}

fn looks_like_editor(app_name: &str, bundle_id: Option<&str>) -> bool {
  matches!(
    bundle_id.unwrap_or_default(),
    "com.microsoft.VSCode"
      | "com.microsoft.VSCodeInsiders"
      | "com.vscodium"
      | "com.todesktop.230313mzl4w4u92"
  ) || matches!(
    app_name,
    "Visual Studio Code" | "Visual Studio Code Insiders" | "VSCodium" | "Cursor"
  )
}

fn looks_like_browser(app_name: &str, bundle_id: Option<&str>) -> bool {
  matches!(
    bundle_id.unwrap_or_default(),
    "com.google.Chrome"
      | "company.thebrowser.Browser"
      | "com.apple.Safari"
      | "com.brave.Browser"
      | "com.microsoft.edgemac"
      | "org.mozilla.firefox"
  ) || matches!(
    app_name,
    "Google Chrome" | "Arc" | "Safari" | "Brave Browser" | "Microsoft Edge" | "Firefox"
  )
}

fn build_editor_context(app_name: &str, bundle_id: Option<&str>, window_title: &str) -> StructuredContext {
  let parts = strip_known_suffix(split_title_parts(window_title), app_name);
  let file_name = parts.first().and_then(|value| normalize_optional_text(value));
  let workspace = parts.get(1).and_then(|value| normalize_optional_text(value));
  let entity_name = first_non_empty(&[workspace.clone(), file_name.clone(), Some(app_name.to_string())]);

  finalize_context(
    app_name,
    StructuredContext {
      bundle_id: bundle_id.and_then(normalize_optional_text),
      activity_type: Some("coding".to_string()),
      entity_name,
      detail: file_name.clone(),
      workspace,
      file_name,
      domain: None,
    },
  )
}

fn build_browser_context(app_name: &str, bundle_id: Option<&str>, window_title: &str) -> StructuredContext {
  let title_lower = window_title.to_lowercase();
  let parts = strip_known_suffix(split_title_parts(window_title), app_name);
  let domain = infer_known_domain(&title_lower);
  let site_name = parts
    .last()
    .and_then(|last| {
      let lower = last.to_lowercase();
      matches!(
        lower.as_str(),
        "github"
          | "figma"
          | "vercel"
          | "supabase"
          | "notion"
          | "slack"
          | "google docs"
          | "docs"
          | "openai"
          | "deepseek"
          | "youtube"
      )
      .then(|| last.clone())
    });
  let activity_type = if matches!(
    domain.as_deref(),
    Some("docs.google.com" | "notion.so" | "openai.com")
  ) {
    Some("docs".to_string())
  } else {
    Some("browser".to_string())
  };

  let entity_name = if site_name.is_some() && parts.len() >= 2 {
    normalize_optional_text(parts[parts.len() - 2].as_str())
  } else {
    parts
      .first()
      .and_then(|value| normalize_optional_text(value))
      .or_else(|| domain.clone())
  };

  let detail = parts
    .first()
    .and_then(|value| normalize_optional_text(value))
    .or_else(|| normalize_optional_text(window_title));

  finalize_context(
    app_name,
    StructuredContext {
      bundle_id: bundle_id.and_then(normalize_optional_text),
      activity_type,
      entity_name,
      detail,
      workspace: None,
      file_name: None,
      domain,
    },
  )
}

fn build_terminal_context(app_name: &str, bundle_id: Option<&str>, window_title: &str) -> StructuredContext {
  let workspace = window_title
    .split_whitespace()
    .find(|part| part.starts_with('/') && part.len() > 1)
    .and_then(|path| path.rsplit('/').next())
    .and_then(normalize_optional_text);

  finalize_context(
    app_name,
    StructuredContext {
      bundle_id: bundle_id.and_then(normalize_optional_text),
      activity_type: Some("terminal".to_string()),
      entity_name: workspace.clone(),
      detail: normalize_optional_text(window_title),
      workspace,
      file_name: None,
      domain: None,
    },
  )
}

fn build_chat_context(app_name: &str, bundle_id: Option<&str>, window_title: &str, activity_type: &str) -> StructuredContext {
  let parts = split_title_parts(window_title);
  finalize_context(
    app_name,
    StructuredContext {
      bundle_id: bundle_id.and_then(normalize_optional_text),
      activity_type: Some(activity_type.to_string()),
      entity_name: parts.first().and_then(|value| normalize_optional_text(value)),
      detail: normalize_optional_text(window_title),
      workspace: None,
      file_name: None,
      domain: None,
    },
  )
}

fn extract_structured_context(app_name: &str, bundle_id: Option<&str>, window_title: &str) -> StructuredContext {
  if looks_like_editor(app_name, bundle_id) {
    return build_editor_context(app_name, bundle_id, window_title);
  }

  if looks_like_browser(app_name, bundle_id) {
    return build_browser_context(app_name, bundle_id, window_title);
  }

  match app_name {
    "Terminal" | "iTerm2" => build_terminal_context(app_name, bundle_id, window_title),
    "Slack" | "Telegram" | "Discord" | "Messages" | "WeChat" | "企业微信" | "微信" => {
      build_chat_context(app_name, bundle_id, window_title, "chat")
    }
    "Zoom" | "Tencent Meeting" | "飞书" | "Feishu" => {
      build_chat_context(app_name, bundle_id, window_title, "meeting")
    }
    "Figma" => finalize_context(app_name, StructuredContext {
      bundle_id: bundle_id.and_then(normalize_optional_text),
      activity_type: Some("design".to_string()),
      entity_name: split_title_parts(window_title)
        .first()
        .and_then(|value| normalize_optional_text(value)),
      detail: normalize_optional_text(window_title),
      workspace: None,
      file_name: None,
      domain: Some("figma.com".to_string()),
    }),
    "Finder" => finalize_context(app_name, StructuredContext {
      bundle_id: bundle_id.and_then(normalize_optional_text),
      activity_type: Some("files".to_string()),
      entity_name: split_title_parts(window_title)
        .first()
        .and_then(|value| normalize_optional_text(value)),
      detail: normalize_optional_text(window_title),
      workspace: None,
      file_name: None,
      domain: None,
    }),
    "Preview" | "Notion" | "Notes" => finalize_context(app_name, StructuredContext {
      bundle_id: bundle_id.and_then(normalize_optional_text),
      activity_type: Some("docs".to_string()),
      entity_name: split_title_parts(window_title)
        .first()
        .and_then(|value| normalize_optional_text(value)),
      detail: normalize_optional_text(window_title),
      workspace: None,
      file_name: None,
      domain: (app_name == "Notion").then(|| "notion.so".to_string()),
    }),
    "Codex" | "Claude" | "Chatbox" | "ChatGPT" => finalize_context(app_name, StructuredContext {
      bundle_id: bundle_id.and_then(normalize_optional_text),
      activity_type: Some("ai".to_string()),
      entity_name: split_title_parts(window_title)
        .first()
        .and_then(|value| normalize_optional_text(value))
        .or_else(|| Some(app_name.to_string())),
      detail: normalize_optional_text(window_title),
      workspace: None,
      file_name: None,
      domain: None,
    }),
    _ => finalize_context(app_name, StructuredContext {
      bundle_id: bundle_id.and_then(normalize_optional_text),
      activity_type: None,
      entity_name: split_title_parts(window_title)
        .first()
        .and_then(|value| normalize_optional_text(value)),
      detail: normalize_optional_text(window_title),
      workspace: None,
      file_name: None,
      domain: infer_known_domain(&window_title.to_lowercase()),
    }),
  }
}

fn read_browser_tab_summary(bundle_id: &str) -> Option<String> {
  let script = match bundle_id {
    "com.google.Chrome" | "company.thebrowser.Browser" | "com.brave.Browser" | "com.microsoft.edgemac" => {
      format!(
        "tell application id \"{bundle_id}\" to try
           return (title of active tab of front window) & \" | \" & (URL of active tab of front window)
         on error
           return \"\"
         end try"
      )
    }
    "com.apple.Safari" => {
      "tell application id \"com.apple.Safari\" to try
         return (name of front document) & \" | \" & (URL of front document)
       on error
         return \"\"
       end try"
        .to_string()
    }
    _ => return None,
  };

  let output = Command::new("osascript").arg("-e").arg(script).output().ok()?;
  if !output.status.success() {
    return None;
  }
  normalize_optional_text(String::from_utf8_lossy(&output.stdout).trim())
}

fn backfill_structured_context(conn: &Connection) -> Result<(), String> {
  let mut stmt = conn
    .prepare(
      "select id, app_name, window_title, bundle_id
       from activity_entries
       where activity_type is null
          or entity_name is null
          or detail is null
          or workspace is null
          or file_name is null
          or domain is null",
    )
    .map_err(|e| format!("prepare context backfill failed: {e}"))?;

  let rows = stmt
    .query_map([], |row| {
      Ok((
        row.get::<_, i64>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, Option<String>>(3)?,
      ))
    })
    .map_err(|e| format!("query context backfill failed: {e}"))?;

  let mut pending = Vec::new();
  for row in rows {
    pending.push(row.map_err(|e| format!("decode context backfill row failed: {e}"))?);
  }
  drop(stmt);

  for (id, app_name, window_title, bundle_id) in pending {
    let context = extract_structured_context(&app_name, bundle_id.as_deref(), &window_title);
    conn
      .execute(
        "update activity_entries
         set bundle_id = coalesce(bundle_id, ?1),
             activity_type = coalesce(activity_type, ?2),
             entity_name = coalesce(entity_name, ?3),
             detail = coalesce(detail, ?4),
             workspace = coalesce(workspace, ?5),
             file_name = coalesce(file_name, ?6),
             domain = coalesce(domain, ?7)
         where id = ?8",
        params![
          context.bundle_id,
          context.activity_type,
          context.entity_name,
          context.detail,
          context.workspace,
          context.file_name,
          context.domain,
          id
        ],
      )
      .map_err(|e| format!("update context backfill failed: {e}"))?;
  }

  Ok(())
}

fn get_app_meta(conn: &Connection, key: &str) -> Result<Option<String>, String> {
  conn
    .query_row("select value from app_meta where key = ?1", params![key], |row| row.get(0))
    .optional()
    .map_err(|e| format!("query app_meta {key} failed: {e}"))
}

fn set_app_meta(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
  conn
    .execute(
      "insert into app_meta (key, value) values (?1, ?2)
       on conflict(key) do update set value = excluded.value",
      params![key, value],
    )
    .map_err(|e| format!("update app_meta {key} failed: {e}"))?;
  Ok(())
}

fn run_retention_maintenance(conn: &mut Connection) -> Result<(), String> {
  let today_key = Utc::now().format("%Y-%m-%d").to_string();
  if get_app_meta(conn, META_RETENTION_LAST_RUN_DAY)?.as_deref() == Some(today_key.as_str()) {
    return Ok(());
  }

  let cutoff = (Utc::now() - chrono::Duration::days(RAW_RETENTION_DAYS)).to_rfc3339();
  let archived_at = Utc::now().to_rfc3339();

  let tx = conn
    .transaction()
    .map_err(|e| format!("start retention transaction failed: {e}"))?;

  let old_count: i64 = tx
    .query_row(
      "select count(*) from activity_entries
       where ended_at is not null and started_at < ?1",
      params![cutoff],
      |row| row.get(0),
    )
    .map_err(|e| format!("count retention rows failed: {e}"))?;

  if old_count > 0 {
    tx
      .execute(
        "insert into activity_archive_daily (
           archive_day,
           app_name,
           activity_type,
           entity_name,
           domain,
           project,
           tag,
           source,
           total_duration_seconds,
           segment_count,
           first_started_at,
           last_ended_at,
           archived_at
         )
         select
           substr(started_at, 1, 10) as archive_day,
           app_name,
           activity_type,
           coalesce(entity_name, app_name) as entity_name,
           domain,
           project,
           tag,
           source,
           sum(duration_seconds) as total_duration_seconds,
           count(*) as segment_count,
           min(started_at) as first_started_at,
           max(coalesce(ended_at, last_seen_at, started_at)) as last_ended_at,
           ?2 as archived_at
         from activity_entries
         where ended_at is not null and started_at < ?1
         group by
           substr(started_at, 1, 10),
           app_name,
           activity_type,
           coalesce(entity_name, app_name),
           domain,
           project,
           tag,
           source",
        params![cutoff, archived_at],
      )
      .map_err(|e| format!("archive retention rows failed: {e}"))?;

    tx
      .execute(
        "delete from activity_entries
         where ended_at is not null and started_at < ?1",
        params![cutoff],
      )
      .map_err(|e| format!("delete retained raw rows failed: {e}"))?;
  }

  set_app_meta(&tx, META_RETENTION_LAST_RUN_DAY, &today_key)?;
  tx
    .commit()
    .map_err(|e| format!("commit retention transaction failed: {e}"))?;

  Ok(())
}

fn read_frontmost_window() -> Result<(String, String, Option<String>), String> {
  #[cfg(target_os = "macos")]
  {
    let script = r#"
      tell application "System Events"
        set frontProc to first application process whose frontmost is true
        set frontApp to name of frontProc
        try
          set frontBundle to bundle identifier of frontProc
        on error
          set frontBundle to ""
        end try
        tell frontProc
          try
            set winName to value of attribute "AXTitle" of front window
          on error
            try
              set winName to name of front window
            on error
              set winName to ""
            end try
          end try
        end tell
      end tell
      return frontApp & "||" & frontBundle & "||" & winName
    "#;
    let output = Command::new("osascript")
      .arg("-e")
      .arg(script)
      .output()
      .map_err(|e| format!("run osascript failed: {e}"))?;
    if !output.status.success() {
      let stderr = String::from_utf8_lossy(&output.stderr).to_string();
      return Err(format!(
        "cannot capture front window. Grant Accessibility permission and retry. details: {stderr}"
      ));
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let mut parts = value.splitn(3, "||");
    let app = parts.next().unwrap_or("").trim().to_string();
    let bundle_id = parts.next().unwrap_or("").trim().to_string();
    let title = parts.next().unwrap_or("").trim().to_string();
    if app.is_empty() {
      return Err("front app is empty".to_string());
    }
    let normalized_app = normalize_frontmost_app(&app, (!bundle_id.is_empty()).then_some(bundle_id.as_str()));
    let normalized_bundle = if bundle_id.is_empty() { None } else { Some(bundle_id) };
    let resolved_title = if title.is_empty() {
      normalized_bundle
        .as_deref()
        .and_then(read_browser_tab_summary)
        .unwrap_or(title)
    } else {
      title
    };
    Ok((normalized_app, resolved_title, normalized_bundle))
  }
  #[cfg(not(target_os = "macos"))]
  {
    Err("front-window capture is implemented for macOS only in this MVP".to_string())
  }
}

fn parse_rfc3339_utc(value: &str) -> Result<DateTime<Utc>, String> {
  DateTime::parse_from_rfc3339(value)
    .map(|dt| dt.with_timezone(&Utc))
    .map_err(|e| format!("parse rfc3339 failed: {e}"))
}

fn tracking_gap_seconds(interval_ms: u64) -> i64 {
  (((interval_ms.clamp(2000, 30000) as i64) * 3) / 1000).clamp(10, 60)
}

fn compute_delta_seconds(start_at: &str, end_at: &str) -> Result<i64, String> {
  let start_ts = parse_rfc3339_utc(start_at)?;
  let end_ts = parse_rfc3339_utc(end_at)?;
  Ok((end_ts.timestamp() - start_ts.timestamp()).max(0))
}

fn live_tail_seconds(last_seen_at: &str, ended_at: &str, max_gap_seconds: i64) -> Result<i64, String> {
  let delta = compute_delta_seconds(last_seen_at, ended_at)?;
  if delta > max_gap_seconds {
    Ok(0)
  } else {
    Ok(delta)
  }
}

fn close_last_open_entry(conn: &Connection, ended_at: &str, max_gap_seconds: i64) -> Result<(), String> {
  let mut stmt = conn
    .prepare(
      "select id, coalesce(last_seen_at, started_at), duration_seconds from activity_entries
       where ended_at is null
       order by id desc limit 1",
    )
    .map_err(|e| format!("prepare select last failed: {e}"))?;

  let row = stmt
    .query_row([], |row| {
      let id: i64 = row.get(0)?;
      let last_seen_at: String = row.get(1)?;
      let duration_seconds: i64 = row.get(2)?;
      Ok((id, last_seen_at, duration_seconds))
    })
    .ok();

  if let Some((id, last_seen_at, duration_seconds)) = row {
    let tail = live_tail_seconds(&last_seen_at, ended_at, max_gap_seconds)?;
    let safe_ended_at = if tail == 0 {
      last_seen_at.clone()
    } else {
      ended_at.to_string()
    };
    conn
      .execute(
        "update activity_entries
         set ended_at = ?1, last_seen_at = ?1, duration_seconds = ?2
         where id = ?3",
        params![safe_ended_at, duration_seconds + tail, id],
      )
      .map_err(|e| format!("update last entry failed: {e}"))?;
  }
  Ok(())
}

fn close_stale_open_entry(conn: &Connection, now: &str, max_gap_seconds: i64) -> Result<(), String> {
  let mut stmt = conn
    .prepare(
      "select coalesce(last_seen_at, started_at)
       from activity_entries
       where ended_at is null
       order by id desc limit 1",
    )
    .map_err(|e| format!("prepare stale open query failed: {e}"))?;

  let last_seen_at = stmt.query_row([], |row| row.get::<_, String>(0)).ok();
  if let Some(last_seen_at) = last_seen_at {
    let delta = compute_delta_seconds(&last_seen_at, now)?;
    if delta > max_gap_seconds {
      close_last_open_entry(conn, &last_seen_at, max_gap_seconds)?;
    }
  }

  Ok(())
}

fn finalize_open_entry(interval_ms: u64) -> Result<(), String> {
  init_db_internal()?;
  let conn = open_db()?;
  let now = Utc::now().to_rfc3339();
  close_last_open_entry(&conn, &now, tracking_gap_seconds(interval_ms))
}

fn set_tracking_enabled_internal(state: &SharedState, enabled: bool) -> Result<RuntimeStatus, String> {
  let mut st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
  st.tracking_enabled = enabled;
  Ok(RuntimeStatus {
    tracking_enabled: st.tracking_enabled,
    interval_ms: st.interval_ms,
    last_active: st.last_active.clone(),
    last_warning: st.last_warning.clone(),
  })
}

fn toggle_tracking_internal(state: &SharedState) -> Result<RuntimeStatus, String> {
  let enabled = {
    let st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
    !st.tracking_enabled
  };
  set_tracking_enabled_internal(state, enabled)
}

fn show_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
  #[cfg(target_os = "macos")]
  let _ = app.set_dock_visibility(false);
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.set_skip_taskbar(true);
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
}

fn toggle_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
  if let Some(window) = app.get_webview_window("main") {
    let is_visible = window.is_visible().unwrap_or(false);
    if is_visible {
      let _ = window.hide();
      #[cfg(target_os = "macos")]
      let _ = app.set_dock_visibility(false);
    } else {
      #[cfg(target_os = "macos")]
      let _ = app.set_dock_visibility(false);
      let _ = window.set_skip_taskbar(true);
      let _ = window.show();
      let _ = window.unminimize();
      let _ = window.set_focus();
    }
  }
}

fn notify_existing_instance() {
  if let Ok(mut stream) = TcpStream::connect(SINGLE_INSTANCE_ADDR) {
    let _ = stream.write_all(b"show");
  }
}

fn spawn_single_instance_server<R: tauri::Runtime>(app: tauri::AppHandle<R>, listener: TcpListener) {
  thread::spawn(move || {
    for incoming in listener.incoming() {
      if incoming.is_err() {
        continue;
      }

      let app_handle = app.clone();
      let _ = app.run_on_main_thread(move || {
        show_main_window(&app_handle);
      });
    }
  });
}

fn build_tray<R: tauri::Runtime>(app: &tauri::AppHandle<R>, state: SharedState) -> Result<(), String> {
  let show_item =
    MenuItem::with_id(app, MENU_SHOW, "Open Timing Lite", true, None::<&str>)
      .map_err(|e| format!("create tray show item failed: {e}"))?;
  let toggle_tracking_item =
    MenuItem::with_id(app, MENU_TOGGLE_TRACKING, "Pause / Resume Tracking", true, None::<&str>)
      .map_err(|e| format!("create tray toggle item failed: {e}"))?;
  let quit_item =
    MenuItem::with_id(app, MENU_QUIT, "Quit", true, None::<&str>)
      .map_err(|e| format!("create tray quit item failed: {e}"))?;
  let separator =
    PredefinedMenuItem::separator(app).map_err(|e| format!("create tray separator failed: {e}"))?;

  let menu = Menu::with_items(
    app,
    &[&show_item, &toggle_tracking_item, &separator, &quit_item],
  )
  .map_err(|e| format!("create tray menu failed: {e}"))?;

  let icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))
    .map_err(|e| format!("load tray icon failed: {e}"))?;

  TrayIconBuilder::with_id("timing-lite-status")
    .icon(icon)
    .tooltip("Timing Lite")
    .menu(&menu)
    .icon_as_template(false)
    .show_menu_on_left_click(false)
    .on_tray_icon_event(move |_tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        toggle_main_window(_tray.app_handle());
      }
    })
    .on_menu_event(move |app, event| {
      if event.id() == MENU_SHOW {
        show_main_window(app);
      } else if event.id() == MENU_TOGGLE_TRACKING {
        let _ = toggle_tracking_internal(&state);
      } else if event.id() == MENU_QUIT {
        if let Ok(mut st) = state.lock() {
          st.allow_window_close = true;
          let _ = finalize_open_entry(st.interval_ms);
        }
        app.exit(0);
      }
    })
    .build(app)
    .map_err(|e| format!("build tray icon failed: {e}"))?;

  Ok(())
}

fn normalize_like(s: &str) -> String {
  s.trim().to_lowercase()
}

fn rule_matches(rule: &RuleRow, app_name: &str, title: &str) -> bool {
  let app = normalize_like(app_name);
  let win = normalize_like(title);
  let app_rule = normalize_like(&rule.app_pattern);
  let title_rule = normalize_like(&rule.title_pattern);

  let app_ok = app_rule.is_empty() || app.contains(&app_rule);
  let title_ok = title_rule.is_empty() || win.contains(&title_rule);
  app_ok && title_ok
}

fn classify_with_rules(
  rules: &[RuleRow],
  app_name: &str,
  window_title: &str,
) -> (Option<String>, Option<String>, String) {
  for rule in rules.iter().filter(|r| r.enabled) {
    if rule_matches(rule, app_name, window_title) {
      return (
        rule.project.clone(),
        rule.tag.clone(),
        format!("rule:{}", rule.name),
      );
    }
  }
  (None, None, "default".to_string())
}

fn list_rules_internal() -> Result<Vec<RuleRow>, String> {
  let conn = open_db()?;
  let mut stmt = conn
    .prepare(
      "select id, name, app_pattern, title_pattern, project, tag, enabled, priority, created_at
       from rules
       order by priority asc, id asc",
    )
    .map_err(|e| format!("prepare list rules failed: {e}"))?;

  let rows = stmt
    .query_map([], |row| {
      let enabled_i: i64 = row.get(6)?;
      Ok(RuleRow {
        id: row.get(0)?,
        name: row.get(1)?,
        app_pattern: row.get(2)?,
        title_pattern: row.get(3)?,
        project: row.get(4)?,
        tag: row.get(5)?,
        enabled: enabled_i == 1,
        priority: row.get(7)?,
        created_at: row.get(8)?,
      })
    })
    .map_err(|e| format!("query list rules failed: {e}"))?;

  let mut out = Vec::new();
  for row in rows {
    out.push(row.map_err(|e| format!("decode rule row failed: {e}"))?);
  }
  Ok(out)
}

fn classify(app_name: &str, window_title: &str) -> Result<(Option<String>, Option<String>, String), String> {
  let rules = list_rules_internal()?;
  Ok(classify_with_rules(&rules, app_name, window_title))
}

fn reapply_rules_internal(conn: &Connection) -> Result<(), String> {
  let rules = list_rules_internal()?;
  let mut stmt = conn
    .prepare("select id, app_name, window_title from activity_entries")
    .map_err(|e| format!("prepare reapply rules failed: {e}"))?;

  let rows = stmt
    .query_map([], |row| {
      Ok((
        row.get::<_, i64>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
      ))
    })
    .map_err(|e| format!("query reapply rules failed: {e}"))?;

  let mut pending = Vec::new();
  for row in rows {
    pending.push(row.map_err(|e| format!("decode reapply rules row failed: {e}"))?);
  }
  drop(stmt);

  for (id, app_name, window_title) in pending {
    let (project, tag, source) = classify_with_rules(&rules, &app_name, &window_title);
    conn
      .execute(
        "update activity_entries
         set project = ?1, tag = ?2, source = ?3
         where id = ?4",
        params![project, tag, source, id],
      )
      .map_err(|e| format!("update reapply rules row failed: {e}"))?;
  }

  Ok(())
}

fn capture_once(state: &SharedState) -> Result<CaptureResult, String> {
  init_db_internal()?;
  let conn = open_db()?;
  let now = Utc::now().to_rfc3339();
  let interval_ms = {
    let st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
    st.interval_ms
  };
  let max_gap_seconds = tracking_gap_seconds(interval_ms);
  close_stale_open_entry(&conn, &now, max_gap_seconds)?;

  if is_session_locked()? {
    close_last_open_entry(&conn, &now, max_gap_seconds)?;
    let mut st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
    st.last_active = None;
    st.last_warning = None;
    return Ok(CaptureResult {
      active: None,
      warning: None,
    });
  }

  let (app_name, window_title, bundle_id) = match read_frontmost_window() {
    Ok(data) => data,
    Err(e) => {
      let mut st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
      st.last_warning = Some(e.clone());
      return Ok(CaptureResult {
        active: None,
        warning: Some(e),
      });
    }
  };

  if should_ignore_app(&app_name, bundle_id.as_deref()) {
    close_last_open_entry(&conn, &now, max_gap_seconds)?;
    let mut st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
    st.last_active = None;
    st.last_warning = None;
    return Ok(CaptureResult {
      active: None,
      warning: None,
    });
  }

  let context = extract_structured_context(&app_name, bundle_id.as_deref(), &window_title);
  let (project, tag, source) = classify(&app_name, &window_title)?;

  let mut stmt = conn
    .prepare(
      "select id, app_name, window_title, bundle_id, activity_type, entity_name, detail, workspace, file_name, domain, project, tag, duration_seconds, coalesce(last_seen_at, started_at)
       from activity_entries
       where ended_at is null
       order by id desc limit 1",
    )
    .map_err(|e| format!("prepare query open entry failed: {e}"))?;

  let open_entry = stmt
    .query_row([], |row| {
      let id: i64 = row.get(0)?;
      let app: String = row.get(1)?;
      let title: String = row.get(2)?;
      let open_bundle_id: Option<String> = row.get(3)?;
      let open_activity_type: Option<String> = row.get(4)?;
      let open_entity_name: Option<String> = row.get(5)?;
      let open_detail: Option<String> = row.get(6)?;
      let open_workspace: Option<String> = row.get(7)?;
      let open_file_name: Option<String> = row.get(8)?;
      let open_domain: Option<String> = row.get(9)?;
      let p: Option<String> = row.get(10)?;
      let t: Option<String> = row.get(11)?;
      let duration_seconds: i64 = row.get(12)?;
      let last_seen_at: String = row.get(13)?;
      Ok((
        id,
        app,
        title,
        open_bundle_id,
        open_activity_type,
        open_entity_name,
        open_detail,
        open_workspace,
        open_file_name,
        open_domain,
        p,
        t,
        duration_seconds,
        last_seen_at,
      ))
    })
    .ok();

  match open_entry {
    Some((
      id,
      open_app,
      open_title,
      open_bundle_id,
      open_activity_type,
      open_entity_name,
      open_detail,
      open_workspace,
      open_file_name,
      open_domain,
      open_project,
      open_tag,
      open_duration,
      last_seen_at,
    )) => {
      if open_app != app_name
        || open_title != window_title
        || open_bundle_id != context.bundle_id.clone()
        || open_activity_type != context.activity_type.clone()
        || open_entity_name != context.entity_name.clone()
        || open_detail != context.detail.clone()
        || open_workspace != context.workspace.clone()
        || open_file_name != context.file_name.clone()
        || open_domain != context.domain.clone()
        || open_project != project
        || open_tag != tag
      {
        close_last_open_entry(&conn, &now, max_gap_seconds)?;
        conn
          .execute(
            "insert into activity_entries (app_name, window_title, bundle_id, activity_type, entity_name, detail, workspace, file_name, domain, project, tag, source, started_at, ended_at, duration_seconds, last_seen_at)
             values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, null, 0, ?13)",
            params![
              app_name.clone(),
              window_title.clone(),
              context.bundle_id.clone(),
              context.activity_type.clone(),
              context.entity_name.clone(),
              context.detail.clone(),
              context.workspace.clone(),
              context.file_name.clone(),
              context.domain.clone(),
              project.clone(),
              tag.clone(),
              source.clone(),
              now.clone()
            ],
          )
          .map_err(|e| format!("insert new entry failed: {e}"))?;
      } else {
        let tail = live_tail_seconds(&last_seen_at, &now, max_gap_seconds)?;
        conn
          .execute(
            "update activity_entries
             set last_seen_at = ?1, duration_seconds = ?2
             where id = ?3",
            params![now, open_duration + tail, id],
          )
          .map_err(|e| format!("update running entry failed: {e}"))?;
      }
    }
    None => {
      conn
        .execute(
          "insert into activity_entries (app_name, window_title, bundle_id, activity_type, entity_name, detail, workspace, file_name, domain, project, tag, source, started_at, ended_at, duration_seconds, last_seen_at)
           values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, null, 0, ?13)",
          params![
            app_name.clone(),
            window_title.clone(),
            context.bundle_id.clone(),
            context.activity_type.clone(),
            context.entity_name.clone(),
            context.detail.clone(),
            context.workspace.clone(),
            context.file_name.clone(),
            context.domain.clone(),
            project.clone(),
            tag.clone(),
            source.clone(),
            now.clone()
          ],
        )
        .map_err(|e| format!("insert first entry failed: {e}"))?;
    }
  }

  let active = ActiveWindow {
    app_name,
    window_title,
    bundle_id: context.bundle_id,
    activity_type: context.activity_type,
    entity_name: context.entity_name,
    detail: context.detail,
    workspace: context.workspace,
    file_name: context.file_name,
    domain: context.domain,
    captured_at: now,
  };

  let mut st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
  st.last_active = Some(active.clone());
  st.last_warning = None;

  Ok(CaptureResult {
    active: Some(active),
    warning: None,
  })
}

fn spawn_background_collector(state: SharedState) {
  thread::spawn(move || loop {
    let (enabled, interval_ms) = {
      let st = match state.lock() {
        Ok(s) => s,
        Err(_) => {
          thread::sleep(Duration::from_secs(1));
          continue;
        }
      };
      (st.tracking_enabled, st.interval_ms)
    };

    if enabled {
      let _ = capture_once(&state);
    }

    let sleep_ms = interval_ms.clamp(2000, 30000);
    thread::sleep(Duration::from_millis(sleep_ms));
  });
}

#[tauri::command]
fn capture_active_window(state: State<'_, SharedState>) -> Result<CaptureResult, String> {
  capture_once(&state)
}

#[tauri::command]
fn list_entries(limit: Option<i64>, state: State<'_, SharedState>) -> Result<Vec<ActivityEntry>, String> {
  init_db_internal()?;
  let conn = open_db()?;
  let max = limit.unwrap_or(120).clamp(1, 1000);
  let interval_ms = {
    let st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
    st.interval_ms
  };
  let max_gap_seconds = tracking_gap_seconds(interval_ms);
  let mut stmt = conn
    .prepare(
      "select
         id,
         app_name,
         window_title,
         bundle_id,
         activity_type,
         entity_name,
         detail,
         workspace,
         file_name,
         domain,
         project,
         tag,
         source,
         started_at,
         ended_at,
         duration_seconds +
         case
           when ended_at is null then min(?2, max(0, strftime('%s','now') - strftime('%s', coalesce(last_seen_at, started_at))))
           else 0
         end as effective_duration
       from activity_entries
       order by id desc
       limit ?1",
    )
    .map_err(|e| format!("prepare list failed: {e}"))?;

  let rows = stmt
    .query_map(params![max, max_gap_seconds], |row| {
      Ok(ActivityEntry {
        id: row.get(0)?,
        app_name: row.get(1)?,
        window_title: row.get(2)?,
        bundle_id: row.get(3)?,
        activity_type: row.get(4)?,
        entity_name: row.get(5)?,
        detail: row.get(6)?,
        workspace: row.get(7)?,
        file_name: row.get(8)?,
        domain: row.get(9)?,
        project: row.get(10)?,
        tag: row.get(11)?,
        source: row.get(12)?,
        started_at: row.get(13)?,
        ended_at: row.get(14)?,
        duration_seconds: row.get(15)?,
      })
    })
    .map_err(|e| format!("query list failed: {e}"))?;

  let mut out = Vec::new();
  for row in rows {
    out.push(row.map_err(|e| format!("decode row failed: {e}"))?);
  }
  Ok(out)
}

#[tauri::command]
fn list_entries_for_day(day_key: String, state: State<'_, SharedState>) -> Result<Vec<ActivityEntry>, String> {
  init_db_internal()?;
  let conn = open_db()?;
  let interval_ms = {
    let st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
    st.interval_ms
  };
  let max_gap_seconds = tracking_gap_seconds(interval_ms);
  let (range_start_sec, range_end_sec) = local_day_bounds_utc(&day_key)?;
  load_entries_overlapping_range(&conn, range_start_sec, range_end_sec, max_gap_seconds)
}

#[tauri::command]
fn list_daily_summaries(days: Option<i64>, state: State<'_, SharedState>) -> Result<Vec<DailySummary>, String> {
  init_db_internal()?;
  let conn = open_db()?;
  let interval_ms = {
    let st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
    st.interval_ms
  };
  let max_gap_seconds = tracking_gap_seconds(interval_ms);
  let day_count = days.unwrap_or(14).clamp(7, 30);
  let today_local = Local::now().date_naive();
  let start_day = today_local - chrono::Duration::days(day_count - 1);

  let start_local = resolve_local_midnight(start_day)?;
  let end_local = resolve_local_midnight(
    today_local
      .succ_opt()
      .ok_or_else(|| "next day overflow".to_string())?,
  )?;
  let range_start_sec = start_local.with_timezone(&Utc).timestamp();
  let range_end_sec = end_local.with_timezone(&Utc).timestamp();
  let rows = load_entries_overlapping_range(&conn, range_start_sec, range_end_sec, max_gap_seconds)?;

  struct DayAccumulator {
    day_key: String,
    start_sec: i64,
    end_sec: i64,
    total_seconds: i64,
    uncategorized_seconds: i64,
    running_seconds: i64,
    entry_count: i64,
    apps: HashMap<String, i64>,
    projects: HashMap<String, i64>,
    tags: HashMap<String, i64>,
  }

  let mut daily = Vec::new();
  for offset in 0..day_count {
    let day = start_day + chrono::Duration::days(offset);
    let next_day = day
      .succ_opt()
      .ok_or_else(|| "next day overflow".to_string())?;
    let local_start = resolve_local_midnight(day)?;
    let local_end = resolve_local_midnight(next_day)?;
    daily.push(DayAccumulator {
      day_key: day.format("%Y-%m-%d").to_string(),
      start_sec: local_start.with_timezone(&Utc).timestamp(),
      end_sec: local_end.with_timezone(&Utc).timestamp(),
      total_seconds: 0,
      uncategorized_seconds: 0,
      running_seconds: 0,
      entry_count: 0,
      apps: HashMap::new(),
      projects: HashMap::new(),
      tags: HashMap::new(),
    });
  }

  for row in &rows {
    let (window_start_sec, window_end_sec) = entry_window_seconds(row)?;
    for bucket in &mut daily {
      let sec = overlap_seconds(window_start_sec, window_end_sec, bucket.start_sec, bucket.end_sec);
      if sec <= 0 {
        continue;
      }

      bucket.total_seconds += sec;
      if row.ended_at.is_none() {
        bucket.running_seconds += sec;
      }
      if row.project.is_none() && row.tag.is_none() {
        bucket.uncategorized_seconds += sec;
      }
      bucket.entry_count += 1;

      let app_key = row.app_name.clone();
      *bucket.apps.entry(app_key).or_insert(0) += sec;

      let project_key = row
        .project
        .clone()
        .unwrap_or_else(|| row.app_name.clone());
      *bucket.projects.entry(project_key).or_insert(0) += sec;

      let tag_key = row.tag.clone().unwrap_or_default();
      *bucket.tags.entry(tag_key).or_insert(0) += sec;
    }
  }

  Ok(
    daily
      .into_iter()
      .map(|bucket| {
        let coverage = if bucket.total_seconds > 0 {
          (((bucket.total_seconds - bucket.uncategorized_seconds) * 100) / bucket.total_seconds)
            .clamp(0, 100)
        } else {
          0
        };
        let top_tag = top_map_name(&bucket.tags).and_then(|tag| if tag.is_empty() { None } else { Some(tag) });
        DailySummary {
          day_key: bucket.day_key,
          total_seconds: bucket.total_seconds,
          uncategorized_seconds: bucket.uncategorized_seconds,
          running_seconds: bucket.running_seconds,
          top_app: top_map_name(&bucket.apps),
          top_project: top_map_name(&bucket.projects),
          top_tag,
          entry_count: bucket.entry_count,
          coverage,
          focus_minutes: bucket.total_seconds / 60,
        }
      })
      .collect(),
  )
}

#[tauri::command]
fn get_runtime_status(state: State<'_, SharedState>) -> Result<RuntimeStatus, String> {
  let st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
  Ok(RuntimeStatus {
    tracking_enabled: st.tracking_enabled,
    interval_ms: st.interval_ms,
    last_active: st.last_active.clone(),
    last_warning: st.last_warning.clone(),
  })
}

#[tauri::command]
fn set_tracking_enabled(enabled: bool, state: State<'_, SharedState>) -> Result<RuntimeStatus, String> {
  let mut st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
  st.tracking_enabled = enabled;
  Ok(RuntimeStatus {
    tracking_enabled: st.tracking_enabled,
    interval_ms: st.interval_ms,
    last_active: st.last_active.clone(),
    last_warning: st.last_warning.clone(),
  })
}

#[tauri::command]
fn set_capture_interval(interval_ms: u64, state: State<'_, SharedState>) -> Result<RuntimeStatus, String> {
  let mut st = state.lock().map_err(|_| "runtime state poisoned".to_string())?;
  st.interval_ms = interval_ms.clamp(2000, 30000);
  Ok(RuntimeStatus {
    tracking_enabled: st.tracking_enabled,
    interval_ms: st.interval_ms,
    last_active: st.last_active.clone(),
    last_warning: st.last_warning.clone(),
  })
}

#[tauri::command]
fn list_rules() -> Result<Vec<RuleRow>, String> {
  init_db_internal()?;
  list_rules_internal()
}

#[tauri::command]
fn list_rule_suggestions(limit: Option<i64>) -> Result<RuleSuggestions, String> {
  init_db_internal()?;
  let conn = open_db()?;
  let max = limit.unwrap_or(40).clamp(1, 200);
  let mut stmt = conn
    .prepare(
      "select app_name
       from activity_entries
       where trim(app_name) <> ''
       group by app_name
       order by count(*) desc, app_name asc
       limit ?1",
    )
    .map_err(|e| format!("prepare list rule suggestions failed: {e}"))?;

  let rows = stmt
    .query_map(params![max], |row| row.get::<_, String>(0))
    .map_err(|e| format!("query list rule suggestions failed: {e}"))?;

  let mut app_names = Vec::new();
  for row in rows {
    app_names.push(row.map_err(|e| format!("decode rule suggestion row failed: {e}"))?);
  }

  Ok(RuleSuggestions { app_names })
}

#[tauri::command]
fn add_rule(input: NewRuleInput) -> Result<Vec<RuleRow>, String> {
  init_db_internal()?;
  let conn = open_db()?;

  let name = input.name.trim();
  if name.is_empty() {
    return Err("rule name cannot be empty".to_string());
  }
  if input.app_pattern.trim().is_empty() && input.title_pattern.trim().is_empty() {
    return Err("app pattern or title pattern is required".to_string());
  }

  conn
    .execute(
      "insert into rules (name, app_pattern, title_pattern, project, tag, enabled, priority, created_at)
       values (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7)",
      params![
        name,
        input.app_pattern.trim(),
        input.title_pattern.trim(),
        input.project.and_then(|v| {
          let t = v.trim().to_string();
          if t.is_empty() { None } else { Some(t) }
        }),
        input.tag.and_then(|v| {
          let t = v.trim().to_string();
          if t.is_empty() { None } else { Some(t) }
        }),
        input.priority.unwrap_or(100),
        Utc::now().to_rfc3339()
      ],
    )
    .map_err(|e| format!("insert rule failed: {e}"))?;

  reapply_rules_internal(&conn)?;
  list_rules_internal()
}

#[tauri::command]
fn set_rule_enabled(rule_id: i64, enabled: bool) -> Result<Vec<RuleRow>, String> {
  init_db_internal()?;
  let conn = open_db()?;
  conn
    .execute(
      "update rules set enabled = ?1 where id = ?2",
      params![if enabled { 1 } else { 0 }, rule_id],
    )
    .map_err(|e| format!("update rule enabled failed: {e}"))?;
  reapply_rules_internal(&conn)?;
  list_rules_internal()
}

#[tauri::command]
fn delete_rule(rule_id: i64) -> Result<Vec<RuleRow>, String> {
  init_db_internal()?;
  let conn = open_db()?;
  conn
    .execute("delete from rules where id = ?1", params![rule_id])
    .map_err(|e| format!("delete rule failed: {e}"))?;
  reapply_rules_internal(&conn)?;
  list_rules_internal()
}

fn main() {
  let single_instance_listener = match TcpListener::bind(SINGLE_INSTANCE_ADDR) {
    Ok(listener) => listener,
    Err(_) => {
      notify_existing_instance();
      return;
    }
  };

  let shared: SharedState = Arc::new(Mutex::new(RuntimeState {
    tracking_enabled: true,
    interval_ms: 5000,
    last_active: None,
    last_warning: None,
    allow_window_close: false,
  }));
  let shared_for_setup = shared.clone();
  let shared_for_events = shared.clone();

  let app = tauri::Builder::default()
    .setup(move |app| {
      let _ = init_db_internal();
      #[cfg(target_os = "macos")]
      {
        app.set_activation_policy(tauri::ActivationPolicy::Accessory);
        let _ = app.set_dock_visibility(false);
      }
      let _ = build_tray(&app.handle(), shared_for_setup.clone());
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_skip_taskbar(true);
        let _ = window.show();
      }
      Ok(())
    })
    .on_window_event({
      let shared = shared.clone();
      move |window, event| {
        if window.label() != "main" {
          return;
        }
        if let WindowEvent::CloseRequested { api, .. } = event {
          let allow_close = shared.lock().map(|st| st.allow_window_close).unwrap_or(true);
          if !allow_close {
            api.prevent_close();
            let _ = window.hide();
            #[cfg(target_os = "macos")]
            {
              let _ = window.app_handle().set_dock_visibility(false);
            }
          }
        }
      }
    })
    .manage(shared.clone())
    .invoke_handler(tauri::generate_handler![
      init_db,
      capture_active_window,
      list_entries,
      list_entries_for_day,
      list_daily_summaries,
      get_runtime_status,
      set_tracking_enabled,
      set_capture_interval,
      list_rules,
      list_rule_suggestions,
      add_rule,
      set_rule_enabled,
      delete_rule
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  spawn_single_instance_server(app.handle().clone(), single_instance_listener);
  spawn_background_collector(shared.clone());

  app.run(move |app_handle, event| match event {
    RunEvent::Reopen { .. } => {
      if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
    }
    RunEvent::ExitRequested { .. } | RunEvent::Exit => {
      if let Ok(mut st) = shared_for_events.lock() {
        st.allow_window_close = true;
        let _ = finalize_open_entry(st.interval_ms);
      }
    }
    _ => {}
  });
}
