const { getNdxConstituentChangeSummary, getNdxSnapshot } = require("./ndx-snapshots");
const { getEarningsEvents } = require("./earnings-calendar");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { getUnifiedMarketEventsRange } = require("./unified-market-events");

const IMPACT_ORDER = { unknown: 0, low: 1, medium: 2, high: 3 };

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function newYorkDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(function (part) { return [part.type, part.value]; }));
  return values.year + "-" + values.month + "-" + values.day;
}

function normalizeMonth(value, now = new Date()) {
  const month = String(value || "").trim();
  if (!month) return newYorkDate(now).slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid calendar month");
  return month;
}

function normalizeDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid calendar date");
  if (new Date(date + "T12:00:00.000Z").toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid calendar date");
  }
  return date;
}

function monthBounds(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function shiftDate(date, days) {
  const value = new Date(date + "T12:00:00.000Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function previousWeekdayDate(date) {
  let result = shiftDate(normalizeDate(date), -1);
  while ([0, 6].includes(new Date(result + "T12:00:00.000Z").getUTCDay())) result = shiftDate(result, -1);
  return result;
}

function calendarDates(start, end) {
  const dates = [];
  for (let date = start; date <= end; date = shiftDate(date, 1)) dates.push(date);
  return dates;
}

function annualizedTrailingVolatility(prices) {
  if (prices.length < 21) return null;
  const window = prices.slice(-21);
  const returns = window.slice(1).map(function (price, index) {
    return Math.log(price / window[index]);
  });
  const mean = returns.reduce(function (sum, value) { return sum + value; }, 0) / returns.length;
  const variance = returns.reduce(function (sum, value) {
    return sum + ((value - mean) ** 2);
  }, 0) / returns.length;
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100);
}

function volatilityLevel(value) {
  if (!Number.isFinite(value)) return "unknown";
  if (value < 15) return "calm";
  if (value < 25) return "normal";
  return "elevated";
}

function highestImpact(events) {
  return events.reduce(function (highest, event) {
    return (IMPACT_ORDER[event.impact_level] || 0) > (IMPACT_ORDER[highest] || 0)
      ? event.impact_level
      : highest;
  }, "unknown");
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildCalendarDays(options) {
  const prices = [...options.prices].sort(function (left, right) { return left.market_date.localeCompare(right.market_date); });
  const priceByDate = new Map(prices.map(function (row) { return [row.market_date, row]; }));
  const labelsByDate = new Map(options.labels.map(function (row) { return [row.market_date, row]; }));
  const eventsByDate = new Map();
  options.events.forEach(function (event) {
    if (!eventsByDate.has(event.market_date)) eventsByDate.set(event.market_date, []);
    eventsByDate.get(event.market_date).push(event);
  });
  const earningsByDate = new Map();
  (options.earnings || []).forEach(function (event) {
    if (!earningsByDate.has(event.marketDate)) earningsByDate.set(event.marketDate, []);
    earningsByDate.get(event.marketDate).push(event);
  });
  const observedPrices = [];

  return calendarDates(options.start, options.end).map(function (date) {
    prices.filter(function (row) { return row.market_date <= date; }).forEach(function (row) {
      if (!observedPrices.some(function (item) { return item.market_date === row.market_date; })) observedPrices.push(row);
    });
    const price = priceByDate.get(date) || null;
    const events = eventsByDate.get(date) || [];
    const earnings = earningsByDate.get(date) || [];
    const weekday = new Date(date + "T12:00:00.000Z").getUTCDay();
    let status = "closed-or-missing";
    if (price) status = "trading";
    else if (date > options.today) status = "upcoming";
    else if (weekday === 0 || weekday === 6) status = "weekend";
    const trailingPrices = observedPrices.filter(function (row) { return row.market_date <= date; })
      .map(function (row) { return Number(row.adjusted_close ?? row.close); })
      .filter(function (value) { return Number.isFinite(value) && value > 0; });
    const trailingVolatility = price ? annualizedTrailingVolatility(trailingPrices) : null;
    const label = labelsByDate.get(date) || null;
    return {
      date,
      status,
      qqq: price ? {
        open: Number(price.open),
        high: Number(price.high),
        low: Number(price.low),
        close: Number(price.close),
        adjustedClose: Number(price.adjusted_close ?? price.close),
        volume: price.volume === null ? null : Number(price.volume),
        changePercent: price.change_percent === null ? null : Number(price.change_percent),
        trailingVolatility20dPercent: trailingVolatility,
        volatilityLevel: volatilityLevel(trailingVolatility)
      } : null,
      eventSummary: {
        count: events.length,
        earningsCount: earnings.length,
        highestImpact: highestImpact(events),
        types: Array.from(new Set(events.map(function (event) { return event.event_type; }))),
        symbols: Array.from(new Set(events.flatMap(function (event) { return event.tickers || []; })))
      },
      researchOutcome: label ? {
        return1dPercent: nullableNumber(label.return_1d_percent),
        return3dPercent: nullableNumber(label.return_3d_percent),
        return5dPercent: nullableNumber(label.return_5d_percent),
        return20dPercent: nullableNumber(label.return_20d_percent),
        maxDrawdown20dPercent: nullableNumber(label.max_drawdown_20d_percent),
        realizedVolatility20dPercent: nullableNumber(label.realized_volatility_20d_percent),
        labelVersion: label.label_version
      } : null
    };
  });
}

async function getQqqInstrument(config) {
  const rows = await requestSupabase(config, "/rest/v1/instruments?select=id,symbol,display_name&symbol=eq.QQQ&limit=1");
  const instrument = Array.isArray(rows) ? rows[0] : null;
  if (!instrument) throw new Error("QQQ instrument is not registered");
  return instrument;
}

async function loadCalendarData(month, now = new Date()) {
  const config = getSupabaseConfig();
  const bounds = monthBounds(month);
  const lookbackStart = shiftDate(bounds.start, -45);
  const instrument = await getQqqInstrument(config);
  const [prices, labels, events, earnings] = await Promise.all([
    requestSupabase(config, "/rest/v1/price_bars_daily?select=market_date,open,high,low,close,adjusted_close,volume,change_percent"
      + "&instrument_id=eq." + instrument.id + "&market_date=gte." + lookbackStart + "&market_date=lte." + bounds.end
      + "&order=market_date.asc&limit=100"),
    requestSupabase(config, "/rest/v1/market_forward_labels?select=market_date,return_1d_percent,return_3d_percent,return_5d_percent,return_20d_percent,max_drawdown_20d_percent,realized_volatility_20d_percent,label_version"
      + "&instrument_id=eq." + instrument.id + "&market_date=gte." + bounds.start + "&market_date=lte." + bounds.end
      + "&order=market_date.asc&limit=40"),
    getUnifiedMarketEventsRange(bounds.start, bounds.end),
    getEarningsEvents({ startDate: bounds.start, endDate: bounds.end, limit: 250 })
  ]);
  return {
    instrument,
    bounds,
    days: buildCalendarDays({
      start: bounds.start,
      end: bounds.end,
      today: newYorkDate(now),
      prices: Array.isArray(prices) ? prices : [],
      labels: Array.isArray(labels) ? labels : [],
      events,
      earnings: earnings.events
    }),
    events,
    earnings: earnings.events
  };
}

async function getMarketCalendar(value, now = new Date()) {
  const month = normalizeMonth(value, now);
  const data = await loadCalendarData(month, now);
  return {
    month,
    timezone: "America/New_York",
    today: newYorkDate(now),
    startDate: data.bounds.start,
    endDate: data.bounds.end,
    days: data.days
  };
}

async function getMarketDayDetail(value, now = new Date()) {
  const date = normalizeDate(value);
  const data = await loadCalendarData(date.slice(0, 7), now);
  const day = data.days.find(function (item) { return item.date === date; });
  const snapshot = await getNdxSnapshot(date);
  const constituentChanges = await getNdxConstituentChangeSummary(snapshot);
  return {
    timezone: "America/New_York",
    day,
    events: data.events.filter(function (event) { return event.market_date === date; }),
    earningsEvents: data.earnings.filter(function (event) { return event.marketDate === date; }),
    ndxSnapshot: snapshot ? {
      effectiveDate: snapshot.effective_date,
      sourceUrl: snapshot.source_url,
      constituentCount: snapshot.constituent_count,
      totalWeightPercent: Number(snapshot.total_weight_percent),
      topMembers: snapshot.members.slice(0, 10),
      constituentChanges
    } : null
  };
}

async function getPreviousTradingDate(value) {
  const date = normalizeDate(value);
  const config = getSupabaseConfig();
  const rows = await requestSupabase(
    config,
    "/rest/v1/market_days?select=market_date&market_date=lt." + date
      + "&is_trading_day=is.true&order=market_date.desc&limit=1"
  );
  const previous = Array.isArray(rows) ? rows[0]?.market_date : null;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(previous || "")) ? previous : previousWeekdayDate(date);
}

module.exports = {
  annualizedTrailingVolatility,
  buildCalendarDays,
  getMarketCalendar,
  getMarketDayDetail,
  getPreviousTradingDate,
  monthBounds,
  newYorkDate,
  normalizeDate,
  normalizeMonth,
  nullableNumber,
  previousWeekdayDate,
  volatilityLevel
};
