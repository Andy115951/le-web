const crypto = require("crypto");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");

const EXTRACTOR_VERSION = "market-attribution-rules-v1";
const ALLOWED_HISTORY_DAYS = new Set([30, 90, 180]);

function canonicalizeSourceUrl(value) {
  const url = new URL(String(value || "").trim());
  if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported source URL");
  url.hash = "";
  Array.from(url.searchParams.keys()).forEach(function (key) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  });
  url.searchParams.sort();
  return url.toString();
}

function sourceFingerprint(canonicalUrl) {
  return crypto.createHash("sha256").update(canonicalUrl).digest("hex");
}

function confidenceScore(value) {
  if (value === "high") return 0.85;
  if (value === "medium") return 0.65;
  return 0.35;
}

function impactLevel(changePercent) {
  const magnitude = Math.abs(Number(changePercent) || 0);
  if (magnitude >= 2) return "high";
  if (magnitude >= 0.75) return "medium";
  return "low";
}

function validTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function buildUnifiedEventRecords(events, now = new Date()) {
  const capturedAt = now.toISOString();
  const sources = new Map();
  const eventRows = [];
  const sourceLinks = [];
  const entityLinks = [];
  const marketDates = new Set();

  (Array.isArray(events) ? events : []).forEach(function (event) {
    const symbol = String(event?.symbol || "").trim().toUpperCase();
    const marketDate = String(event?.date || "").trim();
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol) || !/^\d{4}-\d{2}-\d{2}$/.test(marketDate)) return;
    marketDates.add(marketDate);
    const eventKey = "market-move:" + marketDate + ":" + symbol + ":v1";
    const marketUrl = canonicalizeSourceUrl("https://finance.yahoo.com/quote/" + encodeURIComponent(symbol) + "/history/");
    sources.set(marketUrl, {
      source_kind: "market_data",
      provider: "Yahoo Finance",
      title: symbol + " market data",
      canonical_url: marketUrl,
      content_fingerprint: sourceFingerprint(marketUrl),
      published_at: null,
      available_at: validTimestamp(event.availableAt || event.capturedAt) || capturedAt,
      captured_at: validTimestamp(event.capturedAt) || capturedAt,
      metadata: { symbol }
    });
    sourceLinks.push({ eventKey, canonicalUrl: marketUrl, relationType: "primary" });

    (Array.isArray(event.news) ? event.news : []).forEach(function (item) {
      let canonicalUrl;
      try {
        canonicalUrl = canonicalizeSourceUrl(item?.url);
      } catch {
        return;
      }
      sources.set(canonicalUrl, {
        source_kind: "news",
        provider: String(item?.publisher || "Unknown publisher").trim(),
        title: String(item?.title || "Untitled source").trim(),
        canonical_url: canonicalUrl,
        content_fingerprint: sourceFingerprint(canonicalUrl),
        published_at: validTimestamp(item?.publishedAt),
        available_at: validTimestamp(event.availableAt || event.capturedAt) || capturedAt,
        captured_at: validTimestamp(event.capturedAt) || capturedAt,
        metadata: {}
      });
      sourceLinks.push({ eventKey, canonicalUrl, relationType: "evidence" });
    });

    eventRows.push({
      event_key: eventKey,
      market_date: marketDate,
      event_time: validTimestamp(event.eventTime),
      available_at: validTimestamp(event.availableAt || event.capturedAt) || capturedAt,
      captured_at: validTimestamp(event.capturedAt) || capturedAt,
      event_type: "market_move_attribution",
      title: symbol + " daily market move",
      summary: String(event.summary || "").trim(),
      sentiment: "unknown",
      impact_scope: symbol === "QQQ" ? "market" : "instrument",
      impact_level: impactLevel(event.changePercent),
      confidence: confidenceScore(event.confidence),
      tickers: [symbol],
      themes: [],
      attributes: {
        changePercent: event.changePercent ?? null,
        benchmarkChangePercent: event.benchmarkChangePercent ?? null,
        driverType: event.driverType || "unclear",
        reasons: Array.isArray(event.reasons) ? event.reasons : []
      },
      extractor_version: EXTRACTOR_VERSION,
      updated_at: capturedAt
    });
    entityLinks.push({ eventKey, symbol, entityRole: "primary" });
    if (symbol !== "QQQ") entityLinks.push({ eventKey, symbol: "QQQ", entityRole: "benchmark" });
  });

  return {
    marketDates: Array.from(marketDates),
    sources: Array.from(sources.values()),
    events: eventRows,
    sourceLinks: Array.from(new Map(sourceLinks.map(function (link) {
      return [link.eventKey + "|" + link.canonicalUrl, link];
    })).values()),
    entityLinks: Array.from(new Map(entityLinks.map(function (link) {
      return [link.eventKey + "|" + link.symbol, link];
    })).values())
  };
}

async function upsertReturning(config, table, conflictColumns, rows) {
  if (!rows.length) return [];
  const result = [];
  for (let index = 0; index < rows.length; index += 250) {
    const page = await requestSupabase(config, "/rest/v1/" + table + "?on_conflict=" + conflictColumns, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: rows.slice(index, index + 250)
    });
    if (Array.isArray(page)) result.push(...page);
  }
  return result;
}

async function upsertMinimal(config, table, conflictColumns, rows) {
  if (!rows.length) return;
  for (let index = 0; index < rows.length; index += 250) {
    await requestSupabase(config, "/rest/v1/" + table + "?on_conflict=" + conflictColumns, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: rows.slice(index, index + 250)
    });
  }
}

async function persistUnifiedMarketEvents(config, events, now = new Date()) {
  const records = buildUnifiedEventRecords(events, now);
  if (!records.events.length) return { eventsWritten: 0, sourcesWritten: 0 };

  await upsertMinimal(config, "market_days", "market_date", records.marketDates.map(function (marketDate) {
    return {
      market_date: marketDate,
      exchange: "XNAS",
      is_trading_day: true,
      session_status: "closed",
      source: "Yahoo Finance daily event capture",
      updated_at: now.toISOString()
    };
  }));

  const symbols = Array.from(new Set(records.entityLinks.map(function (link) { return link.symbol; })));
  const instruments = await requestSupabase(
    config,
    "/rest/v1/instruments?select=id,symbol&symbol=in.(" + symbols.map(encodeURIComponent).join(",") + ")"
  );
  const instrumentBySymbol = new Map((instruments || []).map(function (instrument) {
    return [instrument.symbol, instrument.id];
  }));
  const missing = symbols.filter(function (symbol) { return !instrumentBySymbol.has(symbol); });
  if (missing.length) throw new Error("Missing registered instruments: " + missing.join(", "));

  const sourceRows = await upsertReturning(config, "sources", "canonical_url", records.sources);
  const eventRows = await upsertReturning(config, "events", "event_key", records.events);
  const sourceByUrl = new Map(sourceRows.map(function (source) { return [source.canonical_url, source.id]; }));
  const eventByKey = new Map(eventRows.map(function (event) { return [event.event_key, event.id]; }));

  await upsertMinimal(config, "event_sources", "event_id,source_id", records.sourceLinks.map(function (link) {
    return {
      event_id: eventByKey.get(link.eventKey),
      source_id: sourceByUrl.get(link.canonicalUrl),
      relation_type: link.relationType
    };
  }));
  await upsertMinimal(config, "event_entities", "event_id,instrument_id", records.entityLinks.map(function (link) {
    return {
      event_id: eventByKey.get(link.eventKey),
      instrument_id: instrumentBySymbol.get(link.symbol),
      entity_role: link.entityRole
    };
  }));

  return { eventsWritten: eventRows.length, sourcesWritten: sourceRows.length };
}

function normalizeHistoryDays(value) {
  const days = Number(value) || 30;
  return ALLOWED_HISTORY_DAYS.has(days) ? days : 30;
}

function validateMarketDate(value, field) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid " + field + " market date");
  return date;
}

async function getUnifiedMarketEventsRange(startDate, endDate) {
  const config = getSupabaseConfig();
  const normalizedStart = validateMarketDate(startDate, "start");
  const normalizedEnd = validateMarketDate(endDate, "end");
  if (normalizedStart > normalizedEnd) throw new Error("Invalid market date range");
  const columns = "id,event_key,market_date,event_time,available_at,captured_at,event_type,title,summary,sentiment,impact_scope,impact_level,confidence,tickers,themes,attributes,extractor_version";
  const events = [];
  const basePath = "/rest/v1/events?select=" + columns
    + "&market_date=gte." + normalizedStart
    + "&market_date=lte." + normalizedEnd
    + "&order=market_date.desc,event_key.asc";
  for (let offset = 0; offset < 4000; offset += 1000) {
    const page = await requestSupabase(config, basePath + "&limit=1000&offset=" + offset);
    const rows = Array.isArray(page) ? page : [];
    events.push(...rows);
    if (rows.length < 1000) break;
  }
  if (!Array.isArray(events) || !events.length) return [];
  const eventIds = events.map(function (event) { return event.id; });
  const sourceLinks = [];
  const entityLinks = [];
  for (let index = 0; index < eventIds.length; index += 100) {
    const idFilter = eventIds.slice(index, index + 100).join(",");
    const [sourcePage, entityPage] = await Promise.all([
      requestSupabase(config, "/rest/v1/event_sources?select=event_id,relation_type,source_id,sources(id,source_kind,provider,title,canonical_url,published_at,available_at)&event_id=in.(" + idFilter + ")&limit=1000"),
      requestSupabase(config, "/rest/v1/event_entities?select=event_id,entity_role,instrument_id,instruments(id,symbol,display_name,instrument_role)&event_id=in.(" + idFilter + ")&limit=1000")
    ]);
    if (Array.isArray(sourcePage)) sourceLinks.push(...sourcePage);
    if (Array.isArray(entityPage)) entityLinks.push(...entityPage);
  }
  const sourcesByEvent = new Map();
  (sourceLinks || []).forEach(function (link) {
    if (!sourcesByEvent.has(link.event_id)) sourcesByEvent.set(link.event_id, []);
    sourcesByEvent.get(link.event_id).push({ relationType: link.relation_type, ...link.sources });
  });
  const entitiesByEvent = new Map();
  (entityLinks || []).forEach(function (link) {
    if (!entitiesByEvent.has(link.event_id)) entitiesByEvent.set(link.event_id, []);
    entitiesByEvent.get(link.event_id).push({ entityRole: link.entity_role, ...link.instruments });
  });
  return events.map(function (event) {
    return { ...event, sources: sourcesByEvent.get(event.id) || [], entities: entitiesByEvent.get(event.id) || [] };
  });
}

async function getUnifiedMarketEvents(days) {
  const normalizedDays = normalizeHistoryDays(days);
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - normalizedDays + 1);
  return getUnifiedMarketEventsRange(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
}

module.exports = {
  EXTRACTOR_VERSION,
  buildUnifiedEventRecords,
  canonicalizeSourceUrl,
  getUnifiedMarketEvents,
  getUnifiedMarketEventsRange,
  normalizeHistoryDays,
  persistUnifiedMarketEvents,
  sourceFingerprint
};
