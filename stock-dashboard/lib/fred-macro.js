const { marketDate } = require("./daily-market-events");
const { canonicalizeSourceUrl, persistOnlyNewUnifiedRecords, sourceFingerprint } = require("./unified-market-events");

const FRED_API_BASE_URL = "https://api.stlouisfed.org/fred";
const FRED_EVENT_VERSION = "fred-macro-observations-v1";
const MAX_OBSERVATIONS_PER_SERIES = 3;
const FRED_SERIES = [
  { id: "CPIAUCSL", label: "Consumer Price Index for All Urban Consumers", theme: "inflation", impactLevel: "high" },
  { id: "UNRATE", label: "Civilian Unemployment Rate", theme: "labor", impactLevel: "high" },
  { id: "FEDFUNDS", label: "Effective Federal Funds Rate", theme: "policy_rate", impactLevel: "high" },
  { id: "GDPC1", label: "Real Gross Domestic Product", theme: "growth", impactLevel: "medium" }
];

function getFredApiKey(env = process.env) {
  const value = String(env.FRED_API_KEY || "").trim();
  if (!/^[a-z0-9]{32}$/.test(value)) {
    throw new Error("FRED_API_KEY must be a 32-character lowercase alphanumeric API key");
  }
  return value;
}

function isFredConfigured(env = process.env) {
  return Boolean(String(env.FRED_API_KEY || "").trim());
}

function fredSeriesPageUrl(seriesId) {
  const normalized = String(seriesId || "").trim().toUpperCase();
  if (!/^[A-Z0-9_]{1,32}$/.test(normalized)) throw new Error("Invalid FRED series id");
  return canonicalizeSourceUrl("https://fred.stlouisfed.org/series/" + normalized);
}

function fredObservationKey(seriesId, observation) {
  const date = String(observation?.date || "").trim();
  const value = String(observation?.value || "").trim();
  return "fred-observation:" + seriesId + ":" + sourceFingerprint(seriesId + "|" + date + "|" + value).slice(0, 20);
}

function validObservation(observation) {
  const date = String(observation?.date || "").trim();
  const value = String(observation?.value || "").trim();
  const number = Number(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && value !== "." && Number.isFinite(number);
}

function normalizeObservations(payload, series, maximum = MAX_OBSERVATIONS_PER_SERIES) {
  const observations = Array.isArray(payload?.observations) ? payload.observations : [];
  return observations.filter(validObservation).slice(0, Math.max(1, maximum)).map(function (observation) {
    return {
      seriesId: series.id,
      seriesLabel: series.label,
      theme: series.theme,
      impactLevel: series.impactLevel,
      observationDate: String(observation.date),
      value: Number(observation.value),
      rawValue: String(observation.value),
      realtimeStart: String(observation.realtime_start || "").trim() || null,
      realtimeEnd: String(observation.realtime_end || "").trim() || null,
      sourceUrl: fredSeriesPageUrl(series.id)
    };
  });
}

function buildFredObservationRecords(observations, now = new Date()) {
  const capturedAt = now.toISOString();
  const date = marketDate(now);
  const sources = new Map();
  const events = [];
  const sourceLinks = [];
  (Array.isArray(observations) ? observations : []).forEach(function (observation) {
    if (!observation?.seriesId || !validObservation({ date: observation.observationDate, value: observation.rawValue })) return;
    const sourceUrl = fredSeriesPageUrl(observation.seriesId);
    const eventKey = fredObservationKey(observation.seriesId, { date: observation.observationDate, value: observation.rawValue });
    sources.set(sourceUrl, {
      source_kind: "macro",
      provider: "FRED",
      title: observation.seriesLabel || observation.seriesId,
      canonical_url: sourceUrl,
      content_fingerprint: sourceFingerprint(sourceUrl),
      published_at: null,
      // FRED observation responses include dates but no precise release time. Capture time is the only safe known-at value.
      available_at: capturedAt,
      captured_at: capturedAt,
      metadata: { seriesId: observation.seriesId }
    });
    events.push({
      event_key: eventKey,
      market_date: date,
      event_time: null,
      available_at: capturedAt,
      captured_at: capturedAt,
      event_type: "fred_macro_observation",
      title: observation.seriesId + " observation captured",
      summary: "FRED captured " + (observation.seriesLabel || observation.seriesId) + " for "
        + observation.observationDate + " at " + observation.rawValue + ".",
      sentiment: "unknown",
      impact_scope: "market",
      impact_level: observation.impactLevel || "medium",
      confidence: 0.9,
      tickers: [],
      themes: ["macro", observation.theme || "macro"],
      attributes: {
        seriesId: observation.seriesId,
        observationDate: observation.observationDate,
        observationValue: observation.value,
        realtimeStart: observation.realtimeStart,
        realtimeEnd: observation.realtimeEnd,
        timeSemantics: "FRED observation payload does not include a precise release timestamp; available_at is the collector capture time."
      },
      extractor_version: FRED_EVENT_VERSION,
      updated_at: capturedAt
    });
    sourceLinks.push({ eventKey, canonicalUrl: sourceUrl, relationType: "primary" });
  });
  return {
    marketDays: [{ marketDate: date, isTradingDay: ![0, 6].includes(new Date(date + "T12:00:00Z").getUTCDay()), source: "FRED macro observation capture" }],
    sources: Array.from(sources.values()),
    events,
    sourceLinks,
    entityLinks: []
  };
}

function fredApiUrl(path, parameters) {
  const url = new URL(FRED_API_BASE_URL + path);
  Object.entries(parameters).forEach(function ([key, value]) { url.searchParams.set(key, String(value)); });
  return url.toString();
}

async function fetchFredJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("FRED API " + response.status + " " + response.statusText);
  return response.json();
}

async function collectRecentFredObservations(options = {}) {
  const apiKey = getFredApiKey(options.env || process.env);
  const fetchImpl = options.fetchImpl || fetch;
  const series = Array.isArray(options.series) && options.series.length ? options.series : FRED_SERIES;
  const observations = [];
  for (const item of series) {
    const payload = await fetchFredJson(fredApiUrl("/series/observations", {
      api_key: apiKey,
      file_type: "json",
      series_id: item.id,
      sort_order: "desc",
      limit: Math.max(1, Math.min(10, Number(options.observationsPerSeries) || MAX_OBSERVATIONS_PER_SERIES))
    }), fetchImpl);
    observations.push(...normalizeObservations(payload, item, options.observationsPerSeries));
  }
  return { observations, seriesIds: series.map(function (item) { return item.id; }) };
}

async function captureRecentFredObservations(config, options = {}) {
  const collected = await collectRecentFredObservations(options);
  const persisted = await persistOnlyNewUnifiedRecords(config, buildFredObservationRecords(collected.observations, options.now), options.now);
  return { ...collected, ...persisted };
}

module.exports = {
  FRED_API_BASE_URL,
  FRED_EVENT_VERSION,
  FRED_SERIES,
  MAX_OBSERVATIONS_PER_SERIES,
  buildFredObservationRecords,
  captureRecentFredObservations,
  collectRecentFredObservations,
  fetchFredJson,
  fredApiUrl,
  fredObservationKey,
  fredSeriesPageUrl,
  getFredApiKey,
  isFredConfigured,
  normalizeObservations,
  validObservation
};
