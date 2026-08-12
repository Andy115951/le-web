const { getSupabaseConfig } = require("../lib/supabase-server");
const { captureRecentFredObservations } = require("../lib/fred-macro");

captureRecentFredObservations(getSupabaseConfig()).then(function (result) {
  process.stdout.write(JSON.stringify({
    seriesIds: result.seriesIds,
    observationsCaptured: result.observations.length,
    eventsWritten: result.eventsWritten,
    sourcesWritten: result.sourcesWritten
  }, null, 2) + "\n");
}).catch(function (error) {
  process.stderr.write((error?.message || String(error)) + "\n");
  process.exitCode = 1;
});
