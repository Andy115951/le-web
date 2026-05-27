import { loadState, saveState, upsertItem, removeItem, collectGroups } from "./storage.js";
import { fetchQuotes } from "./quotes.js";
import { renderSparkline } from "./chart.js";
import {
  loadCloudConfig,
  saveCloudConfig,
  createCloudClient,
  getCloudUser,
  sendMagicLink,
  signOutCloud,
  onCloudAuthChange,
  loadRemoteState,
  saveRemoteState
} from "./cloud.js";

const els = {
  stockForm: document.getElementById("stockForm"),
  symbolInput: document.getElementById("symbolInput"),
  nameInput: document.getElementById("nameInput"),
  groupInput: document.getElementById("groupInput"),
  noteInput: document.getElementById("noteInput"),
  refreshBtn: document.getElementById("refreshBtn"),
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
  pageSizeSelect: document.getElementById("pageSizeSelect"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageInfo: document.getElementById("pageInfo"),
  pagination: document.getElementById("pagination"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  stockTableBody: document.getElementById("stockTableBody"),
  lastUpdated: document.getElementById("lastUpdated"),
  rowTemplate: document.getElementById("rowTemplate"),
  countStat: document.getElementById("countStat"),
  upStat: document.getElementById("upStat"),
  downStat: document.getElementById("downStat"),
  flatStat: document.getElementById("flatStat"),
  emptyState: document.getElementById("emptyState"),
  mobileList: document.getElementById("mobileList"),
  listHint: document.getElementById("listHint"),
  strategyRulesInput: document.getElementById("strategyRulesInput"),
  saveStrategyBtn: document.getElementById("saveStrategyBtn"),
  strategyHint: document.getElementById("strategyHint"),
  signalSummary: document.getElementById("signalSummary"),
  signalList: document.getElementById("signalList")
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
    strategyRulesText: "8:20,12:30,18:50"
  },
  quotes: {},
  usPeaks: {},
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

init();

async function init() {
  const saved = loadState();
  const cloudConfig = loadCloudConfig();
  state.items = saved.items;
  state.preferences = saved.preferences;
  state.usPeaks = saved.usPeaks || {};
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

function bindEvents() {
  els.stockForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const symbol = String(els.symbolInput.value || "").trim().toUpperCase();
    if (!symbol) return;

    state.items = upsertItem(state.items, {
      symbol,
      displayName: els.nameInput.value,
      group: els.groupInput.value,
      note: els.noteInput.value,
      createdAt: new Date().toISOString()
    });

    persist();
    renderGroupFilter();
    syncControls();
    els.stockForm.reset();
    els.symbolInput.focus();
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

  els.stockTableBody.addEventListener("click", handleDeleteClick);
  els.mobileList.addEventListener("click", handleDeleteClick);
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
    return;
  }

  if (options?.overrideLocal !== false) {
    applyRemoteState(remote.data);
    setCloudStatus("已从云端拉取并覆盖本地");
  } else {
    const localFingerprint = JSON.stringify({
      items: state.items,
      preferences: state.preferences,
      usPeaks: state.usPeaks
    });
    const remoteFingerprint = JSON.stringify({
      items: Array.isArray(remote.data.items) ? remote.data.items : [],
      preferences: remote.data.preferences && typeof remote.data.preferences === "object" ? remote.data.preferences : {},
      usPeaks: remote.data.us_peaks && typeof remote.data.us_peaks === "object" ? remote.data.us_peaks : {}
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
}

function applyRemoteState(remoteData) {
  state.items = Array.isArray(remoteData.items) ? remoteData.items : [];
  state.preferences = {
    ...state.preferences,
    ...(remoteData.preferences && typeof remoteData.preferences === "object" ? remoteData.preferences : {})
  };
  state.usPeaks = remoteData.us_peaks && typeof remoteData.us_peaks === "object" ? remoteData.us_peaks : {};
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
    usPeaks: state.usPeaks
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
  els.refreshBtn.disabled = true;
  setStatus("neutral", options.trigger === "auto" ? "自动刷新中..." : "正在刷新...");
  try {
    state.quotes = await fetchQuotes(state.items.map(function (item) {
      return item.symbol;
    }));
    syncUsPeaksWithQuotes();
    persist();
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
  }
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
    symbolNode.textContent = item.symbol;
    nameNode.textContent = quote && quote.name ? quote.name : item.displayName;
    row.querySelector(".market-badge").textContent = quote && quote.market ? quote.market : "--";
    row.querySelector(".group-badge").textContent = item.group;
    row.querySelector(".note-cell").textContent = item.note || "-";
    row.querySelector(".remove-btn").setAttribute("data-symbol", item.symbol);

    const priceCell = row.querySelector(".price-cell");
    const changeCell = row.querySelector(".change-cell");
    const percentCell = row.querySelector(".percent-cell");
    const prevOpenCell = row.querySelector(".prev-open-cell");
    const rangeCell = row.querySelector(".range-cell");
    const drawdownCell = row.querySelector(".drawdown-cell");
    const adviceCell = row.querySelector(".advice-cell");

    fillQuoteCells({
      priceCell,
      changeCell,
      percentCell,
      prevOpenCell,
      rangeCell,
      sparklineTarget: row.querySelector(".sparkline")
    }, quote);
    fillDrawdownCell(drawdownCell, item, quote);
    fillAdviceCell(adviceCell, item, quote);

    els.stockTableBody.appendChild(fragment);
    els.mobileList.appendChild(createMobileCard(item, quote));
  }

  updatePagination(pagination, rows.length);
  renderListHint(rows.length);
  renderStrategyPanel(strategySignals);
}

function fillQuoteCells(cells, quote) {
  if (!quote || quote.price === null || quote.change === null || quote.changePercent === null) {
    cells.priceCell.textContent = "--";
    cells.changeCell.textContent = "--";
    cells.percentCell.textContent = "--";
    cells.prevOpenCell.textContent = "--";
    cells.rangeCell.textContent = "--";
    renderSparkline(cells.sparklineTarget, quote ? quote.sparkline : [], 0);
    return;
  }

  cells.priceCell.textContent = formatNumber(quote.price);
  cells.changeCell.textContent = formatSigned(quote.change);
  cells.percentCell.textContent = formatSigned(quote.changePercent) + "%";
  cells.prevOpenCell.textContent = formatPair(quote.previousClose, quote.open);
  cells.rangeCell.textContent = formatRange(quote.low, quote.high);
  applyTone(cells.changeCell, quote.change);
  applyTone(cells.percentCell, quote.changePercent);
  renderSparkline(cells.sparklineTarget, quote.sparkline, quote.changePercent);
}

function fillDrawdownCell(cell, item, quote) {
  const drawdown = getUsDrawdownPercent(item, quote);
  cell.classList.remove("positive", "negative", "neutral");

  if (drawdown === null) {
    cell.textContent = "--";
    cell.classList.add("neutral");
    cell.title = isUsSymbol(item.symbol) ? "等待更多价格数据后开始计算" : "仅对美股跟踪峰值回撤";
    return;
  }

  cell.textContent = formatUnsignedPercent(drawdown);
  cell.classList.add(drawdown === 0 ? "neutral" : "negative");
  const peak = state.usPeaks[item.symbol];
  cell.title = peak ? "跟踪峰值 " + formatNumber(peak.peakPrice) : "";
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

function createMobileCard(item, quote) {
  const card = document.createElement("article");
  card.className = "mobile-card";

  const toneClass = !quote || quote.changePercent === null ? "neutral" : quote.changePercent > 0 ? "positive" : quote.changePercent < 0 ? "negative" : "neutral";
  const percentText = quote && quote.changePercent !== null ? formatSigned(quote.changePercent) + "%" : "--";
  const changeText = quote && quote.change !== null ? formatSigned(quote.change) : "--";
  const priceText = quote && quote.price !== null ? formatNumber(quote.price) : "--";
  const displayName = quote && quote.name ? quote.name : item.displayName;
  const drawdown = getUsDrawdownPercent(item, quote);
  const drawdownText = drawdown === null ? "--" : formatUnsignedPercent(drawdown);
  const drawdownTone = drawdown === null || drawdown === 0 ? "neutral" : "negative";
  const strategySignal = getStrategySignal(item, quote);
  const strategyText = strategySignal
    ? "建议：回撤≥" + strategySignal.drawdown + "%，卖出 " + strategySignal.sellPercent + "%"
    : "建议：继续观察";
  const strategyTone = strategySignal ? "negative" : "neutral";

  card.innerHTML = [
    '<div class="mobile-card-top">',
    '<div class="stock-cell"><strong class="stock-symbol">' + escapeHtml(item.symbol) + '</strong><span class="stock-name">' + escapeHtml(displayName) + '</span></div>',
    '<div class="mobile-side-tags"><span class="market-badge">' + escapeHtml(quote && quote.market ? quote.market : "--") + '</span><span class="group-badge">' + escapeHtml(item.group) + '</span></div>',
    '</div>',
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
    '<div class="mobile-chart"></div>',
    '<p class="mobile-note">' + escapeHtml(item.note || "暂无备注") + '</p>',
    '<button type="button" class="btn btn-ghost remove-btn" data-symbol="' + escapeHtml(item.symbol) + '">删除</button>'
  ].join("");

  renderSparkline(card.querySelector(".mobile-chart"), quote && quote.sparkline ? quote.sparkline : [], quote && quote.changePercent !== null ? quote.changePercent : 0);
  return card;
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
      item.note
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
  if (sortKey === "drawdownPercent") return getUsDrawdownPercent(item, quote);
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
  els.listHint.textContent = "共 " + total + " 只，筛选后 " + filteredCount + " 只。已跟踪美股峰值 " + usTrackedCount + " 只。 " + autoRefreshText + "。 " + freshnessText + "。";
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
  const drawdown = getUsDrawdownPercent(item, quote);
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
    const drawdown = getUsDrawdownPercent(item, quote);
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
    usPeaks: state.usPeaks
  });

  if (!options?.skipCloudSync) {
    void pushToCloud("auto");
  }
}

function formatNumber(value) {
  return Number(value).toFixed(2);
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

function isUsSymbol(symbol) {
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(String(symbol || "").trim().toUpperCase());
}

function syncUsPeaksWithQuotes() {
  const activeUsSymbols = new Set();

  for (const item of state.items) {
    const symbol = item.symbol;
    if (!isUsSymbol(symbol)) continue;
    activeUsSymbols.add(symbol);
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
    if (!activeUsSymbols.has(symbol)) {
      delete state.usPeaks[symbol];
    }
  }
}

function getUsDrawdownPercent(item, quote) {
  if (!isUsSymbol(item.symbol)) return null;
  const currentPrice = Number(quote?.price);
  const peak = state.usPeaks[item.symbol];
  const peakPrice = Number(peak?.peakPrice);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(peakPrice) || peakPrice <= 0) {
    return null;
  }
  const drawdown = ((peakPrice - currentPrice) / peakPrice) * 100;
  return Number(Math.max(0, drawdown).toFixed(3));
}
