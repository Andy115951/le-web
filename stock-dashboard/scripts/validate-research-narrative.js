const fs = require("fs");
const path = require("path");
const { validateResearchNarrative } = require("../lib/research-narrative-contract");

const packetPath = process.argv[2];
const narrativePath = process.argv[3];
if (!packetPath || !narrativePath) {
  process.stderr.write("Usage: node scripts/validate-research-narrative.js <research-packet.json> <narrative.json>\n");
  process.exitCode = 1;
} else {
  try {
    const packet = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), packetPath), "utf8"));
    const narrative = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), narrativePath), "utf8"));
    const validation = validateResearchNarrative(narrative, packet.packet || packet);
    process.stdout.write(JSON.stringify(validation, null, 2) + "\n");
    if (!validation.valid) process.exitCode = 2;
  } catch (error) {
    process.stderr.write((error?.message || String(error)) + "\n");
    process.exitCode = 1;
  }
}
