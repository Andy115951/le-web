const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

let lastEastmoneyAt = 0;
const EASTMONEY_MIN_INTERVAL_MS = 1200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAShareSymbol(symbol) {
  return /^(6|0|3|8)\d{5}$/.test(String(symbol || "").trim());
}

function marketPrefix(code) {
  if (/^6/.test(code)) return "sh";
  if (/^8/.test(code)) return "bj";
  return "sz";
}

function secid(code) {
  return `${marketPrefix(code) === "sh" ? 1 : 0}.${code}`;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toYi(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number((n / 100000000).toFixed(2));
}

async function fetchText(url, { params, headers, encoding = "utf-8", timeoutMs = 15000 } = {}) {
  const target = new URL(url);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        target.searchParams.set(key, String(value));
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        ...headers
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const bytes = await response.arrayBuffer();
    return new TextDecoder(encoding).decode(bytes);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  return JSON.parse(text);
}

async function eastmoneyJson(url, options = {}) {
  const elapsed = Date.now() - lastEastmoneyAt;
  if (elapsed < EASTMONEY_MIN_INTERVAL_MS) {
    await sleep(EASTMONEY_MIN_INTERVAL_MS - elapsed + Math.random() * 300);
  }
  lastEastmoneyAt = Date.now();
  return fetchJson(url, {
    ...options,
    headers: {
      Referer: "https://quote.eastmoney.com/",
      ...(options.headers || {})
    }
  });
}

async function tencentQuote(code) {
  const symbol = `${marketPrefix(code)}${code}`;
  const text = await fetchText(`https://qt.gtimg.cn/q=${symbol}`, {
    encoding: "gb18030"
  });
  const match = text.match(/v_[a-z]{2}\d+="([^"]*)"/);
  if (!match) return null;

  const fields = match[1].split("~");
  return {
    code,
    name: fields[1] || code,
    price: num(fields[3]),
    prevClose: num(fields[4]),
    open: num(fields[5]),
    volume: num(fields[6]),
    high: num(fields[33]),
    low: num(fields[34]),
    peTtm: num(fields[39]),
    marketCapYi: num(fields[44]),
    pb: num(fields[46]),
    turnover: num(fields[38]),
    limitUp: num(fields[47]),
    limitDown: num(fields[48])
  };
}

async function eastmoneyStockInfo(code) {
  const data = await eastmoneyJson("https://push2.eastmoney.com/api/qt/stock/get", {
    params: {
      secid: secid(code),
      fields: "f43,f44,f45,f46,f47,f48,f57,f58,f60,f116,f117,f168,f169,f170"
    }
  });
  const d = data.data || {};
  return {
    code: d.f57 || code,
    name: d.f58 || code,
    price: d.f43 == null ? null : d.f43 / 100,
    high: d.f44 == null ? null : d.f44 / 100,
    low: d.f45 == null ? null : d.f45 / 100,
    open: d.f46 == null ? null : d.f46 / 100,
    volume: num(d.f47),
    amount: num(d.f48),
    prevClose: d.f60 == null ? null : d.f60 / 100,
    marketCap: num(d.f116),
    marketCapYi: toYi(d.f116),
    floatMarketCap: num(d.f117),
    floatMarketCapYi: toYi(d.f117),
    turnover: d.f168 == null ? null : d.f168 / 100,
    changeAmount: d.f169 == null ? null : d.f169 / 100,
    changePct: d.f170 == null ? null : d.f170 / 100
  };
}

async function eastmoneyReports(code, maxPages = 1) {
  const rows = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const data = await eastmoneyJson("https://reportapi.eastmoney.com/report/list", {
      params: {
        pageSize: 20,
        beginTime: "2020-01-01",
        endTime: "2050-01-01",
        pageNo: page,
        qType: 0,
        code
      },
      headers: {
        Referer: "https://data.eastmoney.com/report/"
      }
    });
    const list = Array.isArray(data.data) ? data.data : [];
    rows.push(...list);
    if (!list.length) break;
  }
  return rows;
}

function summarize(snapshot, valuation, reports) {
  const parts = [];
  if (snapshot.changePct !== null && snapshot.price !== null) {
    const direction = snapshot.changePct > 0 ? "上涨" : snapshot.changePct < 0 ? "下跌" : "平盘";
    parts.push(`当前 ${direction} ${Math.abs(snapshot.changePct).toFixed(2)}%，最新价 ${snapshot.price.toFixed(2)}`);
  }
  if (valuation.peTtm !== null || valuation.pb !== null) {
    parts.push(`估值侧 PE(TTM) ${valuation.peTtm ?? "--"}，PB ${valuation.pb ?? "--"}`);
  }
  if (snapshot.turnover !== null) {
    parts.push(`换手率 ${snapshot.turnover.toFixed(2)}%`);
  }
  if (valuation.marketCapYi !== null) {
    parts.push(`总市值约 ${valuation.marketCapYi.toFixed(2)} 亿`);
  }
  if (reports.length) {
    parts.push(`近期待看研报 ${reports.length} 篇`);
  }
  return parts.join("；");
}

function metric(label, value, suffix = "") {
  return {
    label,
    value: Number.isFinite(Number(value)) ? Number(value) : null,
    suffix
  };
}

async function getAShareDetail(code) {
  if (!isAShareSymbol(code)) {
    throw new Error("当前分析仅支持 A 股代码（沪深北交所）");
  }

  const [snapshot, valuationHint, reportRows] = await Promise.all([
    eastmoneyStockInfo(code),
    tencentQuote(code),
    eastmoneyReports(code, 1)
  ]);

  const valuation = {
    peTtm: valuationHint?.peTtm ?? null,
    pb: valuationHint?.pb ?? null,
    marketCapYi: snapshot.marketCapYi ?? valuationHint?.marketCapYi ?? null,
    floatMarketCapYi: snapshot.floatMarketCapYi ?? null,
    limitUp: valuationHint?.limitUp ?? null,
    limitDown: valuationHint?.limitDown ?? null
  };

  const reports = reportRows.slice(0, 5).map((row) => ({
    title: row.title || row.reportTitle || row.infoCode || "未命名研报",
    institution: row.orgSName || row.orgName || row.author || "未知机构",
    rating: row.emRatingName || row.ratingName || row.indvInduRating || "--",
    reportDate: row.publishDate?.slice(0, 10) || row.publishDate || "",
    url: row.pdfUrl || row.encodeUrl || row.attachUrl || ""
  }));

  return {
    symbol: code,
    name: snapshot.name || valuationHint?.name || code,
    market: marketPrefix(code) === "sh" ? "沪市" : marketPrefix(code) === "bj" ? "北交所" : "深市",
    snapshot,
    valuation,
    metrics: [
      metric("最新价", snapshot.price),
      metric("涨跌幅", snapshot.changePct, "%"),
      metric("换手率", snapshot.turnover, "%"),
      metric("PE(TTM)", valuation.peTtm),
      metric("PB", valuation.pb),
      metric("总市值(亿)", valuation.marketCapYi),
      metric("流通市值(亿)", valuation.floatMarketCapYi),
      metric("涨停价", valuation.limitUp),
      metric("跌停价", valuation.limitDown)
    ],
    reports,
    itemsTitle: "近期研报",
    itemsEmptyText: "暂无近期研报。",
    summary: summarize(snapshot, valuation, reports),
    sourceNames: ["东方财富 push2 / reportapi", "腾讯财经"],
    note: "公开市场接口可能有延迟、节流或偶发不可用。"
  };
}

module.exports = {
  isAShareSymbol,
  getAShareDetail
};
