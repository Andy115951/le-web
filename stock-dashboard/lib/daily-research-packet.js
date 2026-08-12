const { getMarketDayDetail, getPreviousTradingDate, normalizeDate } = require("./market-calendar");
const { getStoredSimilarDays } = require("./similar-day-store");
const { marketCloseAt } = require("./daily-market-features");
const { getUnifiedMarketEventsRange } = require("./unified-market-events");

const RESEARCH_PACKET_VERSION = "daily-research-packet-v1";

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanSource(source) {
  if (!source?.canonical_url) return null;
  return {
    provider: String(source.provider || "Unknown source"),
    title: String(source.title || "Untitled source"),
    url: String(source.canonical_url),
    sourceKind: String(source.source_kind || "unknown"),
    publishedAt: source.published_at || null,
    availableAt: source.available_at || null,
    relationType: source.relationType || "unknown"
  };
}

function cleanEvent(event) {
  const sources = (Array.isArray(event?.sources) ? event.sources : []).map(cleanSource).filter(Boolean);
  return {
    eventKey: String(event?.event_key || ""),
    eventType: String(event?.event_type || "unknown"),
    title: String(event?.title || "Untitled event"),
    summary: String(event?.summary || ""),
    eventTime: event?.event_time || null,
    availableAt: event?.available_at || null,
    capturedAt: event?.captured_at || null,
    impactScope: event?.impact_scope || "unknown",
    impactLevel: event?.impact_level || "unknown",
    confidence: finiteNumber(event?.confidence),
    tickers: Array.isArray(event?.tickers) ? event.tickers.map(String) : [],
    themes: Array.isArray(event?.themes) ? event.themes.map(String) : [],
    sources
  };
}

function isAvailableByMarketClose(event, date) {
  const availableAt = event?.available_at || event?.availableAt || event?.event_time || event?.eventTime;
  const availableTime = new Date(availableAt || "").getTime();
  return Number.isFinite(availableTime) && availableTime <= new Date(marketCloseAt(date)).getTime();
}

function isAvailableDuringResearchSession(event, previousMarketDate, date) {
  const availableAt = event?.available_at || event?.availableAt || event?.event_time || event?.eventTime;
  const availableTime = new Date(availableAt || "").getTime();
  const sessionStart = new Date(marketCloseAt(previousMarketDate)).getTime();
  const sessionEnd = new Date(marketCloseAt(date)).getTime();
  return Number.isFinite(availableTime) && availableTime > sessionStart && availableTime <= sessionEnd;
}

function cleanSimilarMatch(match) {
  return {
    rank: finiteNumber(match?.rank),
    candidateMarketDate: match?.candidate_market_date || null,
    similarityScore: finiteNumber(match?.similarity_score),
    components: {
      momentum: finiteNumber(match?.momentum_score),
      risk: finiteNumber(match?.risk_score),
      participation: finiteNumber(match?.participation_score),
      event: finiteNumber(match?.event_score)
    },
    usedFeatureKeys: match?.used_feature_keys || {},
    normalization: {
      startDate: match?.normalization_start_date || null,
      endDate: match?.normalization_end_date || null,
      sampleCount: finiteNumber(match?.normalization_sample_count)
    },
    historicalOutcome: {
      return1dPercent: finiteNumber(match?.candidate_return_1d_percent),
      return3dPercent: finiteNumber(match?.candidate_return_3d_percent),
      return5dPercent: finiteNumber(match?.candidate_return_5d_percent),
      return20dPercent: finiteNumber(match?.candidate_return_20d_percent),
      maxDrawdown20dPercent: finiteNumber(match?.candidate_max_drawdown_20d_percent),
      realizedVolatility20dPercent: finiteNumber(match?.candidate_realized_volatility_20d_percent)
    }
  };
}

function summarizePacketEvents(events) {
  const levels = { unknown: 0, low: 1, medium: 2, high: 3 };
  const types = Array.from(new Set(events.map(function (event) { return event.eventType; })));
  const symbols = Array.from(new Set(events.flatMap(function (event) { return event.tickers; })));
  const highestImpact = events.reduce(function (current, event) {
    return (levels[event.impactLevel] || 0) > (levels[current] || 0) ? event.impactLevel : current;
  }, "unknown");
  return { count: events.length, highestImpact, types, symbols };
}

function buildDailyResearchPacket(input) {
  const date = normalizeDate(input?.date);
  const detail = input?.detail || {};
  const similar = input?.similar || {};
  const day = detail.day || {};
  const qqq = day.qqq || null;
  const previousMarketDate = input?.previousMarketDate || null;
  const candidateEvents = Array.isArray(input?.sessionEvents) ? input.sessionEvents : (Array.isArray(detail.events) ? detail.events : []);
  const events = candidateEvents
    .filter(function (event) {
      return previousMarketDate
        ? isAvailableDuringResearchSession(event, previousMarketDate, date)
        : isAvailableByMarketClose(event, date);
    })
    .map(cleanEvent);
  const eventSummary = summarizePacketEvents(events);
  return {
    contractVersion: RESEARCH_PACKET_VERSION,
    researchOnly: true,
    generatedAt: input?.generatedAt || new Date().toISOString(),
    asOf: {
      marketDate: date,
      timezone: "America/New_York",
      dataBoundary: previousMarketDate
        ? "Research session from prior New York close through target New York close; events require available_at within that window."
        : "Target-market-date close; events require available_at no later than the target New York close.",
      previousMarketDate,
      excluded: [
        "Target-day forward returns and research labels",
        "Any event with available_at after target New York close",
        "Trading advice, target prices, model probabilities, or generated recommendations"
      ]
    },
    marketState: qqq ? {
      symbol: "QQQ",
      adjustedClose: finiteNumber(qqq.adjustedClose),
      changePercent: finiteNumber(qqq.changePercent),
      trailingVolatility20dPercent: finiteNumber(qqq.trailingVolatility20dPercent),
      volatilityLevel: qqq.volatilityLevel || "unknown",
      eventSummary: {
        count: eventSummary.count,
        highestImpact: eventSummary.highestImpact,
        types: eventSummary.types,
        symbols: eventSummary.symbols
      }
    } : null,
    events,
    ndxSnapshot: detail.ndxSnapshot ? {
      effectiveDate: detail.ndxSnapshot.effectiveDate || null,
      sourceUrl: detail.ndxSnapshot.sourceUrl || null,
      constituentCount: finiteNumber(detail.ndxSnapshot.constituentCount),
      totalWeightPercent: finiteNumber(detail.ndxSnapshot.totalWeightPercent),
      topMembers: (detail.ndxSnapshot.topMembers || []).map(function (member) {
        return {
          symbol: member?.instruments?.symbol || member?.symbol || null,
          name: member?.security_name || member?.name || null,
          weightPercent: finiteNumber(member?.weight_percent ?? member?.weightPercent)
        };
      }).filter(function (member) { return member.symbol; })
    } : null,
    historicalSimilarity: {
      methodVersion: similar.methodVersion || null,
      targetFeatureVersion: similar.target?.feature_version || null,
      candidateCount: finiteNumber(similar.summary?.candidateCount) || 0,
      summary: similar.summary || null,
      matches: (Array.isArray(similar.matches) ? similar.matches : []).map(cleanSimilarMatch)
    },
    constraints: {
      allowedUse: ["Evidence-grounded market recap", "Historical context explanation", "Question generation for human review"],
      prohibitedUse: ["Inventing missing facts", "Changing raw records", "Outputting trading instructions", "Treating historical frequency as a probability forecast"]
    }
  };
}

async function getDailyResearchPacket(value, now = new Date()) {
  const date = normalizeDate(value);
  const [detail, similar, previousMarketDate] = await Promise.all([
    getMarketDayDetail(date, now),
    getStoredSimilarDays("QQQ", date, 5),
    getPreviousTradingDate(date)
  ]);
  const sessionEvents = await getUnifiedMarketEventsRange(previousMarketDate, date);
  return buildDailyResearchPacket({ date, detail, similar, sessionEvents, previousMarketDate, generatedAt: now.toISOString() });
}

module.exports = {
  RESEARCH_PACKET_VERSION,
  buildDailyResearchPacket,
  cleanEvent,
  cleanSimilarMatch,
  cleanSource,
  getDailyResearchPacket,
  isAvailableByMarketClose,
  isAvailableDuringResearchSession,
  summarizePacketEvents
};
