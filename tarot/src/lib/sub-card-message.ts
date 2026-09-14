import { getCard } from "@/data/deck";

export type SubCardMeta = {
  cardId: string;
  reversed: boolean;
  /** Position label, e.g. 象征 / 象征一 */
  positionLabel: string;
};

export const DEFAULT_SUB_CARD_PROMPT =
  "请结合这张象征牌，回应我此刻的追问。";

export const DEFAULT_SUB_CHAIN_PROMPT =
  "请结合这三条象征牌链，回应我此刻的追问。";

const SINGLE_HEADER_RE =
  /^⟦SUBCARD⟧([^|]+)\|([01])\|([^\n]*)\n?([\s\S]*)$/;

/** ⟦SUBCHAIN⟧id|rev|label;id|rev|label;id|rev|label\n{text} */
const CHAIN_HEADER_RE =
  /^⟦SUBCHAIN⟧([^\n]+)\n?([\s\S]*)$/;

const CHAIN_SLOT_RE = /^([^|]+)\|([01])\|(.*)$/;

export type ParsedSubSpread = {
  kind: "single" | "chain" | null;
  /** 0 for plain text; 1 for single; 3 for chain */
  cards: SubCardMeta[];
  text: string;
};

export function encodeSubCardMessage(
  meta: SubCardMeta,
  text: string,
): string {
  const body = text.trim() || DEFAULT_SUB_CARD_PROMPT;
  const rev = meta.reversed ? "1" : "0";
  const label = meta.positionLabel || "象征";
  return `⟦SUBCARD⟧${meta.cardId}|${rev}|${label}\n${body}`;
}

export function encodeSubChainMessage(
  metas: SubCardMeta[],
  text: string,
): string {
  const body = text.trim() || DEFAULT_SUB_CHAIN_PROMPT;
  const slots = metas
    .map((m) => {
      const rev = m.reversed ? "1" : "0";
      const label = m.positionLabel || "象征";
      return `${m.cardId}|${rev}|${label}`;
    })
    .join(";");
  return `⟦SUBCHAIN⟧${slots}\n${body}`;
}

function parseChainSlots(raw: string): SubCardMeta[] | null {
  const parts = raw.split(";").filter(Boolean);
  if (parts.length === 0) return null;
  const cards: SubCardMeta[] = [];
  for (let i = 0; i < parts.length; i++) {
    const m = parts[i]!.match(CHAIN_SLOT_RE);
    if (!m) return null;
    cards.push({
      cardId: m[1]!,
      reversed: m[2] === "1",
      positionLabel: m[3] || `象征${["一", "二", "三"][i] ?? i + 1}`,
    });
  }
  return cards;
}

/** Unified parse for single SUBCARD, chain SUBCHAIN, or plain text. */
export function parseSubSpreadMessage(content: string): ParsedSubSpread {
  const chain = content.match(CHAIN_HEADER_RE);
  if (chain) {
    const cards = parseChainSlots(chain[1]!);
    if (cards && cards.length > 0) {
      return {
        kind: "chain",
        cards,
        text: (chain[2] ?? "").trimEnd(),
      };
    }
  }
  const single = content.match(SINGLE_HEADER_RE);
  if (single) {
    return {
      kind: "single",
      cards: [
        {
          cardId: single[1]!,
          reversed: single[2] === "1",
          positionLabel: single[3] || "象征",
        },
      ],
      text: (single[4] ?? "").trimEnd(),
    };
  }
  return { kind: null, cards: [], text: content };
}

/** @deprecated Prefer parseSubSpreadMessage; kept for single-card callers. */
export function parseSubCardMessage(content: string): {
  meta: SubCardMeta | null;
  text: string;
} {
  const parsed = parseSubSpreadMessage(content);
  if (parsed.kind === "single" && parsed.cards[0]) {
    return { meta: parsed.cards[0], text: parsed.text };
  }
  if (parsed.kind === "chain" && parsed.cards[0]) {
    // First card as meta for backward compat; use parseSubSpreadMessage for full chain
    return { meta: parsed.cards[0], text: parsed.text };
  }
  return { meta: null, text: content };
}

/** Human-readable line for AI prompts (never expose raw marker). */
export function formatSubCardForAI(meta: SubCardMeta): string {
  const card = getCard(meta.cardId);
  const orient = meta.reversed ? "逆位" : "正位";
  const name = card?.nameZh ?? meta.cardId;
  const meaning = card
    ? meta.reversed
      ? card.reversed
      : card.upright
    : "";
  const label = meta.positionLabel || "象征";
  const head = `【子牌阵·${label}】${name}（${orient}）`;
  return meaning ? `${head}：${meaning}` : head;
}

export function formatSubChainForAI(metas: SubCardMeta[]): string {
  const lines = metas.map((m, i) => {
    const card = getCard(m.cardId);
    const orient = m.reversed ? "逆位" : "正位";
    const name = card?.nameZh ?? m.cardId;
    const meaning = card ? (m.reversed ? card.reversed : card.upright) : "";
    const label = m.positionLabel || `象征${["一", "二", "三"][i] ?? i + 1}`;
    const head = `【象征牌链·${label}】${name}（${orient}）`;
    return meaning ? `${head}：${meaning}` : head;
  });
  return ["【象征牌链】三条短链，锚定本轮追问，仍以主牌阵为根基：", ...lines].join(
    "\n",
  );
}

/** Text shown in the user chat bubble (hides raw header). */
export function displayTextForUser(content: string): string {
  const parsed = parseSubSpreadMessage(content);
  if (!parsed.kind) return content;
  if (parsed.kind === "chain") {
    return parsed.text.trim() || DEFAULT_SUB_CHAIN_PROMPT;
  }
  return parsed.text.trim() || DEFAULT_SUB_CARD_PROMPT;
}

/** Convert stored message content to model-facing form. */
export function contentForAI(content: string): string {
  const parsed = parseSubSpreadMessage(content);
  if (!parsed.kind) return content;
  if (parsed.kind === "chain") {
    const userLine = parsed.text.trim() || DEFAULT_SUB_CHAIN_PROMPT;
    return `${formatSubChainForAI(parsed.cards)}\n用户：${userLine}`;
  }
  const meta = parsed.cards[0]!;
  const userLine = parsed.text.trim() || DEFAULT_SUB_CARD_PROMPT;
  return `${formatSubCardForAI(meta)}\n用户：${userLine}`;
}

export function hasSubCardInMessages(
  messages: { role: string; content: string }[],
): boolean {
  return messages.some(
    (m) =>
      m.role === "user" && parseSubSpreadMessage(m.content).kind != null,
  );
}

export const CHAIN_LABELS = ["象征一", "象征二", "象征三"] as const;
