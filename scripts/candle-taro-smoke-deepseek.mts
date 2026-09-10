import { deepseekAI, getDeepSeekConfig } from "../tarot/src/lib/ai/deepseek.ts";

const cfg = getDeepSeekConfig();
if (!cfg.configured) {
  console.error("not configured", cfg);
  process.exit(1);
}
console.log("ok config", cfg.model, cfg.baseURL);

const input = {
  question: "最近工作压力大，怎么调整心态？",
  scene: "career" as const,
  detailLevel: "brief" as const,
  spreadResult: {
    cards: [
      { cardId: "major_09", reversed: false, positionLabel: "过去" },
      { cardId: "major_17", reversed: false, positionLabel: "现在" },
      { cardId: "major_07", reversed: true, positionLabel: "建议" },
    ],
  },
};

let chunks = 0;
let chars = 0;
let sample = "";
for await (const part of deepseekAI.interpretStream(input as any)) {
  chunks += 1;
  chars += part.length;
  if (sample.length < 160) sample += part;
}
console.log(JSON.stringify({ chunks, chars, sample: sample.slice(0, 160) }));
if (chars < 20) process.exit(2);
