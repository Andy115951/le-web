const { buildDerivedRebuildPlan, parseDerivedRebuildArgs, runDerivedRebuild } = require("../lib/derived-rebuild-plan");

async function main() {
  const input = parseDerivedRebuildArgs(process.argv.slice(2));
  const plan = buildDerivedRebuildPlan(input.symbol);
  if (!input.approved) {
    process.stdout.write(JSON.stringify({ ok: true, dryRun: true, ...plan, next: "Re-run with --approve to write the three derived datasets." }, null, 2) + "\n");
    return;
  }
  const result = await runDerivedRebuild(input.symbol);
  process.stdout.write(JSON.stringify({ ok: true, dryRun: false, plan, result }, null, 2) + "\n");
}

main().catch(function (error) {
  process.stderr.write((error?.message || String(error)) + "\n");
  process.exitCode = 1;
});
