const { getDailyResearchPacket } = require("../lib/daily-research-packet");
const { persistResearchPacketSnapshot } = require("../lib/research-packet-snapshots");
const { getSupabaseConfig } = require("../lib/supabase-server");

const date = process.argv[2];

getDailyResearchPacket(date).then(function (packet) {
  return persistResearchPacketSnapshot(getSupabaseConfig(), packet, packet.generatedAt);
}).then(function (result) {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}).catch(function (error) {
  process.stderr.write((error?.message || String(error)) + "\n");
  process.exitCode = 1;
});
