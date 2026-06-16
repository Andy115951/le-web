import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

type Locale = "zh" | "en";

type ActivityEntry = {
  id: number;
  app_name: string;
  window_title: string;
  bundle_id: string | null;
  activity_type: string | null;
  entity_name: string | null;
  detail: string | null;
  workspace: string | null;
  file_name: string | null;
  domain: string | null;
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
  bundle_id: string | null;
  activity_type: string | null;
  entity_name: string | null;
  detail: string | null;
  workspace: string | null;
  file_name: string | null;
  domain: string | null;
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

type ViewMode = "overview" | "dashboard" | "charts" | "rules" | "timeline";
type ChartGroup = "project" | "app";

type ChartSlice = {
  name: string;
  sec: number;
  ratio: number;
  color: string;
};

type TrendDay = {
  key: string;
  label: string;
  totalSec: number;
  segments: Array<{
    name: string;
    sec: number;
    ratio: number;
    color: string;
  }>;
};

type HoverTip = {
  text: string;
  x: number;
  y: number;
};

type EntryWindow = {
  startSec: number;
  endSec: number;
};

type Dict = Record<string, string>;

const LOCALE_KEY = "timing-lite-locale";
const DETAIL_MODE_KEY = "timing-lite-detail-mode";

const I18N: Record<Locale, Dict> = {
  zh: {
    title: "Timing Lite",
    subtitle: "后台记录 + 自动分类规则",
    backgroundHint: "关闭窗口会隐藏到后台继续记录；休眠和关机时段不会再被误计入。",
    view: "视图",
    viewOverview: "概览",
    viewDashboard: "统计看板",
    viewCharts: "图表分析",
    viewRules: "规则管理",
    viewTimeline: "活动列表",
    language: "语言",
    detailMode: "详细显示",
    tracking: "采集开关",
    interval: "采集间隔",
    captureNow: "立即采集",
    dayOverview: "今日总览",
    allInOneScreen: "一屏概览",
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
    charts: "图表分析",
    chartsRangeHint: "用饼图快速看时间分布",
    dailyTrend: "最近 7 天趋势",
    trendHint: "按天看时间投入，并支持按项目或应用进程分类",
    groupBy: "分类方式",
    groupByProject: "按项目",
    groupByApp: "按应用进程",
    otherGroup: "其他",
    topProjects: "项目排行",
    topTags: "标签排行",
    noProjectData: "暂无项目数据",
    noTagData: "暂无标签数据",
    topApps: "应用排行",
    noAppData: "暂无应用数据",
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
    listSearch: "列表搜索（应用/上下文/窗口/项目/标签）",
    app: "应用",
    activityType: "类型",
    context: "上下文",
    window: "窗口",
    originalWindow: "原始窗口标题",
    detailLabel: "细节",
    workspaceLabel: "工作区",
    fileLabel: "文件",
    domainLabel: "站点",
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
    focusMinutes: "专注分钟",
    unknown: "未知",
    uncategorizedTag: "未分类",
    defaultSource: "默认",
    typeCoding: "编码",
    typeBrowser: "浏览",
    typeDocs: "文档",
    typeTerminal: "终端",
    typeChat: "沟通",
    typeMeeting: "会议",
    typeDesign: "设计",
    typeFiles: "文件",
    noContext: "暂无结构化上下文"
  },
  en: {
    title: "Timing Lite",
    subtitle: "Background tracking + auto classify rules",
    backgroundHint: "Closing the window now keeps tracking in the background, and sleep/shutdown gaps are ignored.",
    view: "View",
    viewOverview: "Overview",
    viewDashboard: "Dashboard",
    viewCharts: "Charts",
    viewRules: "Rules",
    viewTimeline: "Timeline",
    language: "Language",
    detailMode: "Detailed View",
    tracking: "Tracking",
    interval: "Interval",
    captureNow: "Capture now",
    dayOverview: "Today Overview",
    allInOneScreen: "One-screen summary",
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
    charts: "Charts",
    chartsRangeHint: "Use pie charts to see where time goes",
    dailyTrend: "Last 7 Days Trend",
    trendHint: "See daily time split by project or app process",
    groupBy: "Group By",
    groupByProject: "Project",
    groupByApp: "App Process",
    otherGroup: "Other",
    topProjects: "Top Projects",
    topTags: "Top Tags",
    noProjectData: "No project data yet",
    noTagData: "No tag data yet",
    topApps: "Top Apps",
    noAppData: "No app data yet",
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
    listSearch: "Search (app/context/window/project/tag)",
    app: "App",
    activityType: "Type",
    context: "Context",
    window: "Window",
    originalWindow: "Original Window Title",
    detailLabel: "Detail",
    workspaceLabel: "Workspace",
    fileLabel: "File",
    domainLabel: "Site",
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
    focusMinutes: "Focus Minutes",
    unknown: "Unknown",
    uncategorizedTag: "Uncategorized",
    defaultSource: "default",
    typeCoding: "Coding",
    typeBrowser: "Browsing",
    typeDocs: "Docs",
    typeTerminal: "Terminal",
    typeChat: "Chat",
    typeMeeting: "Meeting",
    typeDesign: "Design",
    typeFiles: "Files",
    noContext: "No structured context yet"
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

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function localizedActivityType(type: string | null, t: (key: string) => string): string {
  switch (type) {
    case "coding":
      return t("typeCoding");
    case "browser":
      return t("typeBrowser");
    case "docs":
      return t("typeDocs");
    case "terminal":
      return t("typeTerminal");
    case "chat":
      return t("typeChat");
    case "meeting":
      return t("typeMeeting");
    case "design":
      return t("typeDesign");
    case "files":
      return t("typeFiles");
    default:
      return "-";
  }
}

function buildContextPrimary(row: Pick<ActivityEntry, "entity_name" | "detail" | "window_title">): string {
  return row.entity_name || row.detail || row.window_title || "";
}

function buildContextMeta(
  row: Pick<ActivityEntry, "detail" | "workspace" | "file_name" | "domain" | "window_title">,
  t: (key: string) => string
): string[] {
  const items = [
    row.detail ? `${t("detailLabel")}: ${row.detail}` : "",
    row.workspace ? `${t("workspaceLabel")}: ${row.workspace}` : "",
    row.file_name ? `${t("fileLabel")}: ${row.file_name}` : "",
    row.domain ? `${t("domainLabel")}: ${row.domain}` : "",
    row.window_title ? `${t("originalWindow")}: ${row.window_title}` : ""
  ].filter(Boolean);

  return Array.from(new Set(items));
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

function parseDate(v: string): Date | null {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toEpochSecond(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

function startOfLocalHour(d: Date): Date {
  const next = new Date(d);
  next.setMinutes(0, 0, 0);
  return next;
}

function startOfLocalDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getEntryWindow(row: ActivityEntry): EntryWindow | null {
  const started = parseDate(row.started_at);
  if (!started) return null;

  const startSec = toEpochSecond(started);
  const durationSec = Math.max(0, Math.floor(row.duration_seconds));
  return {
    startSec,
    endSec: startSec + durationSec
  };
}

function overlapSeconds(window: EntryWindow, startSec: number, endSec: number): number {
  return Math.max(0, Math.min(window.endSec, endSec) - Math.max(window.startSec, startSec));
}

function allocateEntryToBuckets(
  row: ActivityEntry,
  bucketStartSec: number,
  bucketSizeSec: number,
  bucketCount: number,
  onBucket: (bucketIndex: number, sec: number) => void
) {
  const window = getEntryWindow(row);
  if (!window || window.endSec <= bucketStartSec) return;

  const allEndSec = bucketStartSec + bucketSizeSec * bucketCount;
  if (window.startSec >= allEndSec) return;

  let index = Math.max(0, Math.floor((window.startSec - bucketStartSec) / bucketSizeSec));

  while (index < bucketCount) {
    const currentStart = bucketStartSec + index * bucketSizeSec;
    const currentEnd = currentStart + bucketSizeSec;
    const sec = overlapSeconds(window, currentStart, currentEnd);
    if (sec > 0) onBucket(index, sec);
    if (currentEnd >= window.endSec) break;
    index += 1;
  }
}

function buildChartSlices(map: Map<string, number>, fallbackLabel: string): ChartSlice[] {
  const rows = Array.from(map.entries())
    .map(([name, sec]) => ({ name, sec }))
    .filter((item) => item.sec > 0)
    .sort((a, b) => b.sec - a.sec);

  const total = rows.reduce((sum, item) => sum + item.sec, 0);
  if (!total) return [];

  const top = rows.slice(0, 6);
  const restSec = rows.slice(6).reduce((sum, item) => sum + item.sec, 0);
  const combined = restSec > 0 ? [...top, { name: fallbackLabel, sec: restSec }] : top;

  return combined.map((item, index) => ({
    ...item,
    ratio: item.sec / total,
    color: CHART_COLORS[index % CHART_COLORS.length]
  }));
}

function describeRange(hours: number, t: (key: string) => string): string {
  if (hours === 6) return t("recent6h");
  if (hours === 24) return t("recent24h");
  return t("recent7d");
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad)
  };
}

function createArcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function PieChart({
  slices,
  emptyText,
  onShowTip,
  onHideTip
}: {
  slices: ChartSlice[];
  emptyText: string;
  onShowTip: (event: ReactMouseEvent<Element>, text: string) => void;
  onHideTip: () => void;
}) {
  if (!slices.length) {
    return <p className="muted">{emptyText}</p>;
  }

  let startAngle = 0;

  return (
    <div className="pie-chart-wrap">
      <svg viewBox="0 0 120 120" className="pie-chart" aria-hidden="true">
        {slices.map((slice) => {
          const angle = Math.max(0.5, slice.ratio * 360);
          const endAngle = startAngle + angle;
          const path = createArcPath(60, 60, 54, startAngle, endAngle);
          startAngle = endAngle;
          const tip = `${slice.name} · ${formatDuration(slice.sec)} · ${Math.round(slice.ratio * 100)}%`;
          return (
            <path
              key={slice.name}
              d={path}
              fill={slice.color}
              onMouseMove={(event) => onShowTip(event, tip)}
              onMouseLeave={onHideTip}
            />
          );
        })}
        <circle cx="60" cy="60" r="26" fill="#111a27" />
      </svg>
      <div className="pie-legend">
        {slices.map((slice) => (
          <div
            className="pie-legend-row"
            key={slice.name}
            onMouseMove={(event) =>
              onShowTip(
                event,
                `${slice.name} · ${formatDuration(slice.sec)} · ${Math.round(slice.ratio * 100)}%`
              )
            }
            onMouseLeave={onHideTip}
          >
            <span
              className="pie-dot"
              style={{ background: slice.color }}
            />
            <span className="pie-name">{slice.name}</span>
            <b>{Math.round(slice.ratio * 100)}%</b>
            <small>{formatDuration(slice.sec)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function StackedTrendChart({
  days,
  emptyText,
  onShowTip,
  onHideTip
}: {
  days: TrendDay[];
  emptyText: string;
  onShowTip: (event: ReactMouseEvent<Element>, text: string) => void;
  onHideTip: () => void;
}) {
  const hasData = days.some((day) => day.totalSec > 0);
  if (!hasData) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="trend-days">
      {days.map((day) => (
        <div className="trend-day-row" key={day.key}>
          <div className="trend-day-meta">
            <span>{day.label}</span>
            <small>{formatDuration(day.totalSec)}</small>
          </div>
          <div className="trend-day-track">
            {day.segments.length ? (
              day.segments.map((segment) => (
                <div
                  key={`${day.key}-${segment.name}`}
                  className="trend-day-fill"
                  onMouseMove={(event) =>
                    onShowTip(event, `${day.label} · ${segment.name} · ${formatDuration(segment.sec)}`)
                  }
                  onMouseLeave={onHideTip}
                  style={{
                    width: `${Math.max(2, Math.round(segment.ratio * 100))}%`,
                    background: segment.color
                  }}
                />
              ))
            ) : (
              <div className="trend-day-empty" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [detailMode, setDetailMode] = useState(false);
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
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [chartGroup, setChartGroup] = useState<ChartGroup>("project");
  const [hoverTip, setHoverTip] = useState<HoverTip | null>(null);

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

    const detailCached = localStorage.getItem(DETAIL_MODE_KEY);
    if (detailCached === "true") {
      setDetailMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    localStorage.setItem(DETAIL_MODE_KEY, String(detailMode));
  }, [detailMode]);

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

  const dashboard = useMemo(() => {
    const now = new Date();
    const rangeEndSec = toEpochSecond(now);
    const rangeStartSec = rangeEndSec - rangeHours * 3600;

    let totalSeconds = 0;
    let runningSeconds = 0;
    let uncategorizedSeconds = 0;

    const byTag = new Map<string, number>();
    const byProject = new Map<string, number>();
    const byApp = new Map<string, number>();

    for (const row of entries) {
      const window = getEntryWindow(row);
      if (!window) continue;
      const sec = overlapSeconds(window, rangeStartSec, rangeEndSec);
      if (sec <= 0) continue;
      totalSeconds += sec;
      if (!row.ended_at) runningSeconds += sec;
      if (!row.project && !row.tag) uncategorizedSeconds += sec;

      const projectKey = row.project || row.app_name || t("unknown");
      byProject.set(projectKey, (byProject.get(projectKey) ?? 0) + sec);

      const tagKey = row.tag || t("uncategorizedTag");
      byTag.set(tagKey, (byTag.get(tagKey) ?? 0) + sec);

      const appKey = row.app_name || t("unknown");
      byApp.set(appKey, (byApp.get(appKey) ?? 0) + sec);
    }

    const topProjects = Array.from(byProject.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5);

    const topTags = Array.from(byTag.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5);

    const topApps = Array.from(byApp.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5);

    const buckets: DashboardBucket[] = [];

    if (rangeHours <= 24) {
      const firstHour = new Date(startOfLocalHour(now).getTime() - (rangeHours - 1) * 3600 * 1000);
      const firstHourSec = toEpochSecond(firstHour);

      for (let i = 0; i < rangeHours; i += 1) {
        const d = new Date(firstHour.getTime() + i * 3600 * 1000);
        buckets.push({ label: `${String(d.getHours()).padStart(2, "0")}:00`, sec: 0 });
      }

      for (const row of entries) {
        allocateEntryToBuckets(row, firstHourSec, 3600, rangeHours, (index, sec) => {
          buckets[index].sec += sec;
        });
      }
    } else {
      const days = Math.ceil(rangeHours / 24);
      const firstDay = new Date(startOfLocalDay(now));
      firstDay.setDate(firstDay.getDate() - (days - 1));
      const firstDaySec = toEpochSecond(firstDay);

      for (let i = 0; i < days; i += 1) {
        const d = new Date(firstDay);
        d.setDate(firstDay.getDate() + i);
        const key = localDayKey(d);
        buckets.push({ label: key.slice(5), sec: 0 });
      }

      for (const row of entries) {
        allocateEntryToBuckets(row, firstDaySec, 24 * 3600, days, (index, sec) => {
          buckets[index].sec += sec;
        });
      }
    }

    const maxBucketSec = Math.max(1, ...buckets.map((x) => x.sec));

    return {
      totalSeconds,
      runningSeconds,
      uncategorizedSeconds,
      topProjects,
      topTags,
      topApps,
      projectSlices: buildChartSlices(byProject, locale === "zh" ? "其他项目" : "Other Projects"),
      tagSlices: buildChartSlices(byTag, locale === "zh" ? "其他标签" : "Other Tags"),
      appSlices: buildChartSlices(byApp, locale === "zh" ? "其他应用" : "Other Apps"),
      buckets,
      maxBucketSec
    };
  }, [entries, rangeHours, locale]);

  const dayOverview = useMemo(() => {
    const now = new Date();
    const todayStart = startOfLocalDay(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    const todayStartSec = toEpochSecond(todayStart);
    const tomorrowStartSec = toEpochSecond(tomorrowStart);

    let totalSeconds = 0;
    let uncategorizedSeconds = 0;
    let runningSeconds = 0;

    const byProject = new Map<string, number>();
    const byTag = new Map<string, number>();
    const byApp = new Map<string, number>();
    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, sec: 0 }));

    for (const row of entries) {
      const window = getEntryWindow(row);
      if (!window) continue;
      const sec = overlapSeconds(window, todayStartSec, tomorrowStartSec);
      if (sec <= 0) continue;
      totalSeconds += sec;
      if (!row.project && !row.tag) uncategorizedSeconds += sec;
      if (!row.ended_at) runningSeconds += sec;

      const app = row.app_name || t("unknown");
      const project = row.project || app;
      const tag = row.tag || t("uncategorizedTag");

      byApp.set(app, (byApp.get(app) ?? 0) + sec);
      byProject.set(project, (byProject.get(project) ?? 0) + sec);
      byTag.set(tag, (byTag.get(tag) ?? 0) + sec);
      allocateEntryToBuckets(row, todayStartSec, 3600, 24, (index, bucketSec) => {
        hourBuckets[index].sec += bucketSec;
      });
    }

    const topProjects = Array.from(byProject.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 4);
    const topTags = Array.from(byTag.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 4);
    const topApps = Array.from(byApp.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 4);

    const coverage = totalSeconds
      ? Math.max(
          0,
          Math.round(((totalSeconds - uncategorizedSeconds) / Math.max(1, totalSeconds)) * 100)
        )
      : 0;

    const focusMinutes = Math.round(totalSeconds / 60);
    const maxBucket = Math.max(1, ...hourBuckets.map((x) => x.sec));

    return {
      totalSeconds,
      runningSeconds,
      uncategorizedSeconds,
      topProjects,
      topTags,
      topApps,
      hourBuckets,
      maxBucket,
      coverage,
      focusMinutes
    };
  }, [entries, locale]);

  const trendByGroup = useMemo(() => {
    const now = new Date();
    const dayCount = 7;
    const dayKeys: TrendDay[] = [];
    const dayMap = new Map<string, Map<string, number>>();
    const totalsByGroup = new Map<string, number>();
    const firstDay = new Date(startOfLocalDay(now));
    firstDay.setDate(firstDay.getDate() - (dayCount - 1));
    const firstDaySec = toEpochSecond(firstDay);

    for (let i = 0; i < dayCount; i += 1) {
      const d = new Date(firstDay);
      d.setDate(firstDay.getDate() + i);
      const key = localDayKey(d);
      dayKeys.push({ key, label: key.slice(5), totalSec: 0, segments: [] });
      dayMap.set(key, new Map());
    }

    for (const row of entries) {
      const groupName =
        chartGroup === "project"
          ? row.project || row.app_name || t("unknown")
          : row.app_name || t("unknown");

      allocateEntryToBuckets(row, firstDaySec, 24 * 3600, dayCount, (index, sec) => {
        const dayKey = dayKeys[index]?.key;
        if (!dayKey) return;
        const bucket = dayMap.get(dayKey);
        if (!bucket) return;
        bucket.set(groupName, (bucket.get(groupName) ?? 0) + sec);
        totalsByGroup.set(groupName, (totalsByGroup.get(groupName) ?? 0) + sec);
      });
    }

    const topGroups = Array.from(totalsByGroup.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const colorMap = new Map<string, string>();
    topGroups.forEach((name, index) => {
      colorMap.set(name, CHART_COLORS[index % CHART_COLORS.length]);
    });
    colorMap.set(t("otherGroup"), CHART_COLORS[topGroups.length % CHART_COLORS.length]);

    return dayKeys.map((day) => {
      const bucket = dayMap.get(day.key) ?? new Map();
      const totalSec = Array.from(bucket.values()).reduce((sum, sec) => sum + sec, 0);

      const primary = topGroups
        .map((name) => ({ name, sec: bucket.get(name) ?? 0 }))
        .filter((item) => item.sec > 0);
      const otherSec = Array.from(bucket.entries())
        .filter(([name]) => !topGroups.includes(name))
        .reduce((sum, [, sec]) => sum + sec, 0);

      const combined = otherSec > 0 ? [...primary, { name: t("otherGroup"), sec: otherSec }] : primary;

      return {
        key: day.key,
        label: day.label,
        totalSec,
        segments: combined.map((item) => ({
          ...item,
          ratio: totalSec ? item.sec / totalSec : 0,
          color: colorMap.get(item.name) ?? CHART_COLORS[0]
        }))
      };
    });
  }, [entries, chartGroup, locale]);

  const timelineRows = useMemo(() => {
    const q = timelineQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((row) => {
      const hay = [
        row.app_name,
        row.activity_type || "",
        row.entity_name || "",
        row.detail || "",
        row.workspace || "",
        row.file_name || "",
        row.domain || "",
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

  function showHoverTip(event: ReactMouseEvent<Element>, text: string) {
    setHoverTip({
      text,
      x: event.clientX + 14,
      y: event.clientY + 14
    });
  }

  function hideHoverTip() {
    setHoverTip(null);
  }

  return (
    <main className={`app ${viewMode === "overview" ? "app--overview" : ""}`}>
      <header className="header">
        <div>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
          <p className="header-hint">{t("backgroundHint")}</p>
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
            <span>{t("detailMode")}</span>
            <input
              type="checkbox"
              checked={detailMode}
              onChange={(e) => setDetailMode(e.target.checked)}
            />
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

      <div className="view-tabs" role="tablist" aria-label={t("view")}>
        <button
          className={`view-tab ${viewMode === "overview" ? "active" : ""}`}
          onClick={() => setViewMode("overview")}
        >
          {t("viewOverview")}
        </button>
        <button
          className={`view-tab ${viewMode === "dashboard" ? "active" : ""}`}
          onClick={() => setViewMode("dashboard")}
        >
          {t("viewDashboard")}
        </button>
        <button
          className={`view-tab ${viewMode === "charts" ? "active" : ""}`}
          onClick={() => setViewMode("charts")}
        >
          {t("viewCharts")}
        </button>
        <button
          className={`view-tab ${viewMode === "rules" ? "active" : ""}`}
          onClick={() => setViewMode("rules")}
        >
          {t("viewRules")}
        </button>
        <button
          className={`view-tab ${viewMode === "timeline" ? "active" : ""}`}
          onClick={() => setViewMode("timeline")}
        >
          {t("viewTimeline")}
        </button>
      </div>

      {viewMode === "overview" ? (
      <>
      <section className="panel">
        <div className="panel-head">
          <h2>{t("dayOverview")}</h2>
          <span className="muted">{t("allInOneScreen")}</span>
        </div>
        <div className="overview-grid">
          <div className="overview-block">
            <h3>{t("current")}</h3>
            {active ? (
              <div className="current">
                <strong>{active.app_name}</strong>
                <span>{buildContextPrimary(active) || active.window_title || "(No title)"}</span>
                {detailMode ? (
                  <small>
                    {[
                      localizedActivityType(active.activity_type, t),
                      active.workspace,
                      active.domain
                    ]
                      .filter((item) => item && item !== "-")
                      .join(" · ")}
                  </small>
                ) : null}
                <small>{asDateText(active.captured_at)}</small>
              </div>
            ) : (
              <p className="muted">{t("noActive")}</p>
            )}
          </div>

          <div className="overview-block">
            <h3>KPI</h3>
            <div className="kpi-grid compact">
              <div className="kpi-card">
                <span>{t("todayTotal")}</span>
                <strong>{formatDuration(dayOverview.totalSeconds)}</strong>
              </div>
              <div className="kpi-card">
                <span>{t("focusMinutes")}</span>
                <strong>{dayOverview.focusMinutes}</strong>
              </div>
              <div className="kpi-card">
                <span>{t("ruleCoverage")}</span>
                <strong>{dayOverview.coverage}%</strong>
              </div>
              <div className="kpi-card">
                <span>{t("runningSegments")}</span>
                <strong>{formatDuration(dayOverview.runningSeconds)}</strong>
              </div>
            </div>
          </div>

          <div className="overview-block">
            <h3>24h</h3>
            <div className="hour-bars">
              {dayOverview.hourBuckets.map((item) => (
                <div className="hour-col" key={item.hour}>
                  <div className="hour-track">
                    <div
                      className="hour-fill"
                      style={{
                        height: `${Math.max(
                          4,
                          Math.round((item.sec / dayOverview.maxBucket) * 100)
                        )}%`
                      }}
                    />
                  </div>
                  <span>{String(item.hour).padStart(2, "0")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overview-block">
            <h3>{t("topProjects")}</h3>
            {dayOverview.topProjects.map((item) => (
              <div className="mini-row" key={item.name}>
                <span>{item.name}</span>
                <b>{formatDuration(item.sec)}</b>
              </div>
            ))}
            {!dayOverview.topProjects.length ? <p className="muted">{t("noProjectData")}</p> : null}
          </div>

          <div className="overview-block">
            <h3>{t("topTags")}</h3>
            {dayOverview.topTags.map((item) => (
              <div className="mini-row" key={item.name}>
                <span>{item.name}</span>
                <b>{formatDuration(item.sec)}</b>
              </div>
            ))}
            {!dayOverview.topTags.length ? <p className="muted">{t("noTagData")}</p> : null}
          </div>

          <div className="overview-block">
            <h3>{t("topApps")}</h3>
            {dayOverview.topApps.map((item) => (
              <div className="mini-row" key={item.name}>
                <span>{item.name}</span>
                <b>{formatDuration(item.sec)}</b>
              </div>
            ))}
            {!dayOverview.topApps.length ? <p className="muted">{t("noAppData")}</p> : null}
          </div>
        </div>
      </section>
      </>
      ) : null}

      {viewMode === "dashboard" ? (
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
      ) : null}

      {viewMode === "charts" ? (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{t("charts")}</h2>
            <p className="muted">{t("chartsRangeHint")}</p>
          </div>
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
            <span>{t("range")}</span>
            <strong>{describeRange(rangeHours, t)}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("todayTotal")}</span>
            <strong>{formatDuration(dashboard.totalSeconds)}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("topProjects")}</span>
            <strong>{dashboard.topProjects[0]?.name ?? "-"}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("topApps")}</span>
            <strong>{dashboard.topApps[0]?.name ?? "-"}</strong>
          </div>
        </div>

        <div className="charts-grid">
          <div className="mini-panel">
            <h3>{t("topProjects")}</h3>
            <PieChart
              slices={dashboard.projectSlices}
              emptyText={t("noProjectData")}
              onShowTip={showHoverTip}
              onHideTip={hideHoverTip}
            />
          </div>
          <div className="mini-panel">
            <h3>{t("topTags")}</h3>
            <PieChart
              slices={dashboard.tagSlices}
              emptyText={t("noTagData")}
              onShowTip={showHoverTip}
              onHideTip={hideHoverTip}
            />
          </div>
          <div className="mini-panel">
            <h3>{t("topApps")}</h3>
            <PieChart
              slices={dashboard.appSlices}
              emptyText={t("noAppData")}
              onShowTip={showHoverTip}
              onHideTip={hideHoverTip}
            />
          </div>
        </div>

        <div className="mini-panel trend-panel">
          <div className="panel-head">
            <div>
              <h3>{t("dailyTrend")}</h3>
              <p className="muted">{t("trendHint")}</p>
            </div>
            <label>
              <span>{t("groupBy")}</span>
              <select
                value={chartGroup}
                onChange={(e) => setChartGroup(e.target.value as ChartGroup)}
              >
                <option value="project">{t("groupByProject")}</option>
                <option value="app">{t("groupByApp")}</option>
              </select>
            </label>
          </div>
          <StackedTrendChart
            days={trendByGroup}
            emptyText={t("noData")}
            onShowTip={showHoverTip}
            onHideTip={hideHoverTip}
          />
        </div>
      </section>
      ) : null}

      {viewMode === "rules" ? (
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
      ) : null}

      {viewMode === "timeline" ? (
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
                  <th>{t("activityType")}</th>
                  <th>{t("context")}</th>
                  <th>{t("app")}</th>
                  <th>{t("project")}</th>
                  <th>{t("tag")}</th>
                  <th>{t("source")}</th>
                  <th>{t("start")}</th>
                  <th>{t("end")}</th>
                  <th>{t("duration")}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const contextPrimary = buildContextPrimary(row);
                  const contextMeta = buildContextMeta(row, t);
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="activity-pill">
                          {localizedActivityType(row.activity_type, t)}
                        </span>
                      </td>
                      <td className="context-cell">
                        <div className="context-primary">
                          {contextPrimary || t("noContext")}
                        </div>
                        {detailMode && contextMeta.length ? (
                          <div className="context-meta">
                            {contextMeta.map((item) => (
                              <span key={item}>{item}</span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="app-meta">
                          <strong>{row.app_name}</strong>
                          {detailMode && row.bundle_id ? <small>{row.bundle_id}</small> : null}
                        </div>
                      </td>
                      <td>{row.project || "-"}</td>
                      <td>{row.tag || "-"}</td>
                      <td>{row.source || t("defaultSource")}</td>
                      <td>{asDateText(row.started_at)}</td>
                      <td>{row.ended_at ? asDateText(row.ended_at) : t("running")}</td>
                      <td>{formatDuration(row.duration_seconds)}</td>
                    </tr>
                  );
                })}
                {!pageRows.length ? (
                  <tr>
                    <td colSpan={9} className="muted">
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
      ) : null}

      {hoverTip ? (
        <div className="hover-tip" style={{ left: hoverTip.x, top: hoverTip.y }}>
          {hoverTip.text}
        </div>
      ) : null}
    </main>
  );
}
