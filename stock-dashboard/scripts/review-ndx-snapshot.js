const fs = require("fs");
const path = require("path");
const { compareNdxSnapshots } = require("../lib/ndx-snapshot-review");
const { validateSnapshot } = require("../lib/ndx-snapshot-validation");

const projectRoot = path.resolve(__dirname, "..");
const snapshotDirectory = path.join(projectRoot, "data", "ndx");

function readSnapshot(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8"));
}

function findLatestBaseline() {
  const paths = fs.readdirSync(snapshotDirectory)
    .filter(function (name) { return name.endsWith(".json"); })
    .map(function (name) { return path.join(snapshotDirectory, name); });
  const snapshots = paths.map(function (filePath) {
    const snapshot = validateSnapshot(JSON.parse(fs.readFileSync(filePath, "utf8")));
    return { filePath, snapshot };
  });
  snapshots.sort(function (left, right) {
    return left.snapshot.effectiveDate.localeCompare(right.snapshot.effectiveDate);
  });
  if (!snapshots.length) throw new Error("No baseline snapshot found in data/ndx");
  return snapshots.at(-1);
}

function parseArguments(argv) {
  const args = argv.slice(2);
  const candidatePath = args.find(function (value) { return !value.startsWith("--"); });
  const baselineIndex = args.indexOf("--baseline");
  const outputIndex = args.indexOf("--output");
  if (!candidatePath) {
    throw new Error("Usage: node scripts/review-ndx-snapshot.js <candidate.json> [--baseline <snapshot.json>] [--output <report.json>]");
  }
  return {
    candidatePath,
    baselinePath: baselineIndex >= 0 ? args[baselineIndex + 1] : null,
    outputPath: outputIndex >= 0 ? args[outputIndex + 1] : null
  };
}

function main(argv = process.argv) {
  const options = parseArguments(argv);
  const baseline = options.baselinePath
    ? { filePath: path.resolve(process.cwd(), options.baselinePath), snapshot: validateSnapshot(readSnapshot(options.baselinePath)) }
    : findLatestBaseline();
  const candidate = validateSnapshot(readSnapshot(options.candidatePath));
  const report = {
    generatedAt: new Date().toISOString(),
    baselinePath: path.relative(projectRoot, baseline.filePath),
    candidatePath: path.relative(projectRoot, path.resolve(process.cwd(), options.candidatePath)),
    review: compareNdxSnapshots(baseline.snapshot, candidate)
  };
  const output = JSON.stringify(report, null, 2) + "\n";
  if (options.outputPath) {
    const outputPath = path.resolve(process.cwd(), options.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, output);
    process.stdout.write("Wrote " + path.relative(projectRoot, outputPath) + "\n");
  }
  process.stdout.write(output);
  return report;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write((error?.message || String(error)) + "\n");
    process.exitCode = 1;
  }
}

module.exports = { findLatestBaseline, main, parseArguments };
