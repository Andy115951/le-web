import { getCard } from "@/data/deck";
import { chunkText } from "@/lib/ai/chunk";
import type {
  FollowUpInput,
  InterpretInput,
  StreamOptions,
  TarotAI,
} from "@/lib/ai/types";
import { describeSpread } from "@/lib/ai/prompts";

const DISCLAIMER = "以上解读供娱乐与自我反思，并不构成确定预言。";

function sceneClosing(scene: string): string {
  switch (scene) {
    case "love":
      return "把此刻的情绪轻轻说清楚，往往比急着下结论更靠近彼此。";
    case "career":
      return "先分清哪一步真正在你手里，再谈更大的取舍。";
    case "study":
      return "卡点说出来以后，通常只需要一个很小、能做完的下一步。";
    case "social":
      return "看看互动里你习惯扮演的位置，再决定要不要微调。";
    case "choice":
      return "两边都摆到眼前时，身体先倾向的那一侧，值得多听一会儿。";
    case "body":
      return "先照顾最明显的那一处紧绷，比一次修好全部更现实。";
    default:
      return "把模糊的不安说清楚，会比急着定论更有力量。";
  }
}

async function interpretText(input: InterpretInput): Promise<string> {
  const lines = describeSpread(input.spreadResult);
  if (input.detailLevel === "brief") {
    return [
      `总览：围绕「${input.question}」，牌面更像在请你先看清节奏，再决定伸手的方向。`,
      "",
      lines,
      "",
      `综合：${sceneClosing(input.scene)}`,
      "",
      DISCLAIMER,
    ].join("\n");
  }
  return [
    `总览：关于「${input.question}」，这一局像一盏被风吹动的烛火——晃，但还在。`,
    "",
    "分牌：",
    lines,
    "",
    "综合：先承认已经走过的部分，再把注意力收回你真正能移动的一步。",
    sceneClosing(input.scene),
    "",
    "建议：选一个最小的行动（或一个明确的暂停），观察三天。",
    "",
    DISCLAIMER,
  ].join("\n");
}

async function followUpText(input: FollowUpInput): Promise<string> {
  const tip = input.spreadResult.cards[0]
    ? getCard(input.spreadResult.cards[0].cardId)?.nameZh
    : null;
  const anchor = tip ? `尤其是「${tip}」` : "本局牌面";
  return [
    `我仍以本局（${anchor}）为锚来听你说的：「${input.userMessage}」。`,
    "",
    "可能的方向是：把问题拆成「我能影响的」与「我只能观察的」。前者试一小步，后者允许暂时只看着。",
    sceneClosing(input.scene),
    "",
    "若你其实在谈一个全新主题，也可以点「新占卜」再起一卦。",
  ].join("\n");
}

export const mockAI: TarotAI = {
  async interpret(input) {
    return interpretText(input);
  },
  async followUp(input) {
    return followUpText(input);
  },
  async *interpretStream(input, options?: StreamOptions) {
    yield* chunkText(await interpretText(input), options);
  },
  async *followUpStream(input, options?: StreamOptions) {
    yield* chunkText(await followUpText(input), options);
  },
};
