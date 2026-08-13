const { normalizeDate } = require("./market-calendar");

// Full-day closures transcribed from NYSE's published 2026-2028 calendar.
// Early-close sessions remain expected trading days because they still produce a close.
const NYSE_TRADING_CALENDAR_VERSION = "nyse-full-closures-2026-2028-v1";
const NYSE_TRADING_CALENDAR_SOURCE = "https://www.nyse.com/trade/hours-calendars";
const FULL_CLOSURES_BY_YEAR = Object.freeze({
  2026: Object.freeze([
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
    "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25"
  ]),
  2027: Object.freeze([
    "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
    "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24"
  ]),
  2028: Object.freeze([
    "2028-01-17", "2028-02-21", "2028-04-14", "2028-05-29", "2028-06-19",
    "2028-07-04", "2028-09-04", "2028-11-23", "2028-12-25"
  ])
});

function shiftDate(value, days) {
  const date = new Date(normalizeDate(value) + "T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekStartForDate(value) {
  const date = new Date(normalizeDate(value) + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function weekdayDatesForWeek(weekStart) {
  const start = weekStartForDate(weekStart);
  return [0, 1, 2, 3, 4].map(function (offset) { return shiftDate(start, offset); });
}

function calendarCoversDates(dates) {
  return dates.every(function (date) {
    return Object.prototype.hasOwnProperty.call(FULL_CLOSURES_BY_YEAR, date.slice(0, 4));
  });
}

function getNyseTradingWeek(weekStart) {
  const normalizedWeekStart = weekStartForDate(weekStart);
  const weekdayDates = weekdayDatesForWeek(normalizedWeekStart);
  const calendarCovered = calendarCoversDates(weekdayDates);
  const fullClosureDates = calendarCovered
    ? weekdayDates.filter(function (date) { return FULL_CLOSURES_BY_YEAR[date.slice(0, 4)].includes(date); })
    : [];
  const expectedDates = calendarCovered
    ? weekdayDates.filter(function (date) { return !fullClosureDates.includes(date); })
    : weekdayDates;

  return {
    weekStart: normalizedWeekStart,
    weekdayDates,
    expectedDates,
    fullClosureDates,
    calendarStatus: calendarCovered ? "official_full_closures" : "strict_weekday_fallback",
    calendarVersion: calendarCovered ? NYSE_TRADING_CALENDAR_VERSION : null,
    calendarSource: calendarCovered ? NYSE_TRADING_CALENDAR_SOURCE : null
  };
}

module.exports = {
  FULL_CLOSURES_BY_YEAR,
  NYSE_TRADING_CALENDAR_SOURCE,
  NYSE_TRADING_CALENDAR_VERSION,
  getNyseTradingWeek,
  weekdayDatesForWeek,
  weekStartForDate
};
