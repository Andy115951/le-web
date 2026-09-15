import { getCard } from "@/data/deck";
import { SCENES, CUSTOM_SCENE, TONE_BASELINE } from "@/data/scenes";
import type { FollowUpInput, InterpretInput, TokenVerseInput } from "@/lib/ai/types";
import { spreadLabel } from "@/lib/spread-label";
import {
  contentForAI,
  hasSubCardInMessages,
  parseSubSpreadMessage,
} from "@/lib/sub-card-message";


/** Compact prior-card lines for P41 hint (name + 正/逆 only). */
export function describePriorCards(
  cards: NonNullable<InterpretInput["priorHint"]>["cards"],
): string {
  return cards
    .map((c) => {
      const card = getCard(c.cardId);
      const orient = c.reversed ? "逆位" : "正位";
      const name = card?.nameZh ?? c.cardId;
      return `【${c.positionLabel}】${name}（${orient}）`;
    })
    .join("\n");
}

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
  "格式：可用轻量 Markdown——短 ## 小节、**强调**、- 列表；小节标题优先中文。",
  "禁止：代码围栏（```）、表格、HTML、四级及以上标题（####+）；勿堆砌标题；篇幅仍克制。",
].join("\n");

const INTERPRET_STRUCTURE = [
  "解读结构（必须）：按固定顺序使用二级标题 ## 总览 → ## 牌意 → ## 综合；勿改用飘移小节名（如「开场/要点/小结」等）。",
  "简要档：压缩篇幅，仅上述三节；详细档：可在综合后加 ## 建议（一小步、可执行）。",
].join("\n");

export function interpretSystemPrompt(input: InterpretInput): string {
  const level =
    input.detailLevel === "brief"
      ? "简要：## 总览（一两句，场景口吻可辨）→ ## 牌意 → ## 综合（一句）；勿加 ## 建议；控制篇幅。"
      : "详细：## 总览（场景口吻可辨）→ ## 牌意（分牌叙事）→ ## 综合 → 可选 ## 建议（一小步）；意象可更满，仍忌绝对预言。";
  const priorBits: string[] = [];
  if (input.priorHint) {
    priorBits.push(
      "若有同题旧卦摘要，在 ## 总览 内轻提一句即可（勿复述旧解读全文、勿做成跨局长记忆聊天、勿绝对预言、仍以本局牌面为主）。",
    );
  }
  if (input.relatedThemeHint) {
    priorBits.push(
      "若有近几日相关主题旧卦摘要（非同句），可在 ## 总览 再轻提一句；勿复述旧解读、勿跨局长记忆；若同时有同题轻提，两句合计仍克制，勿铺陈。",
    );
  }
  const priorRule = priorBits.join("");
  return [
    "你是 Candle Taro 的占卜解读顾问，语气仪式、温和、神秘而不夸张。",
    OUTPUT_RULES,
    INTERPRET_STRUCTURE,
    `场景语气（必须可辨认，贯穿总览与综合，勿写成通用鸡汤）：${sceneTone(input.scene)}`,
    level,
    priorRule,
  ]
    .filter(Boolean)
    .join("\n");
}

export function interpretUserPrompt(input: InterpretInput): string {
  const parts = [
    `问题：${input.question}`,
    `场景：${input.scene}`,
    `解读档：${input.detailLevel === "brief" ? "简要" : "详细"}`,
    "本局牌面（含牌义摘要）：",
    describeSpread(input.spreadResult),
  ];
  if (input.priorHint) {
    const h = input.priorHint;
    parts.push(
      "同题上一卦（仅供轻提，勿当主解读）：",
      `时间：${h.createdAt}`,
      `牌阵：${spreadLabel(h.spread)}`,
      "牌面：",
      describePriorCards(h.cards),
    );
  }
  if (input.relatedThemeHint) {
    const h = input.relatedThemeHint;
    parts.push(
      "近几日相关主题一卦（仅供再轻提一句，勿当主解读、勿复述旧文）：",
      `时间：${h.createdAt}`,
      `场景：${h.scene}`,
      `问题摘要：${h.questionPreview}`,
      `牌阵：${spreadLabel(h.spread)}`,
      "牌面：",
      describePriorCards(h.cards),
    );
  }
  parts.push("请基于以上牌面完成本局解读。");
  return parts.join("\n");
}

export function followUpSystemPrompt(input: FollowUpInput): string {
  const historyHasSub = hasSubCardInMessages(input.history);
  const current = parseSubSpreadMessage(input.userMessage);
  const currentHasSub = current.kind != null;
  let subCardRule = "";
  if (historyHasSub || currentHasSub) {
    if (current.kind === "chain" || historyHasSub) {
      subCardRule =
        "若追问含【象征】子牌或【象征牌链】（三条短链），将其视为锚定本轮追问的额外象征，仍以本局主牌阵为根基回应；象征牌链是短象征链，勿当作新的完整起卦或另开一局解读。";
    } else {
      subCardRule =
        "若追问含【象征】子牌（子牌阵），将其视为锚定本轮追问的额外象征牌，仍以本局主牌阵为根基回应；勿当作新的完整起卦或另开一局解读。";
    }
  }
  return [
    "你是 Candle Taro 的追问顾问。仍以本局牌阵为锚，像持续顾问对话般回应。",
    OUTPUT_RULES,
    `场景语气（必须可辨认，勿写成通用鸡汤）：${sceneTone(input.scene)}`,
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


export function tokenVerseSystemPrompt(): string {
  return [
    "你是 Candle Taro 的短签写手：为「烛火信物」壁纸写 1–2 行中文短签。",
    OUTPUT_RULES,
    "只输出短签正文，不要标题、引号、免责声明或解释。",
    "语气神秘、意象化；禁止绝对预言（必将/一定会等）；可用可能/倾向/值得留意。",
    "总长约 16–40 字，最多两行（可用换行）。",
  ].join("\n");
}

export function tokenVerseUserPrompt(input: TokenVerseInput): string {
  const card = getCard(input.cardId);
  const orient = input.reversed ? "逆位" : "正位";
  const name = card?.nameZh ?? input.cardId;
  const meaning = card
    ? input.reversed
      ? card.reversed
      : card.upright
    : "";
  const keywords = card?.keywords?.join("、") ?? "";
  return [
    `问题：${input.question}`,
    `场景：${input.scene}`,
    `焦点位：${input.positionLabel}`,
    `牌：${name}（${orient}）`,
    keywords ? `关键词：${keywords}` : "",
    meaning ? `牌义摘要：${meaning}` : "",
    "请写一句可贴在烛光壁纸上的短签。",
  ]
    .filter(Boolean)
    .join("\n");
}
