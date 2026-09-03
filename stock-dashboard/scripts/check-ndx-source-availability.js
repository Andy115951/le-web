/**
 * Read-only official NDX source availability check.
 *
 * Makes at most one GET request to each public Nasdaq page. It never downloads
 * an export, creates a candidate file, writes Supabase, or calls a model.
 */
const {
  NDX_OVERVIEW_URL,
  NDX_WEIGHTING_URL,
  buildNdxSourceAvailability
} = require("../lib/ndx-source-availability");

async function readPage(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "text/html,application/xhtml+xml" },
      redirect: "follow"
    });
    return {
      status: Number(response?.status) || 0,
      body: response?.ok ? await response.text() : ""
    };
  } catch (_error) {
    // Network detail is intentionally not printed by this maintenance check.
    return { status: 0, body: "" };
  }
}

async function main(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  const [overview, weighting] = await Promise.all([
    readPage(fetchImpl, NDX_OVERVIEW_URL),
    readPage(fetchImpl, NDX_WEIGHTING_URL)
  ]);
  return buildNdxSourceAvailability({
    checkedAt: options.checkedAt || new Date().toISOString(),
    overviewStatus: overview.status,
    overviewBody: overview.body,
    weightingStatus: weighting.status,
    weightingBody: weighting.body
  });
}

if (require.main === module) {
  main().then(function (result) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }).catch(function (error) {
    process.stderr.write("ndx source check failed: " + (error?.message || String(error)) + "\n");
    process.exitCode = 1;
  });
}

module.exports = { main, readPage };
