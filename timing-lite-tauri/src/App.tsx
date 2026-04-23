import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Locale = "zh" | "en";

type ActivityEntry = {
  id: number;
  app_name: string;
  window_title: string;
  project: string | null;
  tag: string | null;
  source: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
};

type ActiveWindow = {
  app_name: string;
  window_title: string;
  captured_at: string;
};

type RuntimeStatus = {
  tracking_enabled: boolean;
  interval_ms: number;
  last_active: ActiveWindow | null;
  last_warning: string | null;
};

type RuleRow = {
  id: number;
  name: string;
  app_pattern: string;
  title_pattern: string;
  project: string | null;
  tag: string | null;
  enabled: boolean;
  priority: number;
  created_at: string;
};

type RuleForm = {
  name: string;
  app_pattern: string;
  title_pattern: string;
  project: string;
  tag: string;
  priority: number;
};

type DashboardBucket = {
  label: string;
  sec: number;
};

type Dict = Record<string, string>;

const LOCALE_KEY = "timing-lite-locale";

const I18N: Record<Locale, Dict> = {
  zh: {
    title: "Timing Lite",
    subtitle: "后台记录 + 自动分类规则",
    language: "语言",
    tracking: "采集开关",
    interval: "采集间隔",
    captureNow: "立即采集",
    current: "当前活动",
    noActive: "暂无活动窗口",
    statsDashboard: "统计看板",
    todayTotal: "今日总时长",
    runningSegments: "运行中时长",
    uncategorized: "未分类时长",
    ruleCoverage: "规则覆盖率",
    range: "看板范围",
    recent6h: "最近 6 小时",
    recent24h: "最近 1 天",
    recent7d: "最近 1 周",
    trend: "趋势",
    topProjects: "项目排行",
    topTags: "标签排行",
    noProjectData: "暂无项目数据",
    noTagData: "暂无标签数据",
    topProjectApp: "项目 / 应用排行（全量）",
    rules: "规则管理",
    refreshRules: "刷新规则",
    ruleName: "规则名",
    appContains: "应用名包含（可选）",
    titleContains: "窗口标题包含（可选）",
    project: "项目",
    tag: "标签",
    priority: "优先级",
    addRule: "新增规则",
    pattern: "匹配",
    projectTag: "项目 / 标签",
    status: "状态",
    action: "操作",
    enabled: "启用",
    disabled: "禁用",
    disable: "停用",
    enable: "启用",
    delete: "删除",
    noRules: "还没有规则",
    timeline: "活动列表",
    listSearch: "列表搜索（应用/窗口/项目/标签）",
    app: "应用",
    window: "窗口",
    source: "来源",
    start: "开始",
    end: "结束",
    duration: "时长",
    running: "进行中",
    noData: "暂无记录",
    pageSize: "每页",
    page: "页",
    prev: "上一页",
    next: "下一页",
    total: "总计",
    records: "条",
    unknown: "未知",
    uncategorizedTag: "未分类",
    defaultSource: "默认"
  },
  en: {
    title: "Timing Lite",
    subtitle: "Background tracking + auto classify rules",
    language: "Language",
    tracking: "Tracking",
    interval: "Interval",
    captureNow: "Capture now",
    current: "Current",
    noActive: "No active window",
    statsDashboard: "Stats Dashboard",
    todayTotal: "Today Total",
    runningSegments: "Running Segments",
    uncategorized: "Uncategorized",
    ruleCoverage: "Rule Coverage",
    range: "Range",
    recent6h: "Last 6 Hours",
    recent24h: "Last 1 Day",
    recent7d: "Last 1 Week",
    trend: "Trend",
    topProjects: "Top Projects",
    topTags: "Top Tags",
    noProjectData: "No project data yet",
    noTagData: "No tag data yet",
    topProjectApp: "Top Project / App (All Data)",
    rules: "Rules",
    refreshRules: "Refresh Rules",
    ruleName: "Rule name",
    appContains: "App contains (optional)",
    titleContains: "Window contains (optional)",
    project: "Project",
    tag: "Tag",
    priority: "Priority",
    addRule: "Add Rule",
    pattern: "Pattern",
    projectTag: "Project / Tag",
    status: "Status",
    action: "Action",
    enabled: "Enabled",
    disabled: "Disabled",
    disable: "Disable",
    enable: "Enable",
    delete: "Delete",
    noRules: "No rules yet",
    timeline: "Timeline",
    listSearch: "Search (app/window/project/tag)",
    app: "App",
    window: "Window",
    source: "Source",
    start: "Start",
    end: "End",
    duration: "Duration",
    running: "Running",
    noData: "No activity captured yet",
    pageSize: "Per page",
    page: "Page",
    prev: "Prev",
    next: "Next",
    total: "Total",
    records: "records",
    unknown: "Unknown",
    uncategorizedTag: "Uncategorized",
    defaultSource: "default"
  }
};

const DEFAULT_RULE_FORM: RuleForm = {
  name: "",
  app_pattern: "",
  title_pattern: "",
  project: "",
  tag: "",
  priority: 100
};

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function asDateText(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localHourKey(d: Date): string {
  return `${localDayKey(d)} ${String(d.getHours()).padStart(2, "0")}`;
}

function parseDate(v: string): Date | null {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleForm>(DEFAULT_RULE_FORM);
  const [rangeHours, setRangeHours] = useState<number>(24);
  const [timelineQuery, setTimelineQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);

  const t = (key: string): string => I18N[locale][key] ?? key;

  async function refreshEntries() {
    const rows = await invoke<ActivityEntry[]>("list_entries", { limit: 2000 });
    setEntries(rows);
  }

  async function refreshRules() {
    const rows = await invoke<RuleRow[]>("list_rules");
    setRules(rows);
  }

  async function refreshStatus() {
    const s = await invoke<RuntimeStatus>("get_runtime_status");
    setStatus(s);
    setWarning(s.last_warning);
  }

  async function refreshAll() {
    await Promise.all([refreshStatus(), refreshEntries(), refreshRules()]);
  }

  useEffect(() => {
    const cached = localStorage.getItem(LOCALE_KEY);
    if (cached === "zh" || cached === "en") {
      setLocale(cached);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      await invoke("init_db");
      if (canceled) return;
      await refreshAll();
      if (canceled) return;
      setLoading(false);
    })().catch((err) => {
      setWarning(String(err));
      setLoading(false);
    });

    const poll = window.setInterval(() => {
      refreshStatus().catch((err) => setWarning(String(err)));
      refreshEntries().catch((err) => setWarning(String(err)));
    }, 3000);

    return () => {
      canceled = true;
      window.clearInterval(poll);
    };
  }, []);

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of entries) {
      const key = row.project || row.app_name || t("unknown");
      const prev = map.get(key) ?? 0;
      map.set(key, prev + row.duration_seconds);
    }
    return Array.from(map.entries())
      .map(([key, sec]) => ({ key, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 10);
  }, [entries, locale]);

  const dashboard = useMemo(() => {
    const now = new Date();
    const rangeStartMs = now.getTime() - rangeHours * 3600 * 1000;
    const scoped = entries.filter((row) => {
      const d = parseDate(row.started_at);
      return d ? d.getTime() >= rangeStartMs : false;
    });

    let totalSeconds = 0;
    let runningSeconds = 0;
    let uncategorizedSeconds = 0;

    const byTag = new Map<string, number>();
    const byProject = new Map<string, number>();

    for (const row of scoped) {
      const sec = Math.max(0, row.duration_seconds);
      totalSeconds += sec;
      if (!row.ended_at) runningSeconds += sec;
      if (!row.project && !row.tag) uncategorizedSeconds += sec;

      const projectKey = row.project || row.app_name || t("unknown");
      byProject.set(projectKey, (byProject.get(projectKey) ?? 0) + sec);

      const tagKey = row.tag || t("uncategorizedTag");
      byTag.set(tagKey, (byTag.get(tagKey) ?? 0) + sec);
    }

    const topProjects = Array.from(byProject.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5);

    const topTags = Array.from(byTag.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5);

    const bucketMap = new Map<string, number>();
    const buckets: DashboardBucket[] = [];

    if (rangeHours <= 24) {
      for (let i = rangeHours - 1; i >= 0; i -= 1) {
        const d = new Date(now.getTime() - i * 3600 * 1000);
        const key = localHourKey(d);
        buckets.push({ label: `${String(d.getHours()).padStart(2, "0")}:00`, sec: 0 });
        bucketMap.set(key, 0);
      }

      for (const row of scoped) {
        const d = parseDate(row.started_at);
        if (!d) continue;
        const key = localHourKey(d);
        if (bucketMap.has(key)) {
          bucketMap.set(key, (bucketMap.get(key) ?? 0) + Math.max(0, row.duration_seconds));
        }
      }

      for (let i = 0; i < buckets.length; i += 1) {
        const d = new Date(now.getTime() - (buckets.length - 1 - i) * 3600 * 1000);
        const key = localHourKey(d);
        buckets[i].sec = bucketMap.get(key) ?? 0;
      }
    } else {
      const days = Math.ceil(rangeHours / 24);
      for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = localDayKey(d);
        buckets.push({ label: key.slice(5), sec: 0 });
        bucketMap.set(key, 0);
      }

      for (const row of scoped) {
        const d = parseDate(row.started_at);
        if (!d) continue;
        const key = localDayKey(d);
        if (bucketMap.has(key)) {
          bucketMap.set(key, (bucketMap.get(key) ?? 0) + Math.max(0, row.duration_seconds));
        }
      }

      for (let i = 0; i < buckets.length; i += 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - (buckets.length - 1 - i));
        const key = localDayKey(d);
        buckets[i].sec = bucketMap.get(key) ?? 0;
      }
    }

    const maxBucketSec = Math.max(1, ...buckets.map((x) => x.sec));

    return {
      totalSeconds,
      runningSeconds,
      uncategorizedSeconds,
      topProjects,
      topTags,
      buckets,
      maxBucketSec
    };
  }, [entries, rangeHours, locale]);

  const timelineRows = useMemo(() => {
    const q = timelineQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((row) => {
      const hay = [
        row.app_name,
        row.window_title,
        row.project || "",
        row.tag || "",
        row.source || ""
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, timelineQuery]);

  const totalPages = Math.max(1, Math.ceil(timelineRows.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return timelineRows.slice(start, start + pageSize);
  }, [timelineRows, page, pageSize]);

  const active = status?.last_active ?? null;

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <div className="controls">
          <label>
            <span>{t("language")}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            <span>{t("tracking")}</span>
            <input
              type="checkbox"
              checked={status?.tracking_enabled ?? true}
              onChange={async (e) => {
                const next = await invoke<RuntimeStatus>("set_tracking_enabled", {
                  enabled: e.target.checked
                });
                setStatus(next);
              }}
            />
          </label>
          <label>
            <span>{t("interval")}</span>
            <select
              value={status?.interval_ms ?? 5000}
              onChange={async (e) => {
                const next = await invoke<RuntimeStatus>("set_capture_interval", {
                  intervalMs: Number(e.target.value)
                });
                setStatus(next);
              }}
            >
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={15000}>15s</option>
            </select>
          </label>
          <button
            className="btn"
            onClick={async () => {
              await invoke("capture_active_window");
              await Promise.all([refreshStatus(), refreshEntries()]);
            }}
          >
            {t("captureNow")}
          </button>
        </div>
      </header>

      {warning ? <p className="warn">{warning}</p> : null}

      <section className="panel">
        <h2>{t("current")}</h2>
        {active ? (
          <div className="current">
            <strong>{active.app_name}</strong>
            <span>{active.window_title || "(No title)"}</span>
            <small>{asDateText(active.captured_at)}</small>
          </div>
        ) : (
          <p className="muted">{t("noActive")}</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("statsDashboard")}</h2>
          <label>
            <span>{t("range")}</span>
            <select
              value={rangeHours}
              onChange={(e) => setRangeHours(Number(e.target.value))}
            >
              <option value={6}>{t("recent6h")}</option>
              <option value={24}>{t("recent24h")}</option>
              <option value={168}>{t("recent7d")}</option>
            </select>
          </label>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <span>{t("todayTotal")}</span>
            <strong>{formatDuration(dashboard.totalSeconds)}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("runningSegments")}</span>
            <strong>{formatDuration(dashboard.runningSeconds)}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("uncategorized")}</span>
            <strong>{formatDuration(dashboard.uncategorizedSeconds)}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("ruleCoverage")}</span>
            <strong>
              {dashboard.totalSeconds
                ? `${Math.max(
                    0,
                    Math.round(
                      ((dashboard.totalSeconds - dashboard.uncategorizedSeconds) /
                        Math.max(1, dashboard.totalSeconds)) *
                        100
                    )
                  )}%`
                : "0%"}
            </strong>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="mini-panel">
            <h3>{t("trend")}</h3>
            <div className="bars">
              {dashboard.buckets.map((d) => (
                <div className="bar-row" key={d.label}>
                  <span>{d.label}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.round((d.sec / dashboard.maxBucketSec) * 100)}%`
                      }}
                    />
                  </div>
                  <b>{formatDuration(d.sec)}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="mini-panel">
            <h3>{t("topProjects")}</h3>
            {dashboard.topProjects.map((item) => (
              <div className="mini-row" key={item.name}>
                <span>{item.name}</span>
                <b>{formatDuration(item.sec)}</b>
              </div>
            ))}
            {!dashboard.topProjects.length ? (
              <p className="muted">{t("noProjectData")}</p>
            ) : null}
          </div>

          <div className="mini-panel">
            <h3>{t("topTags")}</h3>
            {dashboard.topTags.map((item) => (
              <div className="mini-row" key={item.name}>
                <span>{item.name}</span>
                <b>{formatDuration(item.sec)}</b>
              </div>
            ))}
            {!dashboard.topTags.length ? <p className="muted">{t("noTagData")}</p> : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>{t("topProjectApp")}</h2>
        <div className="top-grid">
          {totals.map((item) => (
            <div className="stat" key={item.key}>
              <span>{item.key}</span>
              <strong>{formatDuration(item.sec)}</strong>
            </div>
          ))}
          {!totals.length ? <p className="muted">No stats yet.</p> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("rules")}</h2>
          <button
            className="btn"
            onClick={() => {
              refreshRules().catch((err) => setWarning(String(err)));
            }}
          >
            {t("refreshRules")}
          </button>
        </div>

        <div className="rule-form-grid">
          <input
            placeholder={t("ruleName")}
            value={ruleForm.name}
            onChange={(e) => setRuleForm((s) => ({ ...s, name: e.target.value }))}
          />
          <input
            placeholder={t("appContains")}
            value={ruleForm.app_pattern}
            onChange={(e) => setRuleForm((s) => ({ ...s, app_pattern: e.target.value }))}
          />
          <input
            placeholder={t("titleContains")}
            value={ruleForm.title_pattern}
            onChange={(e) => setRuleForm((s) => ({ ...s, title_pattern: e.target.value }))}
          />
          <input
            placeholder={t("project")}
            value={ruleForm.project}
            onChange={(e) => setRuleForm((s) => ({ ...s, project: e.target.value }))}
          />
          <input
            placeholder={t("tag")}
            value={ruleForm.tag}
            onChange={(e) => setRuleForm((s) => ({ ...s, tag: e.target.value }))}
          />
          <input
            type="number"
            placeholder={t("priority")}
            value={ruleForm.priority}
            onChange={(e) =>
              setRuleForm((s) => ({ ...s, priority: Number(e.target.value) || 100 }))
            }
          />
        </div>

        <div className="rule-actions">
          <button
            className="btn"
            onClick={async () => {
              const next = await invoke<RuleRow[]>("add_rule", {
                input: {
                  name: ruleForm.name,
                  app_pattern: ruleForm.app_pattern,
                  title_pattern: ruleForm.title_pattern,
                  project: ruleForm.project || null,
                  tag: ruleForm.tag || null,
                  priority: ruleForm.priority
                }
              });
              setRules(next);
              setRuleForm(DEFAULT_RULE_FORM);
            }}
          >
            {t("addRule")}
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>{t("ruleName")}</th>
              <th>{t("pattern")}</th>
              <th>{t("projectTag")}</th>
              <th>{t("priority")}</th>
              <th>{t("status")}</th>
              <th>{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>
                  app: {rule.app_pattern || "*"}
                  <br />
                  title: {rule.title_pattern || "*"}
                </td>
                <td>
                  {(rule.project || "-") + " / " + (rule.tag || "-")}
                </td>
                <td>{rule.priority}</td>
                <td>{rule.enabled ? t("enabled") : t("disabled")}</td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn"
                      onClick={async () => {
                        const next = await invoke<RuleRow[]>("set_rule_enabled", {
                          ruleId: rule.id,
                          enabled: !rule.enabled
                        });
                        setRules(next);
                      }}
                    >
                      {rule.enabled ? t("disable") : t("enable")}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={async () => {
                        const next = await invoke<RuleRow[]>("delete_rule", {
                          ruleId: rule.id
                        });
                        setRules(next);
                      }}
                    >
                      {t("delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rules.length ? (
              <tr>
                <td colSpan={6} className="muted">
                  {t("noRules")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("timeline")}</h2>
          <input
            className="search-input"
            value={timelineQuery}
            onChange={(e) => {
              setTimelineQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t("listSearch")}
          />
        </div>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>{t("app")}</th>
                  <th>{t("window")}</th>
                  <th>{t("project")}</th>
                  <th>{t("tag")}</th>
                  <th>{t("source")}</th>
                  <th>{t("start")}</th>
                  <th>{t("end")}</th>
                  <th>{t("duration")}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.app_name}</td>
                    <td title={row.window_title}>{row.window_title || "-"}</td>
                    <td>{row.project || "-"}</td>
                    <td>{row.tag || "-"}</td>
                    <td>{row.source || t("defaultSource")}</td>
                    <td>{asDateText(row.started_at)}</td>
                    <td>{row.ended_at ? asDateText(row.ended_at) : t("running")}</td>
                    <td>{formatDuration(row.duration_seconds)}</td>
                  </tr>
                ))}
                {!pageRows.length ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      {t("noData")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <div className="pagination">
              <div className="page-meta">
                <span>{t("total")} {timelineRows.length} {t("records")}</span>
              </div>
              <div className="page-controls">
                <label>
                  <span>{t("pageSize")}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
                <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  {t("prev")}
                </button>
                <span>{t("page")} {page} / {totalPages}</span>
                <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  {t("next")}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
