const fs = require("fs");
const path = require("path");
const { validateSnapshot } = require("../lib/ndx-snapshot-validation");

const candidateDirectory = path.resolve(__dirname, "..", "data", "ndx", "candidates");

function discoverNdxCandidates(directory = candidateDirectory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter(function (name) { return name.endsWith(".json"); })
    .map(function (name) {
      const filePath = path.join(directory, name);
      const snapshot = validateSnapshot(JSON.parse(fs.readFileSync(filePath, "utf8")));
      return {
        file: path.relative(path.resolve(__dirname, ".."), filePath),
        effectiveDate: snapshot.effectiveDate,
        publishedAt: snapshot.publishedAt,
        sourceUrl: snapshot.sourceUrl,
        constituentCount: snapshot.constituents.length,
        isProForma: snapshot.isProForma
      };
    })
    .sort(function (left, right) { return left.effectiveDate.localeCompare(right.effectiveDate); });
}

if (require.main === module) {
  try {
    process.stdout.write(JSON.stringify({ candidates: discoverNdxCandidates() }, null, 2) + "\n");
  } catch (error) {
    process.stderr.write((error?.message || String(error)) + "\n");
    process.exitCode = 1;
  }
}

module.exports = { discoverNdxCandidates };
