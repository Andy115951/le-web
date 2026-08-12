const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildSecFilingRecords,
  collectRecentSecFilings,
  getSecUserAgent,
  indexCompanyTickers,
  rowsFromRecentFilings
} = require("../lib/sec-edgar");

const companyTickers = {
  "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
  "1": { cik_str: 1045810, ticker: "NVDA", title: "NVIDIA CORP" }
};

const submissions = {
  filings: {
    recent: {
      form: ["8-K", "10-Q", "S-3"],
      filingDate: ["2026-08-11", "2026-08-02", "2026-08-01"],
      acceptanceDateTime: ["2026-08-11T16:05:00.000", "2026-08-02T12:00:00.000", "2026-08-01T11:00:00.000"],
      accessionNumber: ["0000320193-26-000123", "0000320193-26-000122", "0000320193-26-000121"],
      primaryDocument: ["aapl-20260811.htm", "aapl-20260802.htm", "aapl-20260801.htm"],
      reportDate: ["2026-08-11", "2026-06-30", ""],
      items: ["2.02,9.01", "", ""]
    }
  }
};

test("SEC ticker and filing parsing preserves CIK, acceptance time and official archive URL", function () {
  const company = indexCompanyTickers(companyTickers).get("AAPL");
  assert.equal(company.cik, "0000320193");
  const rows = rowsFromRecentFilings(submissions, company, "2026-08-01");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].form, "8-K");
  assert.equal(rows[0].acceptedAt, "2026-08-11T16:05:00.000Z");
  assert.equal(rows[0].sourceUrl, "https://www.sec.gov/Archives/edgar/data/320193/000032019326000123/aapl-20260811.htm");
});

test("SEC filing records create primary filing evidence and a market-date event", function () {
  const company = indexCompanyTickers(companyTickers).get("AAPL");
  const filing = rowsFromRecentFilings(submissions, company, "2026-08-01")[0];
  const records = buildSecFilingRecords([filing], new Date("2026-08-12T00:00:00.000Z"));
  assert.equal(records.events.length, 1);
  assert.equal(records.events[0].event_key, "sec-filing:0000320193-26-000123:AAPL");
  assert.equal(records.events[0].market_date, "2026-08-11");
  assert.equal(records.events[0].impact_level, "medium");
  assert.equal(records.sources[0].source_kind, "filing");
  assert.deepEqual(records.entityLinks, [{ eventKey: "sec-filing:0000320193-26-000123:AAPL", symbol: "AAPL", entityRole: "primary" }]);
});

test("SEC collection uses declared contact user agent and filters unsupported forms", async function () {
  const requests = [];
  const responseFor = function (payload) {
    return { ok: true, status: 200, statusText: "OK", json: async function () { return payload; } };
  };
  const fetchImpl = async function (url, options) {
    requests.push({ url, options });
    return responseFor(url.includes("company_tickers") ? companyTickers : submissions);
  };
  const result = await collectRecentSecFilings(["AAPL", "QQQ"], {
    now: new Date("2026-08-12T00:00:00.000Z"),
    lookbackDays: 14,
    env: { SEC_USER_AGENT: "Stock Dashboard developer@example.com" },
    fetchImpl
  });
  assert.equal(result.filings.length, 2);
  assert.deepEqual(result.fetchedCompanies, ["AAPL"]);
  assert.deepEqual(result.skippedSymbols, ["QQQ"]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers["User-Agent"], "Stock Dashboard developer@example.com");
});

test("SEC collector refuses unidentified automated access", function () {
  assert.throws(function () { getSecUserAgent({ SEC_USER_AGENT: "stock-dashboard" }); }, /contact email/);
});
