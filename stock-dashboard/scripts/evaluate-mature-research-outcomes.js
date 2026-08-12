const { getSupabaseConfig } = require("../lib/supabase-server");
const { evaluateMatureResearchOutcomes } = require("../lib/research-outcome-evaluations");

evaluateMatureResearchOutcomes(getSupabaseConfig()).then(function (result) {
  console.log(JSON.stringify(result, null, 2));
}).catch(function (error) {
  console.error("Research outcome evaluation failed:", error?.message || error);
  process.exitCode = 1;
});
