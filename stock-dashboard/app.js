import { loadState, saveState, upsertItem, removeItem, collectGroups } from "./storage.js";
import { fetchQuotes } from "./quotes.js";
import { renderSparkline, renderTrendChart } from "./chart.js";
import {
  loadCloudConfig,
  saveCloudConfig,
  createCloudClient,
  getCloudUser,
  sendMagicLink,
  signOutCloud,
  onCloudAuthChange,
  loadRemoteState,
  saveRemoteState,
  saveMarketEventHistory,
  loadMarketEventHistory
} from "./cloud.js";

const els = {
  stockForm: document.getElementById("stockForm"),
  symbolInput: document.getElementById("symbolInput"),
  nameInput: document.getElementById("nameInput"),
  groupInput: document.getElementById("groupInput"),
  noteInput: document.getElementById("noteInput"),
  costBasisInput: document.getElementById("costBasisInput"),
  sharesInput: document.getElementById("sharesInput"),
  holdingTypeInput: document.getElementById("holdingTypeInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  addStockBtn: document.getElementById("addStockBtn"),
  addStockInlineBtn: document.getElementById("addStockInlineBtn"),
  toggleCloudBtn: document.getElementById("toggleCloudBtn"),
  toggleToolsBtn: document.getElementById("toggleToolsBtn"),
  stockFormPanel: document.getElementById("stockForm"),
  cloudPanel: document.getElementById("cloudPanel"),
  toolsPanel: document.getElementById("toolsPanel"),
  supabaseUrlInput: document.getElementById("supabaseUrlInput"),
  supabaseAnonKeyInput: document.getElementById("supabaseAnonKeyInput"),
  cloudEmailInput: document.getElementById("cloudEmailInput"),
  saveCloudConfigBtn: document.getElementById("saveCloudConfigBtn"),
  sendMagicLinkBtn: document.getElementById("sendMagicLinkBtn"),
  loadCloudBtn: document.getElementById("loadCloudBtn"),
  syncCloudBtn: document.getElementById("syncCloudBtn"),
  logoutCloudBtn: document.getElementById("logoutCloudBtn"),
  cloudStatus: document.getElementById("cloudStatus"),
  groupFilter: document.getElementById("groupFilter"),
  performanceFilter: document.getElementById("performanceFilter"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  sortDirection: document.getElementById("sortDirection"),
  autoRefreshSelect: document.getElementById("autoRefreshSelect"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  notifyToggleBtn: document.getElementById("notifyToggleBtn"),
  pageSizeSelect: document.getElementById("pageSizeSelect"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageInfo: document.getElementById("pageInfo"),
  pagination: document.getElementById("pagination"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  stockTableBody: document.getElementById("stockTableBody"),
  lastUpdated: document.getElementById("lastUpdated"),
  actionQueueBody: document.getElementById("actionQueueBody"),
  marketEventsBody: document.getElementById("marketEventsBody"),
  marketNewsFeed: document.getElementById("marketNewsFeed"),
  marketEventsHint: document.getElementById("marketEventsHint"),
  marketHistoryBody: document.getElementById("marketHistoryBody"),
  marketHistoryHint: document.getElementById("marketHistoryHint"),
  rowTemplate: document.getElementById("rowTemplate"),
  countStat: document.getElementById("countStat"),
  upStat: document.getElementById("upStat"),
  downStat: document.getElementById("downStat"),
  flatStat: document.getElementById("flatStat"),
  marketPulseBody: document.getElementById("marketPulseBody"),
  mag7SnapshotBody: document.getElementById("mag7SnapshotBody"),
  leadersBody: document.getElementById("leadersBody"),
  portfolioSnapshotBody: document.getElementById("portfolioSnapshotBody"),
  decisionWorkspaceBody: document.getElementById("decisionWorkspaceBody"),
  emptyState: document.getElementById("emptyState"),
  mobileList: document.getElementById("mobileList"),
  listHint: document.getElementById("listHint"),
  strategyRulesInput: document.getElementById("strategyRulesInput"),
  saveStrategyBtn: document.getElementById("saveStrategyBtn"),
  strategyHint: document.getElementById("strategyHint"),
  signalSummary: document.getElementById("signalSummary"),
  signalList: document.getElementById("signalList"),
  broadcastHint: document.getElementById("broadcastHint"),
  dropAlertEnabled: document.getElementById("dropAlertEnabled"),
  dropThresholdInput: document.getElementById("dropThresholdInput"),
  dropAlertVoice: document.getElementById("dropAlertVoice"),
  dropAlertSound: document.getElementById("dropAlertSound"),
  dropAlertNotify: document.getElementById("dropAlertNotify"),
  testBroadcastBtn: document.getElementById("testBroadcastBtn"),
  dropSummary: document.getElementById("dropSummary"),
  dropList: document.getElementById("dropList"),
  detailOverlay: document.getElementById("detailOverlay")
};

const state = {
  items: [],
  preferences: {
    selectedGroup: "all",
    performanceFilter: "all",
    searchKeyword: "",
    sortKey: "changePercent",
    sortDirection: "desc",
    autoRefreshSec: 0,
    pageSize: 10,
    currentPage: 1,
    strategyRulesText: "8:20,12:30,18:50",
    notifyOnTarget: false
  },
  quotes: {},
  usPeaks: {},
  marketEvents: [],
  marketEventsLoading: false,
  marketEventsError: "",
  marketEventsFetchedAt: 0,
  marketHistory: [],
  marketHistoryLoading: false,
  marketHistoryError: "",
  marketHistoryRange: 30,
  targetHits: new Set(),
  dropAlerted: new Set(),
  audioCtx: null,
  detail: {
    symbol: null,
    loading: false,
    error: "",
    data: null
  },
  loading: false,
  autoRefreshTimer: null,
  lastSuccessAt: null,
  cloud: {
    client: null,
    user: null,
    syncing: false,
    unsubscribeAuth: null
  }
};

const NASDAQ_BENCHMARK_SYMBOL = "QQQ";
const MAG7_ETF_SYMBOL = "MAGS";
// Mirrored from lib/nasdaq-universe.js so quotes can start before the API responds.
const NASDAQ_FOCUS_SYMBOLS = ["QQQ", "MAGS", "NVDA", "AAPL", "MU", "MSFT", "AMD", "AMZN", "TSLA", "GOOGL", "GOOG", "INTC", "META", "AVGO"];
const NASDAQ_CORE_SYMBOLS = ["NVDA", "AAPL", "MU", "MSFT", "AMD", "AMZN", "TSLA", "GOOGL", "INTC", "META", "AVGO"];

init();

async function init() {
  const saved = loadState();
  const cloudConfig = loadCloudConfig();
  state.items = saved.items;
  state.preferences = saved.preferences;
  state.usPeaks = saved.usPeaks || {};
  state.marketEvents = saved.marketEvents || [];
  bindEvents();
  syncCloudConfigInputs(cloudConfig);
  syncControls();
  renderGroupFilter();
  configureAutoRefresh();
  setStatus("neutral", "等待刷新");
  setCloudStatus("未连接云端");
  updateCloudButtons();
  await initCloud(cloudConfig);
  await refreshQuotes();
}

function isAShareSymbol(symbol) {
  return /^(6|0|3|8)\d{5}$/.test(String(symbol || "").trim().toUpperCase());
}

function isGlobalStockSymbol(symbol) {
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(String(symbol || "").trim().toUpperCase());
}

function buildAShareDetailUrl(symbol) {
  return "./api/a-share/detail?symbol=" + encodeURIComponent(String(symbol || "").trim().toUpperCase());
}

function buildGlobalDetailUrl(symbol) {
  return "./api/global-stock/detail?symbol=" + encodeURIComponent(String(symbol || "").trim().toUpperCase());
}

function buildDailyMarketEventsUrl(symbols, benchmarkChange) {
  const params = new URLSearchParams();
  params.set("mode", "nasdaq-focus-v1");
  if (Array.isArray(symbols) && symbols.length) params.set("symbols", symbols.join(","));
  if (Number.isFinite(Number(benchmarkChange))) params.set("benchmarkChange", String(benchmarkChange));
  return "./api/global-stock/daily-events?" + params.toString();
}

function bindEvents() {
  [els.addStockBtn, els.addStockInlineBtn].filter(Boolean).forEach(function (button) {
    button.addEventListener("click", function () {
      revealPanel(els.stockFormPanel, els.symbolInput);
    });
  });

  if (els.toggleCloudBtn) {
    els.toggleCloudBtn.addEventListener("click", function () {
      togglePanel(els.cloudPanel, els.toggleCloudBtn);
    });
  }

  if (els.toggleToolsBtn) {
    els.toggleToolsBtn.addEventListener("click", function () {
      togglePanel(els.toolsPanel, els.toggleToolsBtn);
    });
  }

  document.querySelectorAll("[data-scroll-target]").forEach(function (button) {
    button.addEventListener("click", function () {
      const target = document.getElementById(button.getAttribute("data-scroll-target"));
      if (!target) return;
      document.querySelectorAll("[data-scroll-target]").forEach(function (item) {
        item.classList.toggle("is-active", item === button);
      });
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-history-range]").forEach(function (button) {
    button.addEventListener("click", function () {
      const range = Number(button.getAttribute("data-history-range"));
      if (![30, 90, 180].includes(range) || range === state.marketHistoryRange) return;
      state.marketHistoryRange = range;
      void refreshMarketHistory();
    });
  });

  els.stockForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const symbol = String(els.symbolInput.value || "").trim().toUpperCase();
    if (!symbol) return;

    state.items = upsertItem(state.items, {
      symbol,
      displayName: els.nameInput.value,
      group: els.groupInput.value,
      note: els.noteInput.value,
      costBasis: els.costBasisInput.value,
      shares: els.sharesInput.value,
      holdingType: els.holdingTypeInput.value,
      createdAt: new Date().toISOString()
    });

    persist();
    renderGroupFilter();
    syncControls();
    els.stockForm.reset();
    els.stockForm.classList.add("hidden");
    await refreshQuotes();
  });

  els.refreshBtn.addEventListener("click", async function () {
    await refreshQuotes();
  });

  els.saveCloudConfigBtn.addEventListener("click", async function () {
    const config = readCloudConfigInputs();
    const normalized = saveCloudConfig(config);
    syncCloudConfigInputs(normalized);
    await initCloud(normalized);
  });

  els.sendMagicLinkBtn.addEventListener("click", async function () {
    const cloud = state.cloud;
    if (!cloud.client) {
      setCloudStatus("请先保存有效的 Supabase 配置");
      return;
    }

    toggleCloudButtons(true);
    const result = await sendMagicLink(cloud.client, els.cloudEmailInput.value);
    toggleCloudButtons(false);
    if (result.error) {
      setCloudStatus("发送失败：" + result.error);
      return;
    }
    setCloudStatus("登录链接已发送，请在邮箱点击后返回本页");
  });

  els.loadCloudBtn.addEventListener("click", async function () {
    await pullFromCloud({ overrideLocal: true });
  });

  els.syncCloudBtn.addEventListener("click", async function () {
    await pushToCloud("manual");
  });

  els.logoutCloudBtn.addEventListener("click", async function () {
    if (!state.cloud.client) return;
    const result = await signOutCloud(state.cloud.client);
    if (result.error) {
      setCloudStatus("退出失败：" + result.error);
      return;
    }
    state.cloud.user = null;
    setCloudStatus("已退出云端账号");
    updateCloudButtons();
  });

  els.groupFilter.addEventListener("change", function () {
    state.preferences.selectedGroup = els.groupFilter.value;
    state.preferences.currentPage = 1;
    persist();
    render();
  });

  els.performanceFilter.addEventListener("change", function () {
    state.preferences.performanceFilter = els.performanceFilter.value;
    state.preferences.currentPage = 1;
    persist();
    render();
  });

  els.searchInput.addEventListener("input", function () {
    state.preferences.searchKeyword = els.searchInput.value.trim();
    state.preferences.currentPage = 1;
    persist();
    render();
  });

  els.sortSelect.addEventListener("change", function () {
    state.preferences.sortKey = els.sortSelect.value;
    persist();
    render();
  });

  els.sortDirection.addEventListener("change", function () {
    state.preferences.sortDirection = els.sortDirection.value;
    persist();
    render();
  });

  els.autoRefreshSelect.addEventListener("change", function () {
    state.preferences.autoRefreshSec = Number(els.autoRefreshSelect.value) || 0;
    persist();
    configureAutoRefresh();
    renderListHint(getVisibleItems().length);
  });

  els.pageSizeSelect.addEventListener("change", function () {
    state.preferences.pageSize = Number(els.pageSizeSelect.value) || 10;
    state.preferences.currentPage = 1;
    persist();
    render();
  });

  els.saveStrategyBtn.addEventListener("click", function () {
    const text = String(els.strategyRulesInput.value || "").trim();
    const parsed = parseStrategyRules(text);
    if (!parsed.length) {
      els.strategyHint.textContent = "规则无效，请使用例如 8:20,12:30,18:50";
      return;
    }

    state.preferences.strategyRulesText = parsed.map(function (rule) {
      return rule.drawdown + ":" + rule.sellPercent;
    }).join(",");
    persist();
    syncControls();
    render();
  });

  els.notifyToggleBtn.addEventListener("click", async function () {
    const enabling = !state.preferences.notifyOnTarget;
    if (enabling) {
      if (typeof Notification === "undefined") {
        els.notifyToggleBtn.textContent = "到价提醒：不支持";
        return;
      }
      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          els.notifyToggleBtn.textContent = "到价提醒：需授权";
          return;
        }
      }
    }
    state.preferences.notifyOnTarget = enabling;
    persist();
    syncControls();
    render();
  });

  els.dropAlertEnabled.addEventListener("change", function () {
    state.preferences.dropAlertEnabled = els.dropAlertEnabled.checked;
    if (els.dropAlertEnabled.checked) {
      primeAudio();
    } else {
      state.dropAlerted.clear();
    }
    persist();
    render();
  });

  els.dropThresholdInput.addEventListener("change", function () {
    const value = Number(els.dropThresholdInput.value);
    if (Number.isFinite(value) && value > 0) {
      state.preferences.dropAlertThreshold = Math.min(50, Math.max(0.1, Number(value.toFixed(2))));
    }
    state.dropAlerted.clear();
    persist();
    syncControls();
    render();
  });

  els.dropAlertVoice.addEventListener("change", function () {
    state.preferences.dropAlertVoice = els.dropAlertVoice.checked;
    primeAudio();
    persist();
  });

  els.dropAlertSound.addEventListener("change", function () {
    state.preferences.dropAlertSound = els.dropAlertSound.checked;
    primeAudio();
    persist();
  });

  els.dropAlertNotify.addEventListener("change", async function () {
    if (els.dropAlertNotify.checked && typeof Notification !== "undefined" && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        els.dropAlertNotify.checked = false;
      }
    }
    state.preferences.dropAlertNotify = els.dropAlertNotify.checked;
    persist();
  });

  els.testBroadcastBtn.addEventListener("click", function () {
    primeAudio();
    broadcastDrops([{ symbol: "TEST", name: "示例股票", changePercent: -3.21 }], { test: true });
  });

  els.clearFiltersBtn.addEventListener("click", function () {
    state.preferences.selectedGroup = "all";
    state.preferences.performanceFilter = "all";
    state.preferences.searchKeyword = "";
    state.preferences.currentPage = 1;
    persist();
    syncControls();
    render();
  });

  els.prevPageBtn.addEventListener("click", function () {
    if (state.preferences.currentPage > 1) {
      state.preferences.currentPage -= 1;
      persist();
      render();
    }
  });

  els.nextPageBtn.addEventListener("click", function () {
    const totalPages = getTotalPages(getVisibleItems().length, state.preferences.pageSize);
    if (state.preferences.currentPage < totalPages) {
      state.preferences.currentPage += 1;
      persist();
      render();
    }
  });

  async function handleDeleteClick(event) {
    const button = event.target.closest("button[data-symbol]");
    if (!button) return;
    const symbol = String(button.getAttribute("data-symbol") || "").trim().toUpperCase();
    state.items = removeItem(state.items, symbol);
    if (state.usPeaks[symbol]) {
      delete state.usPeaks[symbol];
    }
    persist();
    renderGroupFilter();
    await refreshQuotes();
  }

  function handleTargetChange(event) {
    const input = event.target.closest("input.target-input[data-symbol]");
    if (!input) return;
    const symbol = String(input.getAttribute("data-symbol") || "").trim().toUpperCase();
    const raw = String(input.value || "").trim();
    const value = Number(raw);
    const targetPrice = raw !== "" && Number.isFinite(value) && value > 0 ? value : null;

    state.items = state.items.map(function (item) {
      return item.symbol === symbol ? { ...item, targetPrice } : item;
    });
    state.targetHits.delete(symbol);
    persist();
    render();
  }

  els.stockTableBody.addEventListener("click", handleDeleteClick);
  els.mobileList.addEventListener("click", handleDeleteClick);
  els.stockTableBody.addEventListener("change", handleTargetChange);
  els.mobileList.addEventListener("change", handleTargetChange);
  els.stockTableBody.addEventListener("click", function (event) {
    const button = event.target.closest("[data-analyze-symbol]");
    if (!button) return;
    void openAnalysis(button.getAttribute("data-analyze-symbol"));
  });
  els.mobileList.addEventListener("click", function (event) {
    const button = event.target.closest("[data-analyze-symbol]");
    if (!button) return;
    void openAnalysis(button.getAttribute("data-analyze-symbol"));
  });
  els.actionQueueBody.addEventListener("click", function (event) {
    const button = event.target.closest("[data-analyze-symbol]");
    if (!button) return;
    void openAnalysis(button.getAttribute("data-analyze-symbol"));
  });
  els.detailOverlay.addEventListener("click", function (event) {
    if (event.target.closest("[data-close-detail]")) {
      closeAnalysis();
    }
  });
}

function revealPanel(panel, focusTarget) {
  if (!panel) return;
  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  if (focusTarget) {
    window.setTimeout(function () {
      focusTarget.focus();
    }, 250);
  }
}

function togglePanel(panel, button) {
  if (!panel) return;
  const willOpen = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !willOpen);
  if (button) {
    button.setAttribute("aria-expanded", String(willOpen));
  }
  if (willOpen) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function syncControls() {
  els.groupFilter.value = state.preferences.selectedGroup;
  els.performanceFilter.value = state.preferences.performanceFilter;
  els.searchInput.value = state.preferences.searchKeyword;
  els.sortSelect.value = state.preferences.sortKey;
  els.sortDirection.value = state.preferences.sortDirection;
  els.autoRefreshSelect.value = String(state.preferences.autoRefreshSec);
  els.pageSizeSelect.value = String(state.preferences.pageSize);
  els.strategyRulesInput.value = state.preferences.strategyRulesText;
  els.notifyToggleBtn.textContent = "到价提醒：" + (state.preferences.notifyOnTarget ? "开" : "关");
  els.dropAlertEnabled.checked = !!state.preferences.dropAlertEnabled;
  els.dropThresholdInput.value = String(state.preferences.dropAlertThreshold);
  els.dropAlertVoice.checked = !!state.preferences.dropAlertVoice;
  els.dropAlertSound.checked = !!state.preferences.dropAlertSound;
  els.dropAlertNotify.checked = !!state.preferences.dropAlertNotify;
}

function syncCloudConfigInputs(config) {
  els.supabaseUrlInput.value = String(config?.url || "");
  els.supabaseAnonKeyInput.value = String(config?.anonKey || "");
}

function readCloudConfigInputs() {
  return {
    url: String(els.supabaseUrlInput.value || "").trim(),
    anonKey: String(els.supabaseAnonKeyInput.value || "").trim()
  };
}

function setCloudStatus(text) {
  els.cloudStatus.textContent = text;
}

function toggleCloudButtons(disabled) {
  els.saveCloudConfigBtn.disabled = disabled;
  els.sendMagicLinkBtn.disabled = disabled;
  els.loadCloudBtn.disabled = disabled;
  els.syncCloudBtn.disabled = disabled;
  els.logoutCloudBtn.disabled = disabled;
}

function updateCloudButtons() {
  const hasClient = !!state.cloud.client;
  const hasUser = !!state.cloud.user;
  els.sendMagicLinkBtn.disabled = !hasClient;
  els.loadCloudBtn.disabled = !(hasClient && hasUser);
  els.syncCloudBtn.disabled = !(hasClient && hasUser) || state.cloud.syncing;
  els.logoutCloudBtn.disabled = !(hasClient && hasUser);
}

async function initCloud(config) {
  if (state.cloud.unsubscribeAuth) {
    state.cloud.unsubscribeAuth();
    state.cloud.unsubscribeAuth = null;
  }

  const result = await createCloudClient(config);
  if (result.error || !result.client) {
    state.cloud.client = null;
    state.cloud.user = null;
    setCloudStatus(result.error || "未连接云端");
    updateCloudButtons();
    return;
  }

  state.cloud.client = result.client;
  state.cloud.unsubscribeAuth = onCloudAuthChange(result.client, async function (user) {
    state.cloud.user = user;
    if (user) {
      setCloudStatus("已登录：" + (user.email || user.id));
      await pullFromCloud({ overrideLocal: false });
    } else {
      setCloudStatus("已连接 Supabase，未登录");
    }
    updateCloudButtons();
  });

  const userResult = await getCloudUser(result.client);
  if (userResult.error) {
    setCloudStatus("云端已连接，登录状态检查失败");
  } else {
    state.cloud.user = userResult.user;
    if (userResult.user) {
      setCloudStatus("已登录：" + (userResult.user.email || userResult.user.id));
      await pullFromCloud({ overrideLocal: false });
    } else {
      setCloudStatus("已连接 Supabase，未登录");
    }
  }

  updateCloudButtons();
}

async function pullFromCloud(options) {
  const cloud = state.cloud;
  if (!cloud.client || !cloud.user) {
    setCloudStatus("请先登录云端账号");
    return;
  }

  toggleCloudButtons(true);
  const remote = await loadRemoteState(cloud.client, cloud.user.id);
  if (remote.error) {
    toggleCloudButtons(false);
    setCloudStatus("拉取失败：" + remote.error);
    updateCloudButtons();
    return;
  }

  if (!remote.data) {
    const pushed = await pushToCloud("bootstrap");
    toggleCloudButtons(false);
    if (!pushed) return;
    setCloudStatus("云端为空，已自动迁移本地数据");
    updateCloudButtons();
    void refreshMarketHistory();
    return;
  }

  if (options?.overrideLocal !== false) {
    applyRemoteState(remote.data);
    setCloudStatus("已从云端拉取并覆盖本地");
  } else {
    const localFingerprint = JSON.stringify({
      items: state.items,
      preferences: state.preferences,
      usPeaks: state.usPeaks,
      marketEvents: state.marketEvents
    });
    const remoteFingerprint = JSON.stringify({
      items: Array.isArray(remote.data.items) ? remote.data.items : [],
      preferences: remote.data.preferences && typeof remote.data.preferences === "object" ? remote.data.preferences : {},
      usPeaks: remote.data.us_peaks && typeof remote.data.us_peaks === "object" ? remote.data.us_peaks : {},
      marketEvents: Array.isArray(remote.data.market_events) ? remote.data.market_events : []
    });

    if (localFingerprint !== remoteFingerprint) {
      applyRemoteState(remote.data);
      setCloudStatus("检测到云端有更新，已同步到本地");
    } else {
      setCloudStatus("云端与本地已一致");
    }
  }

  toggleCloudButtons(false);
  updateCloudButtons();
  void refreshMarketHistory();
}

function applyRemoteState(remoteData) {
  state.items = Array.isArray(remoteData.items) ? remoteData.items : [];
  state.preferences = {
    ...state.preferences,
    ...(remoteData.preferences && typeof remoteData.preferences === "object" ? remoteData.preferences : {})
  };
  state.usPeaks = remoteData.us_peaks && typeof remoteData.us_peaks === "object" ? remoteData.us_peaks : {};
  state.marketEvents = Array.isArray(remoteData.market_events) ? remoteData.market_events : [];
  persist({ skipCloudSync: true });
  renderGroupFilter();
  syncControls();
  render();
}

async function pushToCloud(reason) {
  const cloud = state.cloud;
  if (!cloud.client || !cloud.user) {
    if (reason === "manual") setCloudStatus("请先登录云端账号");
    return false;
  }
  if (cloud.syncing) return false;

  cloud.syncing = true;
  updateCloudButtons();
  const result = await saveRemoteState(cloud.client, cloud.user.id, {
    items: state.items,
    preferences: state.preferences,
    usPeaks: state.usPeaks,
    marketEvents: state.marketEvents
  });
  cloud.syncing = false;
  updateCloudButtons();

  if (result.error) {
    if (reason === "manual") setCloudStatus("同步失败：" + result.error);
    return false;
  }

  if (reason === "manual") setCloudStatus("已同步到云端");
  return true;
}

function renderGroupFilter() {
  const groups = collectGroups(state.items);
  const options = ['<option value="all">全部分组</option>'].concat(groups.map(function (group) {
    return '<option value="' + escapeHtml(group) + '">' + escapeHtml(group) + '</option>';
  }));
  els.groupFilter.innerHTML = options.join("");

  if (state.preferences.selectedGroup !== "all" && !groups.includes(state.preferences.selectedGroup)) {
    state.preferences.selectedGroup = "all";
    persist();
  }
  syncControls();
}

function configureAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }

  const intervalSec = Number(state.preferences.autoRefreshSec) || 0;
  if (!intervalSec) return;

  state.autoRefreshTimer = window.setInterval(async function () {
    if (state.loading) return;
    await refreshQuotes({ trigger: "auto" });
  }, intervalSec * 1000);
}

async function refreshQuotes(options) {
  const merged = options && options.trigger ? options : { trigger: "manual" };
  return refreshQuotesInternal(merged);
}

async function refreshQuotesInternal(options) {
  if (state.loading) return;
  state.loading = true;
  let refreshed = false;
  els.refreshBtn.disabled = true;
  setStatus("neutral", options.trigger === "auto" ? "自动刷新中..." : "正在刷新...");
  try {
    const quoteSymbols = Array.from(new Set(NASDAQ_FOCUS_SYMBOLS.concat(state.items.map(function (item) {
      return item.symbol;
    }))));
    state.quotes = await fetchQuotes(quoteSymbols);
    syncPeaksWithQuotes();
    persist();
    refreshed = true;
    state.lastSuccessAt = new Date();
    updateLastUpdated(state.lastSuccessAt);
    setStatus("positive", options.trigger === "auto" ? "自动刷新成功" : "刷新成功");
  } catch (error) {
    console.error(error);
    setStatus("negative", error && error.message ? error.message : "刷新行情失败，请稍后重试。");
  } finally {
    state.loading = false;
    els.refreshBtn.disabled = false;
    render();
    if (refreshed) {
      void refreshDailyMarketEvents({ force: options.trigger !== "auto" });
    }
  }
}

async function refreshDailyMarketEvents(options) {
  if (state.marketEventsLoading) return;

  const now = Date.now();
  if (!options?.force && now - state.marketEventsFetchedAt < 10 * 60 * 1000) return;

  state.marketEventsLoading = true;
  state.marketEventsError = "";
  renderMarketEvents();

  try {
    const benchmarkChange = state.quotes[NASDAQ_BENCHMARK_SYMBOL]?.changePercent;
    const response = await fetch(buildDailyMarketEventsUrl([], benchmarkChange));
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload?.error || "当日行情线索抓取失败");

    const incoming = Array.isArray(payload?.events) ? payload.events : [];
    state.marketEvents = applyLiveMarketFallbacks(mergeMarketEvents(state.marketEvents, incoming));
    state.marketEventsFetchedAt = Date.now();
    persist();
    void syncMarketEventsToHistory(incoming);
  } catch (error) {
    state.marketEventsError = error?.message || "当日行情线索抓取失败";
  } finally {
    state.marketEventsLoading = false;
    renderMarketEvents();
  }
}

async function syncMarketEventsToHistory(events) {
  const cloud = state.cloud;
  if (!cloud.client || !cloud.user || !Array.isArray(events) || !events.length) return;
  const result = await saveMarketEventHistory(cloud.client, cloud.user.id, events);
  if (result.error) return;
  void refreshMarketHistory({ silent: true });
}

async function refreshMarketHistory(options) {
  if (!els.marketHistoryBody || !els.marketHistoryHint) return;
  const cloud = state.cloud;
  if (!cloud.client || !cloud.user) {
    state.marketHistory = [];
    state.marketHistoryError = "";
    renderMarketHistory();
    return;
  }
  if (state.marketHistoryLoading) return;

  state.marketHistoryLoading = true;
  if (!options?.silent) renderMarketHistory();
  const result = await loadMarketEventHistory(cloud.client, cloud.user.id, state.marketHistoryRange);
  state.marketHistoryLoading = false;
  if (result.error) {
    state.marketHistoryError = result.error;
  } else {
    state.marketHistory = result.data;
    state.marketHistoryError = "";
  }
  renderMarketHistory();
}

function mergeMarketEvents(existing, incoming) {
  const merged = new Map();
  (existing || []).concat(incoming || []).forEach(function (entry) {
    const key = String(entry?.date || "") + ":" + String(entry?.symbol || "").toUpperCase();
    if (!key || key === ":") return;
    const current = merged.get(key);
    if (!current || new Date(entry?.capturedAt || 0).getTime() >= new Date(current?.capturedAt || 0).getTime()) {
      merged.set(key, entry);
    }
  });
  return Array.from(merged.values()).sort(function (left, right) {
    return new Date(right.capturedAt || 0).getTime() - new Date(left.capturedAt || 0).getTime();
  });
}

function applyLiveMarketFallbacks(events) {
  const latestDate = (events || []).reduce(function (current, entry) {
    return !current || String(entry?.date || "") > current ? String(entry.date) : current;
  }, "");
  const benchmarkChange = Number(state.quotes[NASDAQ_BENCHMARK_SYMBOL]?.changePercent);
  if (!latestDate || !Number.isFinite(benchmarkChange)) return events;

  return (events || []).map(function (entry) {
    if (entry?.date !== latestDate || typeof entry?.benchmarkChangePercent === "number") return entry;
    const change = Number(entry?.changePercent);
    const benchmarkReason = "QQQ 当日 " + formatSigned(benchmarkChange) + "%；该股 " + (Number.isFinite(change) ? formatSigned(change) + "%" : "涨跌幅暂不可用") + "。";
    const reasons = Array.isArray(entry?.reasons) ? entry.reasons.slice() : [];
    const missingIndex = reasons.findIndex(function (reason) { return /QQQ 基准数据暂不可用/.test(reason); });
    if (missingIndex >= 0) reasons[missingIndex] = benchmarkReason;
    else reasons.unshift(benchmarkReason);
    return {
      ...entry,
      benchmarkChangePercent: Number(benchmarkChange.toFixed(2)),
      reasons
    };
  });
}

async function openAnalysis(symbol) {
  const normalized = String(symbol || "").trim().toUpperCase();
  let detailUrl = "";
  if (isAShareSymbol(normalized)) {
    detailUrl = buildAShareDetailUrl(normalized);
  } else if (isGlobalStockSymbol(normalized)) {
    detailUrl = buildGlobalDetailUrl(normalized);
  } else {
    setStatus("neutral", "当前分析入口先支持 A 股和美股代码。");
    return;
  }

  state.detail.symbol = normalized;
  state.detail.loading = true;
  state.detail.error = "";
  state.detail.data = null;
  render();

  try {
    const response = await fetch(detailUrl, {
      headers: { Accept: "application/json" }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data && data.error ? data.error : "加载分析失败");
    }
    state.detail.data = data.detail || null;
  } catch (error) {
    state.detail.error = error && error.message ? error.message : "加载分析失败";
  } finally {
    state.detail.loading = false;
    render();
  }
}

function closeAnalysis() {
  state.detail.symbol = null;
  state.detail.loading = false;
  state.detail.error = "";
  state.detail.data = null;
  render();
}

function updateLastUpdated(now) {
  els.lastUpdated.textContent = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0") + ":" + now.getSeconds().toString().padStart(2, "0");
}

function render() {
  const rows = getVisibleItems();
  const pagination = getPagination(rows.length, state.preferences.pageSize, state.preferences.currentPage);
  state.preferences.currentPage = pagination.currentPage;
  const pageRows = rows.slice(pagination.startIndex, pagination.endIndex);
  const strategySignals = buildStrategySignals(rows);

  renderStats(rows);
  renderActionQueue();
  renderMarketEvents();
  renderMarketHistory();
  renderOverview();
  els.stockTableBody.innerHTML = "";
  els.mobileList.innerHTML = "";
  els.emptyState.classList.toggle("hidden", rows.length > 0);
  els.mobileList.classList.toggle("hidden", rows.length === 0);
  els.pagination.classList.toggle("hidden", rows.length === 0);

  for (const item of pageRows) {
    const quote = state.quotes[item.symbol] || null;
    const fragment = els.rowTemplate.content.cloneNode(true);
    const row = fragment.querySelector("tr");
    const symbolNode = row.querySelector(".stock-symbol");
    const nameNode = row.querySelector(".stock-name");
    const metaNode = row.querySelector(".stock-meta");
    symbolNode.textContent = item.symbol;
    nameNode.textContent = quote && quote.name ? quote.name : item.displayName;
    metaNode.innerHTML = renderHoldingMeta(item, quote);
    row.querySelector(".remove-btn").setAttribute("data-symbol", item.symbol);
    row.querySelector(".analyze-btn").setAttribute("data-analyze-symbol", item.symbol);

    const priceCell = row.querySelector(".price-cell");
    const percentCell = row.querySelector(".percent-cell");
    const relativeCell = row.querySelector(".relative-cell");
    const drawdownCell = row.querySelector(".drawdown-cell");
    const adviceCell = row.querySelector(".advice-cell");

    fillQuoteCells({
      priceCell,
      percentCell,
      sparklineTarget: row.querySelector(".sparkline")
    }, quote);
    fillRelativeCell(relativeCell, item, quote);
    fillDrawdownCell(drawdownCell, item, quote);
    fillAdviceCell(adviceCell, item, quote);

    els.stockTableBody.appendChild(fragment);
    els.mobileList.appendChild(createMobileCard(item, quote));
  }

  updatePagination(pagination, rows.length);
  renderListHint(rows.length);
  renderStrategyPanel(strategySignals);
  renderDetailOverlay();
  checkTargetNotifications();
  checkDropAlerts();
}

function fillQuoteCells(cells, quote) {
  if (!quote || quote.price === null || quote.change === null || quote.changePercent === null) {
    if (cells.priceCell) cells.priceCell.textContent = "--";
    if (cells.changeCell) cells.changeCell.textContent = "--";
    if (cells.percentCell) cells.percentCell.textContent = "--";
    if (cells.prevOpenCell) cells.prevOpenCell.textContent = "--";
    if (cells.rangeCell) cells.rangeCell.textContent = "--";
    renderSparkline(cells.sparklineTarget, quote ? quote.sparkline : [], 0);
    return;
  }

  if (cells.priceCell) cells.priceCell.textContent = formatNumber(quote.price);
  if (cells.changeCell) {
    cells.changeCell.textContent = formatSigned(quote.change);
    applyTone(cells.changeCell, quote.change);
  }
  if (cells.percentCell) {
    cells.percentCell.textContent = formatSigned(quote.changePercent) + "%";
    applyTone(cells.percentCell, quote.changePercent);
  }
  if (cells.prevOpenCell) cells.prevOpenCell.textContent = formatPair(quote.previousClose, quote.open);
  if (cells.rangeCell) cells.rangeCell.textContent = formatRange(quote.low, quote.high);
  renderSparkline(cells.sparklineTarget, quote.sparkline, quote.changePercent);
}

function renderOverview() {
  renderMarketPulse();
  renderMag7Snapshot();
  renderRelativeLeaders();
  renderPortfolioSnapshot();
  renderDecisionWorkspace();
}

function renderMarketPulse() {
  if (!els.marketPulseBody) return;
  const qqqQuote = state.quotes[NASDAQ_BENCHMARK_SYMBOL] || null;
  const magsQuote = state.quotes[MAG7_ETF_SYMBOL] || null;
  const qqqDrawdown = getDrawdownPercent({ symbol: NASDAQ_BENCHMARK_SYMBOL }, qqqQuote);
  const magsExcess = getRelativeToBenchmark(MAG7_ETF_SYMBOL);

  els.marketPulseBody.innerHTML = [
    renderOverviewMetric(
      "QQQ",
      qqqQuote && qqqQuote.changePercent !== null ? formatSigned(qqqQuote.changePercent) + "%" : "--",
      qqqQuote && qqqQuote.price !== null ? "现价 " + formatNumber(qqqQuote.price) : "等待行情"
    ),
    renderOverviewMetric(
      "MAGS",
      magsQuote && magsQuote.changePercent !== null ? formatSigned(magsQuote.changePercent) + "%" : "--",
      magsQuote && magsQuote.price !== null ? "现价 " + formatNumber(magsQuote.price) : "等待行情"
    ),
    renderOverviewMetric(
      "MAGS 相对 QQQ",
      magsExcess === null ? "--" : formatSigned(magsExcess) + "%",
      magsExcess === null ? "等待基准行情" : magsExcess >= 0 ? "七巨头篮子跑赢纳指" : "七巨头篮子跑输纳指"
    ),
    renderOverviewMetric(
      "QQQ 本地回撤",
      qqqDrawdown === null ? "--" : formatUnsignedPercent(qqqDrawdown),
      qqqDrawdown === null ? "等待峰值数据" : "基于本地跟踪峰值"
    ),
    '<div class="overview-trends">',
    renderTrendCard("QQQ 日内走势", NASDAQ_BENCHMARK_SYMBOL, qqqQuote),
    renderTrendCard("MAGS 日内走势", MAG7_ETF_SYMBOL, magsQuote),
    "</div>"
  ].join("");

  renderOverviewTrendChart(els.marketPulseBody, NASDAQ_BENCHMARK_SYMBOL);
  renderOverviewTrendChart(els.marketPulseBody, MAG7_ETF_SYMBOL);
}

function renderMag7Snapshot() {
  if (!els.mag7SnapshotBody) return;
  const members = getMag7Members();
  const validMembers = members.filter(function (entry) {
    return entry.quote && typeof entry.quote.changePercent === "number";
  });

  if (!validMembers.length) {
    els.mag7SnapshotBody.innerHTML = '<p class="muted">等待核心成分行情后生成总览。</p>';
    return;
  }

  const avgChange = validMembers.reduce(function (sum, entry) {
    return sum + Number(entry.quote.changePercent || 0);
  }, 0) / validMembers.length;
  const upCount = validMembers.filter(function (entry) {
    return Number(entry.quote.changePercent) > 0;
  }).length;
  const downCount = validMembers.filter(function (entry) {
    return Number(entry.quote.changePercent) < 0;
  }).length;
  const qqqChange = getBenchmarkChangePercent();
  const outperformCount = validMembers.filter(function (entry) {
    const relative = getRelativeToBenchmark(entry.item.symbol);
    return relative !== null && relative > 0;
  }).length;
  const leader = validMembers.slice().sort(function (left, right) {
    return Number(right.quote.changePercent || 0) - Number(left.quote.changePercent || 0);
  })[0];
  const laggard = validMembers.slice().sort(function (left, right) {
    return Number(left.quote.changePercent || 0) - Number(right.quote.changePercent || 0);
  })[0];

  els.mag7SnapshotBody.innerHTML = [
    renderOverviewMetric("核心成分均值", formatSigned(avgChange) + "%", qqqChange === null ? "等待 QQQ 基准" : "相对 QQQ " + formatSigned(avgChange - qqqChange) + "%"),
    renderOverviewMetric("上涨 / 下跌", upCount + " / " + downCount, "广度越高，板块越整齐"),
    renderOverviewMetric("跑赢 QQQ", String(outperformCount) + " / " + String(validMembers.length), "衡量内部强弱扩散"),
    renderOverviewMetric("最强 / 最弱", (leader ? leader.item.symbol : "--") + " / " + (laggard ? laggard.item.symbol : "--"), "快速定位领涨与拖累"),
    '<div class="strength-bars">',
    validMembers
      .slice()
      .sort(function (left, right) {
        return Number(right.quote.changePercent || 0) - Number(left.quote.changePercent || 0);
      })
      .map(function (entry) {
        return renderStrengthRow(entry.item.symbol, entry.quote.changePercent, "当日涨跌");
      })
      .join(""),
    "</div>"
  ].join("");
}

function renderRelativeLeaders() {
  if (!els.leadersBody) return;
  const ranked = getMag7RelativeRanking();
  if (!ranked.length) {
    els.leadersBody.innerHTML = '<p class="muted">等待 QQQ 与七巨头行情后生成强弱排序。</p>';
    return;
  }

  const top = ranked.slice(0, 3);
  const bottom = ranked.slice(-3).reverse();
  els.leadersBody.innerHTML = [
    '<div class="focus-list">',
    '<div><p class="muted focus-title">领跑</p>' + top.map(renderRelativeFocusItem).join("") + "</div>",
    '<div><p class="muted focus-title">掉队</p>' + bottom.map(renderRelativeFocusItem).join("") + "</div>",
    "</div>",
    '<div class="strength-bars relative-bars">',
    ranked.map(function (entry) {
      return renderStrengthRow(entry.symbol, entry.relative, "相对 QQQ");
    }).join(""),
    "</div>"
  ].join("");
}

function renderRelativeFocusItem(entry) {
  const relative = Number(entry.relative || 0);
  const tone = relative > 0 ? "positive" : relative < 0 ? "negative" : "neutral";
  return [
    '<article class="focus-item">',
    '<strong>' + escapeHtml(entry.symbol) + '</strong>',
    '<span class="' + tone + '">' + formatSigned(relative) + '%</span>',
    '<span class="muted">当日 ' + formatSigned(entry.changePercent) + "%</span>",
    "</article>"
  ].join("");
}

function renderOverviewMetric(label, value, note) {
  return [
    '<article class="overview-metric">',
    '<span class="muted">' + escapeHtml(label) + "</span>",
    '<strong>' + escapeHtml(value) + "</strong>",
    '<span class="muted">' + escapeHtml(note) + "</span>",
    "</article>"
  ].join("");
}

function renderTrendCard(label, symbol, quote) {
  const latestText = quote && quote.price !== null ? "现价 " + formatNumber(quote.price) : "等待行情";
  const changeText = quote && quote.changePercent !== null ? formatSigned(quote.changePercent) + "%" : "--";
  const tone = quote && typeof quote.changePercent === "number" && quote.changePercent !== 0
    ? quote.changePercent > 0 ? "positive" : "negative"
    : "neutral";

  return [
    '<article class="trend-card">',
    '<div class="trend-card-head">',
    '<div><strong>' + escapeHtml(label) + '</strong><p class="muted">' + escapeHtml(latestText) + "</p></div>",
    '<span class="' + tone + '">' + escapeHtml(changeText) + "</span>",
    "</div>",
    '<div class="overview-trend-chart" data-trend-symbol="' + escapeHtml(symbol) + '"></div>',
    "</article>"
  ].join("");
}

function renderOverviewTrendChart(scope, symbol) {
  if (!scope) return;
  const target = scope.querySelector('[data-trend-symbol="' + String(symbol || "").trim().toUpperCase() + '"]');
  if (!target) return;
  const quote = state.quotes[String(symbol || "").trim().toUpperCase()];
  renderTrendChart(target, quote && Array.isArray(quote.sparkline) ? quote.sparkline : [], quote && typeof quote.changePercent === "number" ? quote.changePercent : 0);
}

function renderStrengthRow(label, value, metaLabel) {
  const amount = Number(value);
  const safeValue = Number.isFinite(amount) ? amount : 0;
  const width = Math.min(100, Math.max(8, Math.abs(safeValue) * 6));
  const tone = safeValue > 0 ? "positive" : safeValue < 0 ? "negative" : "neutral";

  return [
    '<article class="strength-row">',
    '<div class="strength-copy"><strong>' + escapeHtml(label) + '</strong><span class="muted">' + escapeHtml(metaLabel) + '</span></div>',
    '<div class="strength-track"><span class="strength-fill ' + tone + '" style="width:' + width + '%"></span></div>',
    '<span class="strength-value ' + tone + '">' + (Number.isFinite(amount) ? escapeHtml(formatSigned(amount) + "%") : "--") + "</span>",
    "</article>"
  ].join("");
}

function renderPortfolioSnapshot() {
  if (!els.portfolioSnapshotBody) return;
  const positions = state.items.map(function (item) {
    return {
      item,
      quote: state.quotes[item.symbol] || null,
      position: getPositionInfo(item, state.quotes[item.symbol] || null)
    };
  }).filter(function (entry) {
    return entry.position !== null;
  });

  if (!positions.length) {
    els.portfolioSnapshotBody.innerHTML = [
      '<p class="muted">还没有填写持仓成本和股数。先给核心持仓补上成本价与股数，后续 AI 才能真正给出你的仓位建议。</p>'
    ].join("");
    return;
  }

  const marketValue = positions.reduce(function (sum, entry) {
    return sum + Number(entry.position.marketValue || 0);
  }, 0);
  const costValue = positions.reduce(function (sum, entry) {
    return sum + Number(entry.position.costValue || 0);
  }, 0);
  const pnl = marketValue - costValue;
  const pnlPct = costValue > 0 ? (pnl / costValue) * 100 : null;
  const coreCount = positions.filter(function (entry) {
    return entry.item.holdingType === "core";
  }).length;
  const tradingCount = positions.filter(function (entry) {
    return entry.item.holdingType === "trading";
  }).length;

  els.portfolioSnapshotBody.innerHTML = [
    '<div class="workspace-metrics">',
    renderWorkspaceMetric("持仓市值", formatMoney(marketValue), "按当前行情估算"),
    renderWorkspaceMetric("持仓盈亏", formatMoneySigned(pnl), pnlPct === null ? "等待成本数据" : formatSigned(pnlPct) + "%"),
    renderWorkspaceMetric("核心仓数量", String(coreCount), "适合长期跟踪"),
    renderWorkspaceMetric("交易仓数量", String(tradingCount), "适合节奏管理"),
    "</div>",
    '<div class="workspace-position-list">',
    positions
      .slice()
      .sort(function (left, right) {
        return Number(right.position.marketValue || 0) - Number(left.position.marketValue || 0);
      })
      .slice(0, 5)
      .map(function (entry) {
        return renderPositionRow(entry.item, entry.position);
      })
      .join(""),
    "</div>"
  ].join("");
}

function renderDecisionWorkspace() {
  if (!els.decisionWorkspaceBody) return;
  const entries = state.items.map(function (item) {
    const quote = state.quotes[item.symbol] || null;
    return {
      item,
      quote,
      position: getPositionInfo(item, quote),
      relativeQqq: getRelativeToBenchmark(item.symbol),
      targetInfo: getTargetInfo(item, quote),
      strategySignal: getStrategySignal(item, quote)
    };
  });

  const notes = [];
  const candidateTrim = entries
    .filter(function (entry) {
      return entry.position && entry.position.pnlPercent !== null;
    })
    .slice()
    .sort(function (left, right) {
      return Number(right.position.pnlPercent || 0) - Number(left.position.pnlPercent || 0);
    })[0];
  if (candidateTrim && candidateTrim.position.pnlPercent > 15) {
    notes.push({
      tone: "positive",
      title: "优先复盘止盈",
      text: candidateTrim.item.symbol + " 当前浮盈 " + formatSigned(candidateTrim.position.pnlPercent) + "%，适合先对照你的分批止盈纪律。"
    });
  }

  const riskEntry = entries
    .filter(function (entry) {
      return entry.strategySignal && entry.position;
    })
    .slice()
    .sort(function (left, right) {
      return Number(getDrawdownPercent(left.item, left.quote) || 0) - Number(getDrawdownPercent(right.item, right.quote) || 0);
    })[0];
  if (riskEntry) {
    notes.push({
      tone: "negative",
      title: "回撤纪律触发",
      text: riskEntry.item.symbol + " 已触发回撤规则，建议先判断是减仓执行，还是基本面仍支持继续持有。"
    });
  }

  const strongEntry = entries
    .filter(function (entry) {
      return entry.relativeQqq !== null;
    })
    .slice()
    .sort(function (left, right) {
      return Number(right.relativeQqq || 0) - Number(left.relativeQqq || 0);
    })[0];
  if (strongEntry) {
    notes.push({
      tone: strongEntry.relativeQqq > 0 ? "positive" : "neutral",
      title: "相对强弱焦点",
      text: strongEntry.item.symbol + " 当前相对 QQQ " + formatSigned(strongEntry.relativeQqq) + "%，是今天最值得先看的强弱代表。"
    });
  }

  const targetEntry = entries
    .filter(function (entry) {
      return entry.targetInfo && !entry.targetInfo.hit;
    })
    .slice()
    .sort(function (left, right) {
      return Math.abs(Number(left.targetInfo.distancePercent || 0)) - Math.abs(Number(right.targetInfo.distancePercent || 0));
    })[0];
  if (targetEntry) {
    notes.push({
      tone: "neutral",
      title: "临近目标价",
      text: targetEntry.item.symbol + " 距目标价仅 " + formatUnsignedPercent(Math.abs(targetEntry.targetInfo.distancePercent)) + "，可提前想好到价后的动作。"
    });
  }

  if (!notes.length) {
    els.decisionWorkspaceBody.innerHTML = '<p class="muted">先补持仓成本、股数、目标价后，这里会自动给你生成更贴近你仓位的决策摘要。</p>';
    return;
  }

  els.decisionWorkspaceBody.innerHTML = [
    '<div class="workspace-notes">',
    notes.slice(0, 4).map(renderDecisionNote).join(""),
    "</div>"
  ].join("");
}

function renderWorkspaceMetric(label, value, note) {
  return [
    '<article class="workspace-metric">',
    '<span class="muted">' + escapeHtml(label) + "</span>",
    '<strong>' + escapeHtml(value) + "</strong>",
    '<span class="muted">' + escapeHtml(note) + "</span>",
    "</article>"
  ].join("");
}

function renderPositionRow(item, position) {
  return [
    '<article class="position-row">',
    '<div><strong>' + escapeHtml(item.symbol) + '</strong><span class="muted"> ' + escapeHtml(describeHoldingType(item.holdingType)) + "</span></div>",
    '<div class="position-grid">',
    '<span class="muted">股数 ' + escapeHtml(formatShareCount(item.shares)) + "</span>",
    '<span class="muted">成本 ' + escapeHtml(formatMoney(item.costBasis)) + "</span>",
    '<span class="' + (position.pnl >= 0 ? "positive" : "negative") + '">浮盈 ' + escapeHtml(formatMoneySigned(position.pnl)) + " (" + formatSigned(position.pnlPercent) + '%)</span>',
    "</div>",
    "</article>"
  ].join("");
}

function renderDecisionNote(note) {
  const tone = note?.tone === "positive" || note?.tone === "negative" ? note.tone : "neutral";
  return [
    '<article class="decision-note ' + tone + '">',
    '<strong>' + escapeHtml(note?.title || "--") + "</strong>",
    '<p class="muted">' + escapeHtml(note?.text || "--") + "</p>",
    "</article>"
  ].join("");
}

function renderHoldingMeta(item, quote) {
  const position = getPositionInfo(item, quote);
  const segments = [
    '<span class="holding-pill ' + escapeHtml(item.holdingType || "watchlist") + '">' + escapeHtml(describeHoldingType(item.holdingType)) + "</span>"
  ];

  if (Number.isFinite(Number(item?.costBasis))) {
    segments.push('<span class="holding-meta-text">成本 ' + escapeHtml(formatMoney(item.costBasis)) + "</span>");
  }

  if (Number.isFinite(Number(item?.shares))) {
    segments.push('<span class="holding-meta-text">股数 ' + escapeHtml(formatShareCount(item.shares)) + "</span>");
  }

  if (position && position.pnlPercent !== null) {
    segments.push(
      '<span class="holding-meta-text ' + (position.pnl >= 0 ? "positive" : "negative") + '">浮盈 ' +
      escapeHtml(formatMoneySigned(position.pnl)) +
      " (" +
      escapeHtml(formatSigned(position.pnlPercent)) +
      "%)</span>"
    );
  }

  return segments.join("");
}

function getPositionInfo(item, quote) {
  const costBasis = Number(item?.costBasis);
  const shares = Number(item?.shares);
  const price = Number(quote?.price);
  if (!Number.isFinite(costBasis) || costBasis <= 0 || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  const costValue = costBasis * shares;
  const marketValue = price * shares;
  const pnl = marketValue - costValue;
  const pnlPercent = costValue > 0 ? (pnl / costValue) * 100 : null;
  return {
    costValue: Number(costValue.toFixed(2)),
    marketValue: Number(marketValue.toFixed(2)),
    pnl: Number(pnl.toFixed(2)),
    pnlPercent: pnlPercent === null ? null : Number(pnlPercent.toFixed(2))
  };
}

function describeHoldingType(type) {
  if (type === "core") return "核心仓";
  if (type === "trading") return "交易仓";
  return "观察仓";
}

function formatShareCount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "--";
  return amount >= 100 ? amount.toFixed(0) : amount.toFixed(2);
}

function getBenchmarkChangePercent() {
  const quote = state.quotes[NASDAQ_BENCHMARK_SYMBOL];
  return quote && typeof quote.changePercent === "number" ? quote.changePercent : null;
}

function getRelativeToBenchmark(symbol) {
  const benchmark = getBenchmarkChangePercent();
  const quote = state.quotes[String(symbol || "").trim().toUpperCase()];
  const current = quote && typeof quote.changePercent === "number" ? quote.changePercent : null;
  if (benchmark === null || current === null) return null;
  return Number((current - benchmark).toFixed(2));
}

function getMag7Members() {
  return NASDAQ_CORE_SYMBOLS.map(function (symbol) {
    const quote = state.quotes[symbol] || null;
    return {
      item: {
        symbol,
        displayName: quote?.name || symbol
      },
      quote
    };
  });
}

function getMag7RelativeRanking() {
  return getMag7Members().map(function (entry) {
    const changePercent = entry.quote && typeof entry.quote.changePercent === "number" ? entry.quote.changePercent : null;
    const relative = getRelativeToBenchmark(entry.item.symbol);
    return {
      symbol: entry.item.symbol,
      displayName: entry.item.displayName,
      changePercent,
      relative
    };
  }).filter(function (entry) {
    return entry.relative !== null && entry.changePercent !== null;
  }).sort(function (left, right) {
    return Number(right.relative) - Number(left.relative);
  });
}

function fillDrawdownCell(cell, item, quote) {
  const drawdown = getDrawdownPercent(item, quote);
  cell.classList.remove("positive", "negative", "neutral");

  if (drawdown === null) {
    cell.textContent = "--";
    cell.classList.add("neutral");
    cell.title = "等待更多价格数据后开始计算";
    return;
  }

  cell.textContent = formatUnsignedPercent(drawdown);
  cell.classList.add(drawdown === 0 ? "neutral" : "negative");
  const peak = state.usPeaks[item.symbol];
  cell.title = peak ? "跟踪峰值 " + formatNumber(peak.peakPrice) : "";
}

function fillRelativeCell(cell, item, quote) {
  if (!cell) return;
  const relative = getRelativeToBenchmark(item.symbol);
  cell.classList.remove("positive", "negative", "neutral");

  if (relative === null) {
    cell.textContent = "--";
    cell.classList.add("neutral");
    cell.title = "等待 QQQ 与个股行情后计算";
    return;
  }

  cell.textContent = formatSigned(relative) + "%";
  cell.classList.add(relative > 0 ? "positive" : relative < 0 ? "negative" : "neutral");
  cell.title = "当日涨跌相对 QQQ：" + formatSigned(relative) + "%";
}

function fillAdviceCell(cell, item, quote) {
  const signal = getStrategySignal(item, quote);
  cell.classList.remove("positive", "negative", "neutral");

  if (!signal) {
    cell.textContent = "观察";
    cell.classList.add("neutral");
    return;
  }

  cell.textContent = "回撤≥" + signal.drawdown + "% 卖出 " + signal.sellPercent + "%";
  cell.classList.add("negative");
}

function getTargetInfo(item, quote) {
  const target = Number(item?.targetPrice);
  const price = Number(quote?.price);
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  const ref = Number(quote?.previousClose);
  const baseline = Number.isFinite(ref) && ref > 0 ? ref : price;
  const direction = target >= baseline ? "up" : "down";
  const hit = direction === "up" ? price >= target : price <= target;
  const distancePercent = Number((((target - price) / price) * 100).toFixed(2));
  return { target, price, direction, hit, distancePercent };
}

function fillTargetCell(row, cell, item, quote) {
  if (!cell) return;
  const input = cell.querySelector(".target-input");
  const distanceNode = cell.querySelector(".target-distance");

  input.setAttribute("data-symbol", item.symbol);
  input.value = item.targetPrice === null || item.targetPrice === undefined ? "" : String(item.targetPrice);

  distanceNode.classList.remove("positive", "negative", "neutral");
  if (row) row.classList.remove("target-hit");

  const info = getTargetInfo(item, quote);
  if (!info) {
    distanceNode.textContent = item.targetPrice ? "等待行情" : "";
    distanceNode.classList.add("neutral");
    return;
  }

  if (info.hit) {
    distanceNode.textContent = info.direction === "up" ? "✓ 已突破" : "✓ 已跌破";
    distanceNode.classList.add(info.direction === "up" ? "positive" : "negative");
    if (row) row.classList.add("target-hit");
    return;
  }

  distanceNode.textContent = "距 " + formatSigned(info.distancePercent) + "%";
  distanceNode.classList.add("neutral");
}

function checkTargetNotifications() {
  const canNotify = state.preferences.notifyOnTarget
    && typeof Notification !== "undefined"
    && Notification.permission === "granted";

  for (const item of state.items) {
    const quote = state.quotes[item.symbol];
    const info = getTargetInfo(item, quote);

    if (!info || !info.hit) {
      state.targetHits.delete(item.symbol);
      continue;
    }

    if (state.targetHits.has(item.symbol)) continue;
    state.targetHits.add(item.symbol);

    if (canNotify) {
      const name = quote && quote.name ? quote.name : item.displayName;
      new Notification("到价提醒 · " + item.symbol, {
        body: name + " 现价 " + formatNumber(info.price) + "，已" + (info.direction === "up" ? "突破" : "跌破") + "目标 " + formatNumber(info.target)
      });
    }
  }
}

function createMobileCard(item, quote) {
  const card = document.createElement("article");
  card.className = "mobile-card";

  const toneClass = !quote || quote.changePercent === null ? "neutral" : quote.changePercent > 0 ? "positive" : quote.changePercent < 0 ? "negative" : "neutral";
  const percentText = quote && quote.changePercent !== null ? formatSigned(quote.changePercent) + "%" : "--";
  const changeText = quote && quote.change !== null ? formatSigned(quote.change) : "--";
  const priceText = quote && quote.price !== null ? formatNumber(quote.price) : "--";
  const displayName = quote && quote.name ? quote.name : item.displayName;
  const drawdown = getDrawdownPercent(item, quote);
  const drawdownText = drawdown === null ? "--" : formatUnsignedPercent(drawdown);
  const drawdownTone = drawdown === null || drawdown === 0 ? "neutral" : "negative";
  const strategySignal = getStrategySignal(item, quote);
  const strategyText = strategySignal
    ? "建议：回撤≥" + strategySignal.drawdown + "%，卖出 " + strategySignal.sellPercent + "%"
    : "建议：继续观察";
  const strategyTone = strategySignal ? "negative" : "neutral";
  const targetInfo = getTargetInfo(item, quote);
  const holdingMeta = renderHoldingMeta(item, quote);
  const targetValue = item.targetPrice === null || item.targetPrice === undefined ? "" : String(item.targetPrice);
  let targetText;
  let targetTone;
  if (!targetInfo) {
    targetText = item.targetPrice ? "等待行情" : "未设置";
    targetTone = "neutral";
  } else if (targetInfo.hit) {
    targetText = targetInfo.direction === "up" ? "✓ 已突破" : "✓ 已跌破";
    targetTone = targetInfo.direction === "up" ? "positive" : "negative";
  } else {
    targetText = "距 " + formatSigned(targetInfo.distancePercent) + "%";
    targetTone = "neutral";
  }
  if (targetInfo && targetInfo.hit) {
    card.classList.add("target-hit");
  }

  card.innerHTML = [
    '<div class="mobile-card-top">',
    '<div class="stock-cell"><strong class="stock-symbol">' + escapeHtml(item.symbol) + '</strong><span class="stock-name">' + escapeHtml(displayName) + '</span></div>',
    '<div class="mobile-side-tags"><span class="market-badge">' + escapeHtml(quote && quote.market ? quote.market : "--") + '</span><span class="group-badge">' + escapeHtml(item.group) + '</span></div>',
    '</div>',
    '<div class="mobile-position">' + holdingMeta + '</div>',
    '<div class="mobile-metrics">',
    '<div><span class="muted">最新价</span><strong>' + priceText + '</strong></div>',
    '<div><span class="muted">涨跌额</span><strong class="' + toneClass + '">' + changeText + '</strong></div>',
    '<div><span class="muted">涨跌幅</span><strong class="' + toneClass + '">' + percentText + '</strong></div>',
    '<div><span class="muted">昨收 / 今开</span><strong>' + formatPair(quote && quote.previousClose, quote && quote.open) + '</strong></div>',
    '<div><span class="muted">日内区间</span><strong>' + formatRange(quote && quote.low, quote && quote.high) + '</strong></div>',
    '<div><span class="muted">更新时间</span><strong>' + formatQuoteTime(quote && quote.updatedAt) + '</strong></div>',
    '</div>',
    '<p class="mobile-drawdown"><span class="muted">较峰值回撤</span> <strong class="' + drawdownTone + '">' + drawdownText + '</strong></p>',
    '<p class="mobile-drawdown"><span class="muted">止盈建议</span> <strong class="' + strategyTone + '">' + strategyText + '</strong></p>',
    '<p class="mobile-drawdown mobile-target"><span class="muted">目标价</span> <input type="number" class="target-input" data-symbol="' + escapeHtml(item.symbol) + '" value="' + escapeHtml(targetValue) + '" step="0.01" min="0" inputmode="decimal" placeholder="设目标" /> <strong class="' + targetTone + '">' + targetText + '</strong></p>',
    '<div class="mobile-chart"></div>',
    '<p class="mobile-note">' + escapeHtml(item.note || "暂无备注") + '</p>',
    '<div class="mobile-actions"><button type="button" class="btn btn-ghost analyze-btn" data-analyze-symbol="' + escapeHtml(item.symbol) + '">分析</button><button type="button" class="btn btn-ghost remove-btn" data-symbol="' + escapeHtml(item.symbol) + '">删除</button></div>'
  ].join("");

  renderSparkline(card.querySelector(".mobile-chart"), quote && quote.sparkline ? quote.sparkline : [], quote && quote.changePercent !== null ? quote.changePercent : 0);
  return card;
}

function renderDetailOverlay() {
  const detail = state.detail;
  if (!els.detailOverlay) return;

  if (!detail.symbol) {
    els.detailOverlay.classList.add("hidden");
    els.detailOverlay.innerHTML = "";
    return;
  }

  els.detailOverlay.classList.remove("hidden");

  if (detail.loading) {
    els.detailOverlay.innerHTML = [
      '<div class="detail-backdrop" data-close-detail="true"></div>',
      '<section class="detail-modal">',
      '<div class="detail-head"><div><p class="eyebrow">Stock Detail</p><h2>加载中</h2></div><button type="button" class="btn btn-ghost" data-close-detail="true">关闭</button></div>',
      '<p class="muted">正在拉取股票详情、估值和近期资讯…</p>',
      "</section>"
    ].join("");
    return;
  }

  if (detail.error) {
    els.detailOverlay.innerHTML = [
      '<div class="detail-backdrop" data-close-detail="true"></div>',
      '<section class="detail-modal">',
      '<div class="detail-head"><div><p class="eyebrow">Stock Detail</p><h2>' + escapeHtml(detail.symbol) + '</h2></div><button type="button" class="btn btn-ghost" data-close-detail="true">关闭</button></div>',
      '<p class="negative">' + escapeHtml(detail.error) + '</p>',
      "</section>"
    ].join("");
    return;
  }

  const data = detail.data;
  if (!data) return;

  const reports = Array.isArray(data.reports) ? data.reports : [];
  const metrics = Array.isArray(data.metrics) ? data.metrics : [];
  const decision = data.decision && typeof data.decision === "object" ? data.decision : null;
  els.detailOverlay.innerHTML = [
    '<div class="detail-backdrop" data-close-detail="true"></div>',
    '<section class="detail-modal">',
    '<div class="detail-head">',
    '<div><p class="eyebrow">Stock Detail</p><h2>' + escapeHtml(data.name || data.symbol) + " · " + escapeHtml(data.symbol) + '</h2><p class="muted">' + escapeHtml(data.market || "") + " ｜ " + escapeHtml(data.summary || data.note || "") + '</p></div>',
    '<button type="button" class="btn btn-ghost" data-close-detail="true">关闭</button>',
    "</div>",
    decision ? renderDecisionSection(decision) : "",
    '<div class="detail-grid">',
    metrics.map(function (entry) {
      return renderDetailMetric(entry?.label || "--", entry?.value, entry?.suffix || "");
    }).join(""),
    "</div>",
    '<section class="detail-section"><h3>' + escapeHtml(data.itemsTitle || "近期资讯") + "</h3>",
    reports.length
      ? reports
          .map(function (report) {
            const linkHtml = report.url
              ? '<a href="' + escapeHtml(report.url) + '" target="_blank" rel="noreferrer">查看</a>'
              : '<span class="muted">无链接</span>';
            return [
              '<article class="report-item">',
              '<strong>' + escapeHtml(report.title) + "</strong>",
              '<div class="report-meta"><span>' + escapeHtml(report.institution || "未知机构") + '</span><span>' + escapeHtml(report.rating || "--") + '</span><span>' + escapeHtml(report.reportDate || "--") + "</span>" + linkHtml + "</div>",
              "</article>"
            ].join("");
          })
          .join("")
      : '<p class="muted">' + escapeHtml(data.itemsEmptyText || "暂无近期资讯。") + "</p>",
    "</section>",
    '<section class="detail-section"><h3>数据来源</h3><p class="muted">' + escapeHtml((data.sourceNames || []).join(" / ")) + "。 " + escapeHtml(data.note || "") + "</p></section>",
    "</section>"
  ].join("");
}

function renderDecisionSection(decision) {
  const score = Number.isFinite(Number(decision.score)) ? Number(decision.score) : null;
  const stance = decision.stance || "中性观察";
  const summary = decision.summary || "";
  const signals = Array.isArray(decision.signals) ? decision.signals : [];
  const caveats = Array.isArray(decision.caveats) ? decision.caveats : [];

  return [
    '<section class="detail-section decision-section">',
    '<div class="decision-hero">',
    '<div class="decision-score-wrap">',
    '<span class="muted">结构化观察分</span>',
    '<strong class="decision-score">' + (score === null ? "--" : String(score)) + "</strong>",
    "</div>",
    '<div class="decision-copy">',
    '<h3>' + escapeHtml(stance) + "</h3>",
    '<p class="muted">' + escapeHtml(summary) + "</p>",
    "</div>",
    "</div>",
    signals.length
      ? '<div class="decision-signals">' + signals.map(renderDecisionSignal).join("") + "</div>"
      : "",
    caveats.length
      ? '<div class="decision-caveats">' + caveats.map(function (entry) {
          return '<p class="muted">- ' + escapeHtml(entry) + "</p>";
        }).join("") + "</div>"
      : "",
    "</section>"
  ].join("");
}

function renderDecisionSignal(signal) {
  const tone = signal?.tone === "positive" || signal?.tone === "negative" ? signal.tone : "neutral";
  return [
    '<article class="decision-signal ' + tone + '">',
    '<span class="muted">' + escapeHtml(signal?.label || "--") + "</span>",
    '<strong>' + escapeHtml(signal?.text || "--") + "</strong>",
    "</article>"
  ].join("");
}

function renderDetailMetric(label, value, suffix) {
  const display = Number.isFinite(Number(value)) ? formatNumber(Number(value)) + suffix : "--";
  return '<article class="detail-metric"><span class="muted">' + label + "</span><strong>" + display + "</strong></article>";
}

function renderStats(rows) {
  let up = 0;
  let down = 0;
  let flat = 0;

  for (const item of rows) {
    const quote = state.quotes[item.symbol];
    if (!quote || quote.changePercent === null || quote.changePercent === 0) {
      flat += 1;
    } else if (quote.changePercent > 0) {
      up += 1;
    } else {
      down += 1;
    }
  }

  els.countStat.textContent = String(rows.length);
  els.upStat.textContent = String(up);
  els.downStat.textContent = String(down);
  els.flatStat.textContent = String(flat);
}

function renderActionQueue() {
  if (!els.actionQueueBody) return;
  const entries = buildActionQueue();

  if (!state.items.length) {
    els.actionQueueBody.innerHTML = [
      '<article class="action-queue-empty">',
      '<strong>先添加 QQQ、MAGS 或七巨头</strong>',
      '<p class="muted">添加后这里会按回撤、目标价、相对 QQQ 和当日跌幅整理今日信号。</p>',
      "</article>"
    ].join("");
    return;
  }

  if (!entries.length) {
    els.actionQueueBody.innerHTML = [
      '<article class="action-queue-empty">',
      '<strong>当前没有高优先级处理项</strong>',
      '<p class="muted">规则没有触发时，这里会保持安静。刷新行情后会重新计算。</p>',
      "</article>"
    ].join("");
    return;
  }

  els.actionQueueBody.innerHTML = entries.slice(0, 6).map(renderActionQueueCard).join("");
}

function renderMarketEvents() {
  if (!els.marketEventsBody || !els.marketEventsHint) return;

  if (state.marketEventsLoading) {
    els.marketEventsHint.textContent = "正在抓取当日行情与公开资讯，不会阻塞看板刷新。";
  } else if (state.marketEventsError) {
    els.marketEventsHint.textContent = "本次抓取失败，暂时展示最近一次已保存的事件。";
  } else {
    els.marketEventsHint.textContent = "自动记录显著行情与关联资讯；新闻是线索，不等于唯一因果。";
  }

  const latestDate = state.marketEvents.reduce(function (current, entry) {
    return !current || String(entry?.date || "") > current ? String(entry.date) : current;
  }, "");
  const events = state.marketEvents.filter(function (entry) {
    return entry?.date === latestDate && NASDAQ_FOCUS_SYMBOLS.includes(String(entry?.symbol || "").toUpperCase());
  }).sort(function (left, right) {
    return Math.abs(Number(right?.changePercent || 0)) - Math.abs(Number(left?.changePercent || 0));
  });

  renderMarketNewsFeed(events);

  if (!events.length) {
    els.marketEventsBody.innerHTML = [
      '<article class="market-event-empty">',
      '<strong>' + (state.marketEventsLoading ? "正在建立今日事件记录" : "还没有可展示的当日线索") + "</strong>",
      '<p class="muted">' + (state.marketEventsError
        ? escapeHtml(state.marketEventsError)
        : "刷新行情后会自动抓取 Nasdaq 核心成分、QQQ 对照和公开资讯。") + "</p>",
      "</article>"
    ].join("");
    return;
  }

  els.marketEventsBody.innerHTML = events.slice(0, 9).map(renderMarketEventCard).join("");
}

function renderMarketNewsFeed(events) {
  if (!els.marketNewsFeed) return;
  const deduped = new Map();
  (events || []).forEach(function (event) {
    (Array.isArray(event?.news) ? event.news : []).forEach(function (item) {
      const title = String(item?.title || "").trim();
      const url = String(item?.url || "").trim();
      if (!title || !url) return;
      const key = title.toLowerCase().replace(/\s+/g, " ");
      const current = deduped.get(key);
      const candidate = {
        symbol: String(event?.symbol || "NDX"),
        title,
        url,
        publisher: String(item?.publisher || "资讯来源"),
        publishedAt: String(item?.publishedAt || "")
      };
      if (!current || new Date(candidate.publishedAt).getTime() > new Date(current.publishedAt).getTime()) {
        deduped.set(key, candidate);
      }
    });
  });
  const news = Array.from(deduped.values()).sort(function (left, right) {
    return new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime();
  }).slice(0, 8);

  if (!news.length) {
    els.marketNewsFeed.innerHTML = '<div class="news-wire-empty"><strong>新闻雷达等待更新</strong><span>有可复核的新来源后会按发布时间展示。</span></div>';
    return;
  }

  els.marketNewsFeed.innerHTML = [
    '<div class="news-wire-head"><div><span class="eyebrow">LIVE NEWS WIRE</span><strong>Nasdaq 关联动态</strong></div><span class="muted">近 36 小时 · 去重后 ' + news.length + " 条</span></div>",
    '<div class="news-wire-grid">',
    news.map(function (item) {
      return [
        '<a class="news-wire-item" href="' + escapeHtml(item.url) + '" target="_blank" rel="noreferrer">',
        '<span class="news-wire-symbol">' + escapeHtml(item.symbol) + "</span>",
        '<strong>' + escapeHtml(item.title) + "</strong>",
        '<span class="news-wire-meta">' + escapeHtml(item.publisher) + " · " + escapeHtml(formatNewsTime(item.publishedAt)) + "</span>",
        "</a>"
      ].join("");
    }).join(""),
    "</div>"
  ].join("");
}

function formatNewsTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderMarketEventCard(event) {
  const typeLabels = {
    market: "市场同向",
    company: "个股线索",
    mixed: "市场 + 个股",
    unclear: "证据不足"
  };
  const type = typeLabels[event.driverType] || typeLabels.unclear;
  const change = Number(event.changePercent);
  const changeText = Number.isFinite(change) ? formatSigned(change) + "%" : "--";
  const tone = Number.isFinite(change) && change > 0 ? "positive" : Number.isFinite(change) && change < 0 ? "negative" : "neutral";
  const reasons = Array.isArray(event.reasons) ? event.reasons : [];
  const news = Array.isArray(event.news) ? event.news : [];

  return [
    '<article class="market-event-card ' + tone + '">',
    '<div class="market-event-head"><span class="market-event-type">' + escapeHtml(type) + '</span><strong>' + escapeHtml(event.symbol || "--") + "</strong></div>",
    '<div class="market-event-move ' + tone + '">' + escapeHtml(changeText) + "</div>",
    '<p class="market-event-name">' + escapeHtml(event.name || event.symbol || "--") + "</p>",
    '<p class="market-event-summary">' + escapeHtml(event.summary || "暂无明确的当日驱动证据。") + "</p>",
    reasons.length ? '<ul class="market-event-reasons">' + reasons.map(function (reason) {
      return "<li>" + escapeHtml(reason) + "</li>";
    }).join("") + "</ul>" : "",
    news.length ? '<div class="market-event-news">' + news.map(function (item) {
      const link = item.url
        ? '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noreferrer">原文</a>'
        : "";
      return '<p><span>' + escapeHtml(item.publisher || "资讯来源") + "</span>" + link + "</p>";
    }).join("") + "</div>" : "",
    "</article>"
  ].join("");
}

function renderMarketHistory() {
  if (!els.marketHistoryBody || !els.marketHistoryHint) return;
  document.querySelectorAll("[data-history-range]").forEach(function (button) {
    button.classList.toggle("is-active", Number(button.getAttribute("data-history-range")) === state.marketHistoryRange);
  });

  const historyEntries = getAvailableMarketHistory();
  const usingCloudHistory = Boolean(state.cloud.client && state.cloud.user && state.marketHistory.length);

  if (state.marketHistoryLoading && !historyEntries.length) {
    els.marketHistoryHint.textContent = "正在读取历史收盘快照…";
    els.marketHistoryBody.innerHTML = '<article class="market-history-empty"><strong>正在加载历史</strong><p class="muted">按交易日整理涨跌、QQQ 对照和新闻证据。</p></article>';
    return;
  }

  if (state.marketHistoryError && !historyEntries.length) {
    els.marketHistoryHint.textContent = "历史表尚未可用或本次加载失败。";
    els.marketHistoryBody.innerHTML = [
      '<article class="market-history-empty">',
      "<strong>暂时无法读取历史</strong>",
      '<p class="muted">' + escapeHtml(state.marketHistoryError) + "</p>",
      '<p class="muted">请先执行 `SUPABASE_SETUP.md` 里的 `market_event_history` 建表 SQL。</p>',
      "</article>"
    ].join("");
    return;
  }

  if (!historyEntries.length) {
    els.marketHistoryHint.textContent = "刷新后会先保留本机最近 14 天；云端历史将在后续持续补齐。";
    els.marketHistoryBody.innerHTML = '<article class="market-history-empty"><strong>还没有历史快照</strong><p class="muted">完成第一次 Nasdaq 新闻雷达刷新后，这里会开始形成日度脉络。</p></article>';
    return;
  }

  els.marketHistoryHint.textContent = usingCloudHistory
    ? "已加载最近 " + state.marketHistoryRange + " 天云端记录。展开交易日可查看涨跌线索与原文证据。"
    : "正在展示本机最近 14 天的 Nasdaq 雷达记录；无需登录即可使用。";
  const byDate = new Map();
  historyEntries.forEach(function (entry) {
    const date = String(entry?.market_date || "").slice(0, 10);
    if (!date) return;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(entry);
  });
  const groups = Array.from(byDate.entries()).sort(function (left, right) {
    return right[0].localeCompare(left[0]);
  });
  els.marketHistoryBody.innerHTML = groups.map(function (group, index) {
    return renderMarketHistoryDay(group[0], group[1], index === 0);
  }).join("");
}

function getAvailableMarketHistory() {
  if (state.cloud.client && state.cloud.user && state.marketHistory.length) return state.marketHistory;
  return state.marketEvents.filter(function (entry) {
    return NASDAQ_FOCUS_SYMBOLS.includes(String(entry?.symbol || "").toUpperCase());
  }).map(function (entry) {
    return {
      market_date: entry.date,
      symbol: entry.symbol,
      display_name: entry.name,
      change_percent: entry.changePercent,
      benchmark_change_percent: entry.benchmarkChangePercent,
      driver_type: entry.driverType,
      confidence: entry.confidence,
      summary: entry.summary,
      reasons: entry.reasons,
      news: entry.news,
      captured_at: entry.capturedAt
    };
  });
}

function renderMarketHistoryDay(date, entries, open) {
  const up = entries.filter(function (entry) { return Number(entry.change_percent) > 0; }).length;
  const down = entries.filter(function (entry) { return Number(entry.change_percent) < 0; }).length;
  const sorted = entries.slice().sort(function (left, right) {
    return Math.abs(Number(right.change_percent || 0)) - Math.abs(Number(left.change_percent || 0));
  });
  return [
    '<details class="market-history-day"' + (open ? " open" : "") + ">",
    "<summary>",
    '<span class="history-date"><strong>' + escapeHtml(date) + '</strong><span>上涨 ' + up + " / 下跌 " + down + "</span></span>",
    '<span class="history-count">' + entries.length + " 只</span>",
    "</summary>",
    '<div class="history-event-grid">' + sorted.map(renderMarketHistoryEvent).join("") + "</div>",
    "</details>"
  ].join("");
}

function renderMarketHistoryEvent(entry) {
  const typeLabels = {
    market: "市场同向",
    company: "个股线索",
    mixed: "市场 + 个股",
    unclear: "证据不足"
  };
  const type = typeLabels[entry.driver_type] || typeLabels.unclear;
  const change = entry.change_percent === null || entry.change_percent === undefined ? null : Number(entry.change_percent);
  const benchmark = entry.benchmark_change_percent === null || entry.benchmark_change_percent === undefined ? null : Number(entry.benchmark_change_percent);
  const tone = Number.isFinite(change) && change > 0 ? "positive" : Number.isFinite(change) && change < 0 ? "negative" : "neutral";
  const news = Array.isArray(entry.news) ? entry.news : [];
  const firstNews = news.find(function (item) { return item?.url; });
  return [
    '<article class="history-event ' + tone + '">',
    '<div class="history-event-head"><strong>' + escapeHtml(entry.symbol || "--") + '</strong><span class="market-event-type">' + escapeHtml(type) + "</span></div>",
    '<p class="history-event-name">' + escapeHtml(entry.display_name || entry.symbol || "--") + "</p>",
    '<div class="history-event-metrics"><strong class="' + tone + '">' + (Number.isFinite(change) ? escapeHtml(formatSigned(change) + "%") : "--") + '</strong><span>QQQ ' + (Number.isFinite(benchmark) ? escapeHtml(formatSigned(benchmark) + "%") : "--") + "</span></div>",
    '<p class="history-event-summary">' + escapeHtml(entry.summary || "暂无明确的当日驱动证据。") + "</p>",
    firstNews ? '<a class="history-source" href="' + escapeHtml(firstNews.url) + '" target="_blank" rel="noreferrer">查看证据 · ' + escapeHtml(firstNews.publisher || "资讯来源") + "</a>" : '<span class="history-source muted">无可复核新闻链接</span>',
    "</article>"
  ].join("");
}

function buildActionQueue() {
  return state.items.map(function (item) {
    const quote = state.quotes[item.symbol] || null;
    const strategySignal = getStrategySignal(item, quote);
    const targetInfo = getTargetInfo(item, quote);
    const relativeQqq = getRelativeToBenchmark(item.symbol);
    const dailyChange = quote && typeof quote.changePercent === "number" ? quote.changePercent : null;
    const drawdown = getDrawdownPercent(item, quote);

    if (strategySignal) {
      return {
        priority: 100,
        tone: "negative",
        symbol: item.symbol,
        name: quote && quote.name ? quote.name : item.displayName,
        kind: "回撤纪律",
        title: "检查减仓规则",
        metric: "回撤 " + formatUnsignedPercent(drawdown),
        detail: "已触发回撤≥" + strategySignal.drawdown + "%，规则动作是卖出 " + strategySignal.sellPercent + "%。"
      };
    }

    if (targetInfo && targetInfo.hit) {
      return {
        priority: 90,
        tone: targetInfo.direction === "up" ? "positive" : "negative",
        symbol: item.symbol,
        name: quote && quote.name ? quote.name : item.displayName,
        kind: "目标已到",
        title: targetInfo.direction === "up" ? "已突破目标价" : "已跌破目标价",
        metric: formatNumber(targetInfo.price) + " / " + formatNumber(targetInfo.target),
        detail: "当前价已" + (targetInfo.direction === "up" ? "突破" : "跌破") + "你设置的目标，需要决定是否执行原计划。"
      };
    }

    if (targetInfo && Math.abs(targetInfo.distancePercent) <= 3) {
      return {
        priority: 70,
        tone: "neutral",
        symbol: item.symbol,
        name: quote && quote.name ? quote.name : item.displayName,
        kind: "临近目标",
        title: "接近目标价",
        metric: "差 " + formatUnsignedPercent(Math.abs(targetInfo.distancePercent)),
        detail: "距离目标价很近，可以提前写好到价后的动作，避免临盘犹豫。"
      };
    }

    if (relativeQqq !== null && relativeQqq <= -2) {
      return {
        priority: 60,
        tone: "negative",
        symbol: item.symbol,
        name: quote && quote.name ? quote.name : item.displayName,
        kind: "相对弱势",
        title: "明显跑输 QQQ",
        metric: formatSigned(relativeQqq) + "%",
        detail: "当日表现弱于 QQQ 2% 以上，适合检查是否是个股问题还是短期波动。"
      };
    }

    if (dailyChange !== null && dailyChange <= -3) {
      return {
        priority: 50,
        tone: "negative",
        symbol: item.symbol,
        name: quote && quote.name ? quote.name : item.displayName,
        kind: "当日大跌",
        title: "跌幅超过 3%",
        metric: formatSigned(dailyChange) + "%",
        detail: "单日跌幅较大，建议结合持仓成本、回撤和新闻事件确认是否需要处理。"
      };
    }

    return null;
  }).filter(Boolean).sort(function (left, right) {
    if (left.priority !== right.priority) return right.priority - left.priority;
    return left.symbol.localeCompare(right.symbol);
  });
}

function renderActionQueueCard(entry) {
  return [
    '<article class="action-card ' + escapeHtml(entry.tone) + '">',
    '<div class="action-card-head">',
    '<span class="action-kind">' + escapeHtml(entry.kind) + "</span>",
    '<strong class="action-symbol">' + escapeHtml(entry.symbol) + "</strong>",
    "</div>",
    '<h3>' + escapeHtml(entry.title) + "</h3>",
    '<p class="action-name">' + escapeHtml(entry.name || entry.symbol) + "</p>",
    '<strong class="action-metric">' + escapeHtml(entry.metric) + "</strong>",
    '<p class="muted">' + escapeHtml(entry.detail) + "</p>",
    '<button type="button" class="btn btn-ghost" data-analyze-symbol="' + escapeHtml(entry.symbol) + '">查看分析</button>',
    "</article>"
  ].join("");
}

function getVisibleItems() {
  const selectedGroup = state.preferences.selectedGroup;
  const performanceFilter = state.preferences.performanceFilter;
  const searchKeyword = state.preferences.searchKeyword.trim().toLowerCase();
  const rows = state.items.filter(function (item) {
    if (selectedGroup !== "all" && item.group !== selectedGroup) return false;
    if (!matchesPerformance(item, performanceFilter)) return false;
    if (!searchKeyword) return true;

    const haystack = [
      item.symbol,
      item.displayName,
      item.group,
      item.note,
      describeHoldingType(item.holdingType)
    ].join(" ").toLowerCase();

    return haystack.includes(searchKeyword);
  });

  const sortKey = state.preferences.sortKey;
  const direction = state.preferences.sortDirection === "asc" ? 1 : -1;

  return rows.slice().sort(function (left, right) {
    const leftValue = getSortValue(left, sortKey);
    const rightValue = getSortValue(right, sortKey);

    if (leftValue === null && rightValue === null) return left.symbol.localeCompare(right.symbol);
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;

    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return left.symbol.localeCompare(right.symbol) * direction;
  });
}

function getSortValue(item, sortKey) {
  const quote = state.quotes[item.symbol];
  if (sortKey === "price") return quote && typeof quote.price === "number" ? quote.price : null;
  if (sortKey === "changePercent") return quote && typeof quote.changePercent === "number" ? quote.changePercent : null;
  if (sortKey === "relativeQqq") return getRelativeToBenchmark(item.symbol);
  if (sortKey === "drawdownPercent") return getDrawdownPercent(item, quote);
  if (sortKey === "targetDistance") {
    const info = getTargetInfo(item, quote);
    return info ? Math.abs(info.distancePercent) : null;
  }
  if (sortKey === "displayName") return item.displayName.toUpperCase();
  return item.symbol;
}

function matchesPerformance(item, performanceFilter) {
  if (performanceFilter === "all") return true;
  const quote = state.quotes[item.symbol];
  if (!quote || quote.changePercent === null || typeof quote.changePercent !== "number") {
    return performanceFilter === "flat";
  }
  if (performanceFilter === "up") return quote.changePercent > 0;
  if (performanceFilter === "down") return quote.changePercent < 0;
  return quote.changePercent === 0;
}

function getTotalPages(totalItems, pageSize) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

function getPagination(totalItems, pageSize, currentPage) {
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const totalPages = getTotalPages(totalItems, safePageSize);
  const safeCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
  const startIndex = (safeCurrentPage - 1) * safePageSize;
  const endIndex = startIndex + safePageSize;

  return {
    totalPages,
    currentPage: safeCurrentPage,
    pageSize: safePageSize,
    startIndex,
    endIndex
  };
}

function updatePagination(pagination, totalItems) {
  els.pageInfo.textContent = "第 " + pagination.currentPage + " / " + pagination.totalPages + " 页 · 共 " + totalItems + " 条";
  els.prevPageBtn.disabled = pagination.currentPage <= 1;
  els.nextPageBtn.disabled = pagination.currentPage >= pagination.totalPages;
}

function renderListHint(filteredCount) {
  const total = state.items.length;
  const usTrackedCount = Object.keys(state.usPeaks).length;
  const autoRefreshText = state.preferences.autoRefreshSec > 0
    ? "自动刷新：每 " + describeSeconds(state.preferences.autoRefreshSec)
    : "自动刷新：已关闭";
  const freshnessText = state.lastSuccessAt
    ? "上次成功刷新：" + formatRelativeTime(state.lastSuccessAt)
    : "还没有成功刷新记录";
  els.listHint.textContent = "共 " + total + " 只，筛选后 " + filteredCount + " 只。已跟踪峰值 " + usTrackedCount + " 只。 " + autoRefreshText + "。 " + freshnessText + "。";
}

function parseStrategyRules(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const parsed = raw.split(",").map(function (entry) {
    const parts = entry.split(":");
    if (parts.length !== 2) return null;
    const drawdown = Number(parts[0].trim());
    const sellPercent = Number(parts[1].trim());
    if (!Number.isFinite(drawdown) || !Number.isFinite(sellPercent)) return null;
    if (drawdown <= 0 || sellPercent <= 0) return null;
    return {
      drawdown: Number(drawdown.toFixed(2)),
      sellPercent: Number(sellPercent.toFixed(2))
    };
  }).filter(Boolean);

  const map = new Map();
  for (const rule of parsed) {
    map.set(rule.drawdown, rule);
  }

  return Array.from(map.values()).sort(function (a, b) {
    return a.drawdown - b.drawdown;
  });
}

function getStrategySignal(item, quote) {
  const drawdown = getDrawdownPercent(item, quote);
  if (drawdown === null) return null;

  const rules = parseStrategyRules(state.preferences.strategyRulesText);
  if (!rules.length) return null;

  let matched = null;
  for (const rule of rules) {
    if (drawdown >= rule.drawdown) {
      matched = rule;
    }
  }
  return matched;
}

function buildStrategySignals(rows) {
  const signals = [];
  for (const item of rows) {
    const quote = state.quotes[item.symbol];
    const signal = getStrategySignal(item, quote);
    if (!signal) continue;
    const drawdown = getDrawdownPercent(item, quote);
    signals.push({
      symbol: item.symbol,
      displayName: item.displayName,
      drawdown: drawdown,
      signal: signal
    });
  }

  return signals.sort(function (left, right) {
    return Number(right.drawdown || 0) - Number(left.drawdown || 0);
  });
}

function renderStrategyPanel(signals) {
  const rules = parseStrategyRules(state.preferences.strategyRulesText);
  if (!rules.length) {
    els.strategyHint.textContent = "规则无效，请使用例如 8:20,12:30,18:50";
  } else {
    els.strategyHint.textContent = "当前规则：" + rules.map(function (rule) {
      return "回撤≥" + rule.drawdown + "% 卖 " + rule.sellPercent + "%";
    }).join(" ｜ ");
  }

  if (!signals.length) {
    els.signalSummary.textContent = "当前无触发建议";
    els.signalList.innerHTML = "";
    return;
  }

  els.signalSummary.textContent = "触发建议 " + signals.length + " 条";
  els.signalList.innerHTML = signals.map(function (entry) {
    return [
      '<article class="signal-item">',
      '<strong>' + escapeHtml(entry.symbol) + " / " + escapeHtml(entry.displayName) + "</strong>",
      '<span class="muted">当前回撤 ' + formatUnsignedPercent(entry.drawdown) + "，建议卖出 " + entry.signal.sellPercent + "%</span>",
      "</article>"
    ].join("");
  }).join("");
}

function checkDropAlerts() {
  const threshold = Math.abs(Number(state.preferences.dropAlertThreshold) || 0);
  const triggers = [];

  for (const item of state.items) {
    const quote = state.quotes[item.symbol];
    const changePercent = quote && typeof quote.changePercent === "number" ? quote.changePercent : null;
    if (changePercent === null) continue;
    if (changePercent <= -threshold) {
      triggers.push({
        symbol: item.symbol,
        name: quote.name || item.displayName,
        changePercent
      });
    }
  }

  triggers.sort(function (left, right) {
    return left.changePercent - right.changePercent;
  });
  renderDropPanel(triggers, threshold);

  if (!state.preferences.dropAlertEnabled) {
    state.dropAlerted.clear();
    return;
  }

  const currentSymbols = new Set(triggers.map(function (entry) {
    return entry.symbol;
  }));
  for (const symbol of Array.from(state.dropAlerted)) {
    if (!currentSymbols.has(symbol)) {
      state.dropAlerted.delete(symbol);
    }
  }

  const fresh = triggers.filter(function (entry) {
    return !state.dropAlerted.has(entry.symbol);
  });
  if (!fresh.length) return;

  fresh.forEach(function (entry) {
    state.dropAlerted.add(entry.symbol);
  });
  broadcastDrops(fresh);
}

function renderDropPanel(triggers, threshold) {
  els.broadcastHint.textContent = state.preferences.dropAlertEnabled
    ? "已开启：当日跌幅达到 " + threshold + "% 时" + describeBroadcastChannels() + "。开启自动刷新后可持续盯盘。"
    : "已关闭。开启后当日跌幅达到阈值会自动提醒。";

  if (!triggers.length) {
    els.dropSummary.textContent = "当前无下跌触发";
    els.dropList.innerHTML = "";
    return;
  }

  els.dropSummary.textContent = "当前触发 " + triggers.length + " 只（跌幅≥" + threshold + "%）";
  els.dropList.innerHTML = triggers.map(function (entry) {
    return [
      '<article class="signal-item">',
      '<strong>' + escapeHtml(entry.symbol) + " / " + escapeHtml(entry.name) + "</strong>",
      '<span class="negative">当日 ' + formatSigned(entry.changePercent) + "%</span>",
      "</article>"
    ].join("");
  }).join("");
}

function describeBroadcastChannels() {
  const channels = [];
  if (state.preferences.dropAlertVoice) channels.push("语音");
  if (state.preferences.dropAlertSound) channels.push("提示音");
  if (state.preferences.dropAlertNotify) channels.push("桌面通知");
  return channels.length ? "通过 " + channels.join(" / ") + " 提醒" : "提醒（未选播报方式）";
}

function broadcastDrops(items, options) {
  if (state.preferences.dropAlertSound) {
    playBeep();
  }

  if (state.preferences.dropAlertVoice) {
    const text = "下跌提醒：" + items.map(function (entry) {
      return (entry.name || entry.symbol) + " 下跌 " + Math.abs(entry.changePercent).toFixed(2) + "%";
    }).join("，");
    speak(text);
  }

  if (!options?.test && state.preferences.dropAlertNotify && typeof Notification !== "undefined" && Notification.permission === "granted") {
    const body = items.map(function (entry) {
      return entry.symbol + " " + formatSigned(entry.changePercent) + "%";
    }).join("\n");
    new Notification("下跌提醒", { body });
  }
}

function primeAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      if (!state.audioCtx) state.audioCtx = new Ctx();
      if (state.audioCtx.state === "suspended") state.audioCtx.resume();
    }
  } catch (_) {}

  if (typeof speechSynthesis !== "undefined") {
    try {
      speechSynthesis.resume();
    } catch (_) {}
  }
}

function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!state.audioCtx) state.audioCtx = new Ctx();
    const ctx = state.audioCtx;
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch (_) {}
}

function speak(text) {
  if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1;
    speechSynthesis.speak(utterance);
  } catch (_) {}
}

function setStatus(type, text) {
  els.statusDot.classList.remove("positive", "negative", "neutral");
  if (type === "positive") {
    els.statusDot.classList.add("positive");
  } else if (type === "negative") {
    els.statusDot.classList.add("negative");
  } else {
    els.statusDot.classList.add("neutral");
  }
  els.statusText.textContent = text;
}

function applyTone(node, value) {
  node.classList.remove("positive", "negative", "neutral");
  if (value > 0) node.classList.add("positive");
  else if (value < 0) node.classList.add("negative");
  else node.classList.add("neutral");
}

function persist(options) {
  saveState({
    items: state.items,
    preferences: state.preferences,
    usPeaks: state.usPeaks,
    marketEvents: state.marketEvents
  });

  if (!options?.skipCloudSync) {
    void pushToCloud("auto");
  }
}

function formatNumber(value) {
  return Number(value).toFixed(2);
}

function formatMoney(value) {
  if (!Number.isFinite(Number(value))) return "--";
  return "$" + Number(value).toFixed(2);
}

function formatMoneySigned(value) {
  if (!Number.isFinite(Number(value))) return "--";
  const amount = Number(value);
  return (amount > 0 ? "+$" : amount < 0 ? "-$" : "$") + Math.abs(amount).toFixed(2);
}

function formatSigned(value) {
  const text = Number(value).toFixed(2);
  return value > 0 ? "+" + text : text;
}

function formatPair(left, right) {
  if (!Number.isFinite(left) && !Number.isFinite(right)) return "--";
  return [Number.isFinite(left) ? formatNumber(left) : "--", Number.isFinite(right) ? formatNumber(right) : "--"].join(" / ");
}

function formatRange(low, high) {
  if (!Number.isFinite(low) && !Number.isFinite(high)) return "--";
  return [Number.isFinite(low) ? formatNumber(low) : "--", Number.isFinite(high) ? formatNumber(high) : "--"].join(" - ");
}

function formatQuoteTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.getHours().toString().padStart(2, "0") + ":" + date.getMinutes().toString().padStart(2, "0") + ":" + date.getSeconds().toString().padStart(2, "0");
}

function formatUnsignedPercent(value) {
  return Number(value).toFixed(2) + "%";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function describeSeconds(seconds) {
  if (seconds % 60 === 0) return String(seconds / 60) + " 分钟";
  return String(seconds) + " 秒";
}

function formatRelativeTime(date) {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return diffSec + " 秒前";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin + " 分钟前";
  const diffHour = Math.floor(diffMin / 60);
  return diffHour + " 小时前";
}

function syncPeaksWithQuotes() {
  const activeSymbols = new Set();

  for (const item of state.items) {
    const symbol = item.symbol;
    if (!symbol) continue;
    activeSymbols.add(symbol);
    const quote = state.quotes[symbol];
    const price = Number(quote?.price);
    if (!Number.isFinite(price) || price <= 0) continue;

    const current = state.usPeaks[symbol];
    if (!current || price > Number(current.peakPrice || 0)) {
      state.usPeaks[symbol] = {
        peakPrice: Number(price.toFixed(3)),
        peakAt: new Date().toISOString()
      };
    }
  }

  for (const symbol of Object.keys(state.usPeaks)) {
    if (!activeSymbols.has(symbol)) {
      delete state.usPeaks[symbol];
    }
  }
}

function getDrawdownPercent(item, quote) {
  const currentPrice = Number(quote?.price);
  const peak = state.usPeaks[item.symbol];
  const peakPrice = Number(peak?.peakPrice);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(peakPrice) || peakPrice <= 0) {
    return null;
  }
  const drawdown = ((peakPrice - currentPrice) / peakPrice) * 100;
  return Number(Math.max(0, drawdown).toFixed(3));
}
