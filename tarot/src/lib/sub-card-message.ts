import { getCard } from "@/data/deck";

export type SubCardMeta = {
  cardId: string;
  reversed: boolean;
  /** Position label, e.g. 象征 */
  positionLabel: string;
};

export const DEFAULT_SUB_CARD_PROMPT =
  "请结合这张象征牌，回应我此刻的追问。";

const HEADER_RE = /^⟦SUBCARD⟧([^|]+)\|([01])\|([^\n]*)\n?([\s\S]*)$/;

export function encodeSubCardMessage(
  meta: SubCardMeta,
  text: string,
): string {
  const body = text.trim() || DEFAULT_SUB_CARD_PROMPT;
  const rev = meta.reversed ? "1" : "0";
  const label = meta.positionLabel || "象征";
  return `⟦SUBCARD⟧${meta.cardId}|${rev}|${label}\n${body}`;
}

export function parseSubCardMessage(content: string): {
  meta: SubCardMeta | null;
  text: string;
} {
  const m = content.match(HEADER_RE);
  if (!m) {
    return { meta: null, text: content };
  }
  return {
    meta: {
      cardId: m[1]!,
      reversed: m[2] === "1",
      positionLabel: m[3] || "象征",
    },
    text: (m[4] ?? "").trimEnd(),
  };
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

/** Text shown in the user chat bubble (hides raw header). */
export function displayTextForUser(content: string): string {
  const { meta, text } = parseSubCardMessage(content);
  if (!meta) return content;
  return text.trim() || DEFAULT_SUB_CARD_PROMPT;
}

/** Convert stored message content to model-facing form. */
export function contentForAI(content: string): string {
  const { meta, text } = parseSubCardMessage(content);
  if (!meta) return content;
  const userLine = text.trim() || DEFAULT_SUB_CARD_PROMPT;
  return `${formatSubCardForAI(meta)}\n用户：${userLine}`;
}

export function hasSubCardInMessages(
  messages: { role: string; content: string }[],
): boolean {
  return messages.some(
    (m) => m.role === "user" && parseSubCardMessage(m.content).meta != null,
  );
}
