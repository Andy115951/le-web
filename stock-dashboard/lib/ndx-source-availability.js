const NDX_OVERVIEW_URL = "https://indexes.nasdaq.com/Index/Overview/NDX";
const NDX_WEIGHTING_URL = "https://indexes.nasdaqomx.com/Index/Weighting/NDX";
const NDX_SOURCE_AVAILABILITY_VERSION = "ndx-source-availability-v1";

function plainText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUsDate(value) {
  const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const result = new Date(Date.UTC(year, month - 1, day));
  return result.getUTCFullYear() === year && result.getUTCMonth() === month - 1 && result.getUTCDate() === day
    ? result.toISOString().slice(0, 10)
    : null;
}

function parseOverview(text) {
  const content = plainText(text);
  const asOfMatch = content.match(/data\s+as\s+of\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const countMatch = content.match(/#\s*of\s*components\s*(?:\||:)?\s*(\d{1,3})/i)
    || content.match(/(\d{1,3})\s+components\b/i);
  return {
    dataAsOf: normalizeUsDate(asOfMatch?.[1]),
    componentCount: countMatch ? Number(countMatch[1]) : null
  };
}

function parseWeightingAccess(text) {
  const content = plainText(text);
  const loginRequired = /log\s*in\s+for\s+full\s+access|please\s+log\s*in\s+or\s+register/i.test(content);
  const hasComponentColumns = /company\s+name/i.test(content) && /security\s+symbol/i.test(content);
  const hasWeightColumn = /\bweight(?:ing)?\b/i.test(content);
  return {
    loginRequired,
    hasComponentColumns,
    hasWeightColumn,
    couldContainCompleteExport: !loginRequired && hasComponentColumns && hasWeightColumn
  };
}

function buildNdxSourceAvailability(input = {}) {
  const overview = parseOverview(input.overviewBody);
  const weighting = parseWeightingAccess(input.weightingBody);
  const overviewAvailable = input.overviewStatus >= 200 && input.overviewStatus < 300;
  const weightingAvailable = input.weightingStatus >= 200 && input.weightingStatus < 300;
  const overviewSignalsCurrentUniverse = overview.componentCount !== null && overview.componentCount >= 100 && overview.componentCount <= 105;
  const status = weighting.couldContainCompleteExport
    ? "manual_export_required"
    : weighting.loginRequired
      ? "authorized_export_required"
      : "official_source_unavailable";
  return {
    version: NDX_SOURCE_AVAILABILITY_VERSION,
    checkedAt: typeof input.checkedAt === "string" ? input.checkedAt : null,
    candidateCreationAllowed: false,
    status,
    sources: {
      overview: {
        url: NDX_OVERVIEW_URL,
        available: overviewAvailable,
        dataAsOf: overview.dataAsOf,
        componentCount: overview.componentCount,
        signalsCurrentUniverse: overviewSignalsCurrentUniverse
      },
      weighting: {
        url: NDX_WEIGHTING_URL,
        available: weightingAvailable,
        loginRequired: weighting.loginRequired,
        hasComponentColumns: weighting.hasComponentColumns,
        hasWeightColumn: weighting.hasWeightColumn,
        couldContainCompleteExport: weighting.couldContainCompleteExport
      }
    },
    nextStep: weighting.couldContainCompleteExport
      ? "Download one complete official export manually, preserve its effective date and publication time, then create a candidate for review."
      : "Obtain an authorized complete official Nasdaq constituent-and-weight export; do not infer a candidate from partial public output."
  };
}

module.exports = {
  NDX_OVERVIEW_URL,
  NDX_SOURCE_AVAILABILITY_VERSION,
  NDX_WEIGHTING_URL,
  buildNdxSourceAvailability,
  parseOverview,
  parseWeightingAccess
};
