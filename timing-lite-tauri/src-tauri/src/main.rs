#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{Manager, State};

#[derive(Clone, Serialize)]
struct ActivityEntry {
  id: i64,
  app_name: String,
  window_title: String,
  project: Option<String>,
  tag: Option<String>,
  source: String,
  started_at: String,
  ended_at: Option<String>,
  duration_seconds: i64,
}

#[derive(Clone, Serialize)]
struct ActiveWindow {
  app_name: String,
  window_title: String,
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
}

type SharedState = Arc<Mutex<RuntimeState>>;

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
  let conn = open_db()?;
  conn
    .execute_batch(
      r#"
      create table if not exists activity_entries (
        id integer primary key autoincrement,
        app_name text not null,
        window_title text not null default '',
        started_at text not null,
        ended_at text null,
        duration_seconds integer not null default 0
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

  Ok(())
}

#[tauri::command]
fn init_db() -> Result<(), String> {
  init_db_internal()
}

fn read_frontmost_window() -> Result<(String, String), String> {
  #[cfg(target_os = "macos")]
  {
    let script = r#"
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
      end tell
      tell application "System Events"
        tell process frontApp
          try
            set winName to name of front window
          on error
            set winName to ""
          end try
        end tell
      end tell
      return frontApp & "||" & winName
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
    let mut parts = value.splitn(2, "||");
    let app = parts.next().unwrap_or("").trim().to_string();
    let title = parts.next().unwrap_or("").trim().to_string();
    if app.is_empty() {
      return Err("front app is empty".to_string());
    }
    Ok((app, title))
  }
  #[cfg(not(target_os = "macos"))]
  {
    Err("front-window capture is implemented for macOS only in this MVP".to_string())
  }
}

fn close_last_open_entry(conn: &Connection, ended_at: &str) -> Result<(), String> {
  let mut stmt = conn
    .prepare(
      "select id, started_at from activity_entries
       where ended_at is null
       order by id desc limit 1",
    )
    .map_err(|e| format!("prepare select last failed: {e}"))?;

  let row = stmt
    .query_row([], |row| {
      let id: i64 = row.get(0)?;
      let started_at: String = row.get(1)?;
      Ok((id, started_at))
    })
    .ok();

  if let Some((id, started_at)) = row {
    let started_ts = chrono::DateTime::parse_from_rfc3339(&started_at)
      .map_err(|e| format!("parse started_at failed: {e}"))?;
    let ended_ts = chrono::DateTime::parse_from_rfc3339(ended_at)
      .map_err(|e| format!("parse ended_at failed: {e}"))?;
    let duration = (ended_ts.timestamp() - started_ts.timestamp()).max(0);
    conn
      .execute(
        "update activity_entries
         set ended_at = ?1, duration_seconds = ?2
         where id = ?3",
        params![ended_at, duration, id],
      )
      .map_err(|e| format!("update last entry failed: {e}"))?;
  }
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
  for rule in rules.into_iter().filter(|r| r.enabled) {
    if rule_matches(&rule, app_name, window_title) {
      return Ok((rule.project, rule.tag, format!("rule:{}", rule.name)));
    }
  }
  Ok((None, None, "default".to_string()))
}

fn capture_once(state: &SharedState) -> Result<CaptureResult, String> {
  init_db_internal()?;
  let conn = open_db()?;
  let now = Utc::now().to_rfc3339();

  let (app_name, window_title) = match read_frontmost_window() {
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

  let (project, tag, source) = classify(&app_name, &window_title)?;

  let mut stmt = conn
    .prepare(
      "select id, app_name, window_title, project, tag
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
      let p: Option<String> = row.get(3)?;
      let t: Option<String> = row.get(4)?;
      Ok((id, app, title, p, t))
    })
    .ok();

  match open_entry {
    Some((_id, open_app, open_title, open_project, open_tag)) => {
      if open_app != app_name || open_title != window_title || open_project != project || open_tag != tag {
        close_last_open_entry(&conn, &now)?;
        conn
          .execute(
            "insert into activity_entries (app_name, window_title, project, tag, source, started_at, ended_at, duration_seconds)
             values (?1, ?2, ?3, ?4, ?5, ?6, null, 0)",
            params![app_name, window_title, project, tag, source, now],
          )
          .map_err(|e| format!("insert new entry failed: {e}"))?;
      }
    }
    None => {
      conn
        .execute(
          "insert into activity_entries (app_name, window_title, project, tag, source, started_at, ended_at, duration_seconds)
           values (?1, ?2, ?3, ?4, ?5, ?6, null, 0)",
          params![app_name, window_title, project, tag, source, now],
        )
        .map_err(|e| format!("insert first entry failed: {e}"))?;
    }
  }

  let active = ActiveWindow {
    app_name,
    window_title,
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
fn list_entries(limit: Option<i64>) -> Result<Vec<ActivityEntry>, String> {
  init_db_internal()?;
  let conn = open_db()?;
  let max = limit.unwrap_or(120).clamp(1, 1000);
  let mut stmt = conn
    .prepare(
      "select
         id,
         app_name,
         window_title,
         project,
         tag,
         source,
         started_at,
         ended_at,
         duration_seconds +
         case
           when ended_at is null then max(0, strftime('%s','now') - strftime('%s', started_at))
           else 0
         end as effective_duration
       from activity_entries
       order by id desc
       limit ?1",
    )
    .map_err(|e| format!("prepare list failed: {e}"))?;

  let rows = stmt
    .query_map([max], |row| {
      Ok(ActivityEntry {
        id: row.get(0)?,
        app_name: row.get(1)?,
        window_title: row.get(2)?,
        project: row.get(3)?,
        tag: row.get(4)?,
        source: row.get(5)?,
        started_at: row.get(6)?,
        ended_at: row.get(7)?,
        duration_seconds: row.get(8)?,
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
fn add_rule(input: NewRuleInput) -> Result<Vec<RuleRow>, String> {
  init_db_internal()?;
  let conn = open_db()?;

  let name = input.name.trim();
  if name.is_empty() {
    return Err("rule name cannot be empty".to_string());
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
  list_rules_internal()
}

#[tauri::command]
fn delete_rule(rule_id: i64) -> Result<Vec<RuleRow>, String> {
  init_db_internal()?;
  let conn = open_db()?;
  conn
    .execute("delete from rules where id = ?1", params![rule_id])
    .map_err(|e| format!("delete rule failed: {e}"))?;
  list_rules_internal()
}

fn main() {
  let shared: SharedState = Arc::new(Mutex::new(RuntimeState {
    tracking_enabled: true,
    interval_ms: 5000,
    last_active: None,
    last_warning: None,
  }));

  spawn_background_collector(shared.clone());

  tauri::Builder::default()
    .setup(|app| {
      let _ = init_db_internal();
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
      }
      Ok(())
    })
    .manage(shared)
    .invoke_handler(tauri::generate_handler![
      init_db,
      capture_active_window,
      list_entries,
      get_runtime_status,
      set_tracking_enabled,
      set_capture_interval,
      list_rules,
      add_rule,
      set_rule_enabled,
      delete_rule
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
