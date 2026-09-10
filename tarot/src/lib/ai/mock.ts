import { getCard } from "@/data/deck";
import { SCENES, CUSTOM_SCENE, TONE_BASELINE } from "@/data/scenes";
import type { FollowUpInput, InterpretInput, TarotAI } from "@/lib/ai/types";

function sceneTone(scene: string) {
  const s = [...SCENES, CUSTOM_SCENE].find((x) => x.id === scene);
  return s?.tonePrompt ?? CUSTOM_SCENE.tonePrompt;
}

function describeSpread(spreadResult: InterpretInput["spreadResult"]) {
  return spreadResult.cards
    .map((c) => {
      const card = getCard(c.cardId);
      const orient = c.reversed ? "逆位" : "正位";
      const meaning = card
        ? c.reversed
          ? card.reversed
          : card.upright
        : "";
      return `【${c.positionLabel}】${card?.nameZh ?? c.cardId}（${orient}）：${meaning}`;
    })
    .join("\n");
}

export const mockAI: TarotAI = {
  async interpret(input) {
    const lines = describeSpread(input.spreadResult);
    const brief =
      input.detailLevel === "brief"
        ? `总览：围绕「${input.question}」，牌面提示你先看清当下的节奏，再决定伸手的方向。\n\n${lines}\n\n综合：值得留意的是，把模糊的不安说清楚，会比急着下结论更有力量。\n\n（娱乐与自我反思用途；${TONE_BASELINE}）`
        : `总览：关于「${input.question}」，这一局像一盏被风吹动的烛火——晃，但还在。\n\n分牌：\n${lines}\n\n综合叙事：先承认已经走过的部分，再把注意力收回你真正能移动的一步。语气上，${sceneTone(input.scene)}\n\n建议：选一个最小的行动（或一个明确的暂停），观察三天。\n\n（娱乐与自我反思用途；禁止绝对预言。）`;
    return brief;
  },
  async followUp(input) {
    const tip = input.spreadResult.cards[0]
      ? getCard(input.spreadResult.cards[0].cardId)?.nameZh
      : "本局牌面";
    return `我仍以本局（尤其是 ${tip}）为锚来回应你：「${input.userMessage}」。\n\n可能的方向是：把问题拆成「我能影响的」与「我只能观察的」。若你其实在谈一个全新主题，也可以点「新占卜」再起一卦。\n\n（mock 解读；${sceneTone(input.scene)}）`;
  },
};
