import { loadState, saveState, upsertItem, removeItem, collectGroups } from "./storage.js";
import { fetchQuotes } from "./quotes.js";
import { renderSparkline } from "./chart.js";

const els = {
  stockForm: document.getElementById("stockForm"),
  symbolInput: document.getElementById("symbolInput"),
  nameInput: document.getElementById("nameInput"),
  groupInput: document.getElementById("groupInput"),
  noteInput: document.getElementById("noteInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  groupFilter: document.getElementById("groupFilter"),
  sortSelect: document.getElementById("sortSelect"),
  sortDirection: document.getElementById("sortDirection"),
  stockTableBody: document.getElementById("stockTableBody"),
  lastUpdated: document.getElementById("lastUpdated"),
  rowTemplate: document.getElementById("rowTemplate"),
  countStat: document.getElementById("countStat"),
  upStat: document.getElementById("upStat"),
  downStat: document.getElementById("downStat"),
  flatStat: document.getElementById("flatStat"),
  emptyState: document.getElementById("emptyState"),
  mobileList: document.getElementById("mobileList"),
  listHint: document.getElementById("listHint")
};

const state = {
  items: [],
  preferences: {
    selectedGroup: "all",
    sortKey: "changePercent",
    sortDirection: "desc"
  },
  quotes: {},
  loading: false
};

init();

async function init() {
  const saved = loadState();
  state.items = saved.items;
  state.preferences = saved.preferences;
  bindEvents();
  syncControls();
  renderGroupFilter();
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

  els.groupFilter.addEventListener("change", function () {
    state.preferences.selectedGroup = els.groupFilter.value;
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

  els.stockTableBody.addEventListener("click", async function (event) {
    const button = event.target.closest("button[data-symbol]");
    if (!button) return;
    state.items = removeItem(state.items, button.getAttribute("data-symbol"));
    persist();
    renderGroupFilter();
    await refreshQuotes();
  });
}

function syncControls() {
  els.groupFilter.value = state.preferences.selectedGroup;
  els.sortSelect.value = state.preferences.sortKey;
  els.sortDirection.value = state.preferences.sortDirection;
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

async function refreshQuotes() {
  state.loading = true;
  els.refreshBtn.disabled = true;
  els.listHint.textContent = "正在刷新实时行情...";
  try {
    state.quotes = await fetchQuotes(state.items.map(function (item) {
      return item.symbol;
    }));
    updateLastUpdated();
  } catch (error) {
    console.error(error);
    els.listHint.textContent = error && error.message ? error.message : "刷新行情失败，请稍后重试。";
  } finally {
    state.loading = false;
    els.refreshBtn.disabled = false;
    if (Object.keys(state.quotes).length) {
      els.listHint.textContent = "当前接入东方财富公开接口；美股按字母代码，A股按 600519 / 300750 这类代码即可。";
    }
    render();
  }
}

function updateLastUpdated() {
  const now = new Date();
  els.lastUpdated.textContent = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0") + ":" + now.getSeconds().toString().padStart(2, "0");
}

function render() {
  const rows = getVisibleItems();
  renderStats(rows);
  els.stockTableBody.innerHTML = "";
  els.mobileList.innerHTML = "";
  els.emptyState.classList.toggle("hidden", rows.length > 0);
  els.mobileList.classList.toggle("hidden", rows.length === 0);

  for (const item of rows) {
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

    fillQuoteCells({
      priceCell,
      changeCell,
      percentCell,
      prevOpenCell,
      rangeCell,
      sparklineTarget: row.querySelector(".sparkline")
    }, quote);

    els.stockTableBody.appendChild(fragment);
    els.mobileList.appendChild(createMobileCard(item, quote));
  }
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

function createMobileCard(item, quote) {
  const card = document.createElement("article");
  card.className = "mobile-card";

  const toneClass = !quote || quote.changePercent === null ? "neutral" : quote.changePercent > 0 ? "positive" : quote.changePercent < 0 ? "negative" : "neutral";
  const percentText = quote && quote.changePercent !== null ? formatSigned(quote.changePercent) + "%" : "--";
  const changeText = quote && quote.change !== null ? formatSigned(quote.change) : "--";
  const priceText = quote && quote.price !== null ? formatNumber(quote.price) : "--";
  const displayName = quote && quote.name ? quote.name : item.displayName;

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
  const rows = state.items.filter(function (item) {
    return selectedGroup === "all" || item.group === selectedGroup;
  });

  const sortKey = state.preferences.sortKey;
  const direction = state.preferences.sortDirection === "asc" ? 1 : -1;

  return rows.slice().sort(function (left, right) {
    const leftValue = getSortValue(left, sortKey);
    const rightValue = getSortValue(right, sortKey);

    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return left.symbol.localeCompare(right.symbol) * direction;
  });
}

function getSortValue(item, sortKey) {
  const quote = state.quotes[item.symbol];
  if (sortKey === "price") return quote ? quote.price : -Infinity;
  if (sortKey === "changePercent") return quote ? quote.changePercent : -Infinity;
  if (sortKey === "displayName") return item.displayName.toUpperCase();
  return item.symbol;
}

function applyTone(node, value) {
  node.classList.remove("positive", "negative", "neutral");
  if (value > 0) node.classList.add("positive");
  else if (value < 0) node.classList.add("negative");
  else node.classList.add("neutral");
}

function persist() {
  saveState({
    items: state.items,
    preferences: state.preferences
  });
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
