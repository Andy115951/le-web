const assert = require("node:assert/strict");
const test = require("node:test");
const { buildNdxSourceAvailability, parseOverview, parseWeightingAccess } = require("../lib/ndx-source-availability");
const { main } = require("../scripts/check-ndx-source-availability");

test("NDX overview parser keeps only the displayed official date and component count", function () {
  assert.deepEqual(parseOverview("DATA AS OF 9/1/2026 # of Components | 102"), {
    dataAsOf: "2026-09-01",
    componentCount: 102
  });
  assert.deepEqual(parseOverview("DATA AS OF invalid"), { dataAsOf: null, componentCount: null });
});

test("NDX weighting access parser does not treat a login-gated partial page as an export", function () {
  const access = parseWeightingAccess("Weighting Company Name Security Symbol Log in for Full Access");
  assert.equal(access.loginRequired, true);
  assert.equal(access.hasComponentColumns, true);
  assert.equal(access.couldContainCompleteExport, false);
});

test("NDX source availability never permits automatic candidate creation", function () {
  const result = buildNdxSourceAvailability({
    checkedAt: "2026-09-03T00:00:00.000Z",
    overviewStatus: 200,
    overviewBody: "DATA AS OF 9/1/2026 # of Components | 102",
    weightingStatus: 200,
    weightingBody: "Weighting Company Name Security Symbol Log in for Full Access"
  });
  assert.equal(result.candidateCreationAllowed, false);
  assert.equal(result.status, "authorized_export_required");
  assert.equal(result.sources.overview.signalsCurrentUniverse, true);
  assert.equal(result.sources.weighting.couldContainCompleteExport, false);
});

test("NDX source command makes bounded official reads and returns no raw HTML", async function () {
  const urls = [];
  const result = await main({
    checkedAt: "2026-09-03T00:00:00.000Z",
    fetchImpl: async function (url) {
      urls.push(url);
      return {
        ok: true,
        status: 200,
        text: async function () {
          return url.includes("Overview")
            ? "DATA AS OF 9/1/2026 # of Components | 102"
            : "Weighting Company Name Security Symbol Log in for Full Access";
        }
      };
    }
  });
  assert.equal(urls.length, 2);
  assert.equal(result.status, "authorized_export_required");
  assert.equal(JSON.stringify(result).includes("<html"), false);
});
