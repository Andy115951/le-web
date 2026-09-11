import { getCard } from "@/data/deck";
import { SCENES, CUSTOM_SCENE, TONE_BASELINE } from "@/data/scenes";
import type { FollowUpInput, InterpretInput } from "@/lib/ai/types";
import {
  contentForAI,
  hasSubCardInMessages,
  parseSubCardMessage,
} from "@/lib/sub-card-message";

export function sceneTone(scene: string): string {
  const s = [...SCENES, CUSTOM_SCENE].find((x) => x.id === scene);
  return s?.tonePrompt ?? CUSTOM_SCENE.tonePrompt;
}

export function describeSpread(spreadResult: InterpretInput["spreadResult"]): string {
  return spreadResult.cards
    .map((c) => {
      const card = getCard(c.cardId);
      const orient = c.reversed ? "逆位" : "正位";
      const meaning = card
        ? c.reversed
          ? card.reversed
          : card.upright
        : "";
      const label = `${card?.nameZh ?? c.cardId}（${orient}）`;
      const body = meaning
        ? meaning.replace(new RegExp(`^${card?.nameZh ?? ""}[正逆]位[：:]?`), "").trim() || meaning
        : "";
      return body
        ? `【${c.positionLabel}】${label}：${body}`
        : `【${c.positionLabel}】${label}`;
    })
    .join("\n");
}

const OUTPUT_RULES = [
  "产品名 Candle Taro；输出中禁止出现「塔罗」二字，可用占卜、牌阵、解读、起卦。",
  "用途：娱乐与自我反思；文末可轻点免责，勿喧宾夺主。",
  TONE_BASELINE,
  "牌义以提供的摘要为准，可延伸意象，勿编造与牌库明显冲突的含义。",
].join("\n");

export function interpretSystemPrompt(input: InterpretInput): string {
  const level =
    input.detailLevel === "brief"
      ? "简要：总览一两句 + 关键牌意 + 一句综合；控制篇幅。"
      : "详细：总览、分牌叙事、综合、可执行的一小步建议；意象可更满，仍忌绝对预言。";
  return [
    "你是 Candle Taro 的占卜解读顾问，语气仪式、温和、神秘而不夸张。",
    OUTPUT_RULES,
    `场景语气：${sceneTone(input.scene)}`,
    level,
  ].join("\n");
}

export function interpretUserPrompt(input: InterpretInput): string {
  return [
    `问题：${input.question}`,
    `场景：${input.scene}`,
    `解读档：${input.detailLevel === "brief" ? "简要" : "详细"}`,
    "本局牌面（含牌义摘要）：",
    describeSpread(input.spreadResult),
    "请基于以上牌面完成本局解读。",
  ].join("\n");
}

export function followUpSystemPrompt(input: FollowUpInput): string {
  const historyHasSub = hasSubCardInMessages(input.history);
  const currentHasSub = parseSubCardMessage(input.userMessage).meta != null;
  const subCardRule =
    historyHasSub || currentHasSub
      ? "若追问含【象征】子牌（子牌阵），将其视为锚定本轮追问的额外象征牌，仍以本局主牌阵为根基回应；勿当作新的完整起卦或另开一局解读。"
      : "";
  return [
    "你是 Candle Taro 的追问顾问。仍以本局牌阵为锚，像持续顾问对话般回应。",
    OUTPUT_RULES,
    `场景语气：${sceneTone(input.scene)}`,
    "若用户明显换成全新主题，可温和建议点「新占卜」再起一卦，不强制。",
    subCardRule,
  ]
    .filter(Boolean)
    .join("\n");
}

export function followUpMessages(input: FollowUpInput): {
  role: "user" | "assistant";
  content: string;
}[] {
  const anchor = [
    `本局问题：${input.question}`,
    "本局牌面：",
    describeSpread(input.spreadResult),
  ].join("\n");

  const history = input.history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        m.role === "user" ? contentForAI(m.content) : m.content,
    }));

  return [
    { role: "user" as const, content: anchor },
    { role: "assistant" as const, content: "已收到本局牌阵，我会以此为锚回应你的追问。" },
    ...history,
    { role: "user" as const, content: contentForAI(input.userMessage) },
  ];
}
