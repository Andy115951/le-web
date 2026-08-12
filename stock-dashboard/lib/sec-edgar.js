const { marketDate } = require("./daily-market-events");
const { canonicalizeSourceUrl, persistUnifiedRecords, sourceFingerprint } = require("./unified-market-events");

const SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK";
const SEC_ARCHIVES_URL = "https://www.sec.gov/Archives/edgar/data";
const SEC_EVENT_VERSION = "sec-edgar-filings-v1";
const SEC_LOOKBACK_DAYS = 7;
const SUPPORTED_FORMS = new Set(["10-K", "10-Q", "8-K", "20-F", "40-F", "6-K"]);

function normalizeCik(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits || digits.length > 10) return null;
  return digits.padStart(10, "0");
}

function getSecUserAgent(env = process.env) {
  const value = String(env.SEC_USER_AGENT || "").trim();
  if (!value || !/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(value)) {
    throw new Error("SEC_USER_AGENT must identify this app and include a contact email");
  }
  return value;
}

function isSecEdgarConfigured(env = process.env) {
  return Boolean(String(env.SEC_USER_AGENT || "").trim());
}

function isWeekday(date) {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return day >= 1 && day <= 5;
}

function secTimestamp(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/i.test(raw) ? raw : raw + "Z";
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function buildFilingUrl(cik, accessionNumber, primaryDocument) {
  const normalizedCik = normalizeCik(cik);
  const accession = String(accessionNumber || "").replace(/-/g, "");
  const document = String(primaryDocument || "").trim();
  if (!normalizedCik || !/^\d{18}$/.test(accession) || !document) return null;
  return canonicalizeSourceUrl(
    SEC_ARCHIVES_URL + "/" + Number(normalizedCik) + "/" + accession + "/" + encodeURIComponent(document)
  );
}

function indexCompanyTickers(payload) {
  const result = new Map();
  Object.values(payload && typeof payload === "object" ? payload : {}).forEach(function (company) {
    const symbol = String(company?.ticker || "").trim().toUpperCase();
    const cik = normalizeCik(company?.cik_str);
    if (/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol) && cik && !result.has(symbol)) {
      result.set(symbol, { symbol, cik, name: String(company?.title || symbol).trim() || symbol });
    }
  });
  return result;
}

function rowsFromRecentFilings(payload, company, sinceDate) {
  const recent = payload?.filings?.recent;
  if (!recent || typeof recent !== "object") return [];
  const forms = Array.isArray(recent.form) ? recent.form : [];
  return forms.map(function (form, index) {
    const acceptedAt = secTimestamp(recent.acceptanceDateTime?.[index]);
    const filingDate = String(recent.filingDate?.[index] || "").trim();
    const accessionNumber = String(recent.accessionNumber?.[index] || "").trim();
    const primaryDocument = String(recent.primaryDocument?.[index] || "").trim();
    const normalizedForm = String(form || "").trim().toUpperCase();
    const sourceUrl = buildFilingUrl(company.cik, accessionNumber, primaryDocument);
    if (!SUPPORTED_FORMS.has(normalizedForm) || !acceptedAt || !sourceUrl || !/^\d{4}-\d{2}-\d{2}$/.test(filingDate)) return null;
    if (sinceDate && filingDate < sinceDate) return null;
    return {
      symbol: company.symbol,
      companyName: company.name,
      cik: company.cik,
      form: normalizedForm,
      filingDate,
      reportDate: String(recent.reportDate?.[index] || "").trim() || null,
      accessionNumber,
      primaryDocument,
      items: String(recent.items?.[index] || "").trim() || null,
      acceptedAt,
      sourceUrl
    };
  }).filter(Boolean);
}

function impactForForm(form) {
  if (["10-K", "20-F", "40-F"].includes(form)) return "high";
  if (["10-Q", "8-K"].includes(form)) return "medium";
  return "low";
}

function buildSecFilingRecords(filings, now = new Date()) {
  const capturedAt = now.toISOString();
  const sources = new Map();
  const events = [];
  const sourceLinks = [];
  const entityLinks = [];
  const marketDays = new Map();
  (Array.isArray(filings) ? filings : []).forEach(function (filing) {
    const acceptedAt = secTimestamp(filing.acceptedAt);
    const sourceUrl = filing.sourceUrl ? canonicalizeSourceUrl(filing.sourceUrl) : null;
    if (!acceptedAt || !sourceUrl || !filing.symbol || !filing.accessionNumber) return;
    const date = marketDate(new Date(acceptedAt));
    const eventKey = "sec-filing:" + filing.accessionNumber + ":" + filing.symbol;
    marketDays.set(date, {
      marketDate: date,
      isTradingDay: isWeekday(date),
      source: "SEC EDGAR filing acceptance"
    });
    sources.set(sourceUrl, {
      source_kind: "filing",
      provider: "SEC EDGAR",
      title: filing.symbol + " " + filing.form + " filing",
      canonical_url: sourceUrl,
      content_fingerprint: sourceFingerprint(sourceUrl),
      published_at: acceptedAt,
      available_at: acceptedAt,
      captured_at: capturedAt,
      metadata: { cik: filing.cik, accessionNumber: filing.accessionNumber, form: filing.form }
    });
    events.push({
      event_key: eventKey,
      market_date: date,
      event_time: acceptedAt,
      available_at: acceptedAt,
      captured_at: capturedAt,
      event_type: "sec_filing",
      title: filing.symbol + " filed " + filing.form,
      summary: filing.companyName + " filed " + filing.form + " with the SEC.",
      sentiment: "unknown",
      impact_scope: "instrument",
      impact_level: impactForForm(filing.form),
      confidence: 0.95,
      tickers: [filing.symbol],
      themes: ["sec_filing", filing.form.toLowerCase()],
      attributes: {
        cik: filing.cik,
        accessionNumber: filing.accessionNumber,
        form: filing.form,
        filingDate: filing.filingDate,
        reportDate: filing.reportDate,
        primaryDocument: filing.primaryDocument,
        items: filing.items
      },
      extractor_version: SEC_EVENT_VERSION,
      updated_at: capturedAt
    });
    sourceLinks.push({ eventKey, canonicalUrl: sourceUrl, relationType: "primary" });
    entityLinks.push({ eventKey, symbol: filing.symbol, entityRole: "primary" });
  });
  return {
    marketDays: Array.from(marketDays.values()),
    sources: Array.from(sources.values()),
    events,
    sourceLinks,
    entityLinks
  };
}

async function fetchSecJson(url, userAgent, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "User-Agent": userAgent
    }
  });
  if (!response.ok) throw new Error("SEC EDGAR " + response.status + " " + response.statusText);
  return response.json();
}

function wait(milliseconds) {
  return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
}

async function collectRecentSecFilings(symbols, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const userAgent = getSecUserAgent(options.env || process.env);
  const fetchImpl = options.fetchImpl || fetch;
  const lookbackDays = Math.max(1, Math.min(30, Number(options.lookbackDays) || SEC_LOOKBACK_DAYS));
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - lookbackDays);
  const sinceDate = since.toISOString().slice(0, 10);
  const companies = indexCompanyTickers(await fetchSecJson(SEC_COMPANY_TICKERS_URL, userAgent, fetchImpl));
  const tracked = Array.from(new Set((symbols || []).map(function (symbol) {
    return String(symbol || "").trim().toUpperCase();
  }))).map(function (symbol) { return companies.get(symbol); }).filter(Boolean);
  const filings = [];
  for (let index = 0; index < tracked.length; index += 1) {
    const company = tracked[index];
    const payload = await fetchSecJson(SEC_SUBMISSIONS_URL + company.cik + ".json", userAgent, fetchImpl);
    filings.push(...rowsFromRecentFilings(payload, company, sinceDate));
    if (index < tracked.length - 1) await wait(125);
  }
  return {
    filings,
    fetchedCompanies: tracked.map(function (company) { return company.symbol; }),
    skippedSymbols: Array.from(new Set(symbols || [])).map(function (symbol) { return String(symbol).toUpperCase(); })
      .filter(function (symbol) { return !companies.has(symbol); }),
    sinceDate
  };
}

async function captureRecentSecFilings(config, symbols, options = {}) {
  const collected = await collectRecentSecFilings(symbols, options);
  const persisted = await persistUnifiedRecords(config, buildSecFilingRecords(collected.filings, options.now), options.now);
  return { ...collected, ...persisted };
}

module.exports = {
  SEC_COMPANY_TICKERS_URL,
  SEC_EVENT_VERSION,
  SEC_LOOKBACK_DAYS,
  SEC_SUBMISSIONS_URL,
  buildFilingUrl,
  buildSecFilingRecords,
  captureRecentSecFilings,
  collectRecentSecFilings,
  getSecUserAgent,
  indexCompanyTickers,
  isSecEdgarConfigured,
  normalizeCik,
  rowsFromRecentFilings,
  secTimestamp
};
