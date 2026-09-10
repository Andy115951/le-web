import { createHash } from "crypto";
import { TAROT_DECK, type DeckCard } from "@/data/deck";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";

/** Asia/Shanghai calendar day YYYY-MM-DD */
export function shanghaiDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type DailyCardDraw = {
  day: string;
  cardId: string;
  reversed: boolean;
  card: DeckCard;
};

/**
 * Deterministic daily single-card draw for a subject.
 * Does not create a reading or touch quota.
 */
export function drawDailyCardForSubject(
  subjectKey: string,
  day = shanghaiDayKey(),
): DailyCardDraw {
  const seed = `${subjectKey}|${day}|candle-taro-daily`;
  const digest = createHash("sha256").update(seed).digest();
  const cardIndex = digest.readUInt32BE(0) % TAROT_DECK.length;
  const reversed = (digest[4] & 1) === 1;
  const card = TAROT_DECK[cardIndex];
  return { day, cardId: card.id, reversed, card };
}

export async function getTodayDailyCard(): Promise<DailyCardDraw> {
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const subject = user ? `user:${user.id}` : `anon:${anon}`;
  return drawDailyCardForSubject(subject);
}

export function dailyCardBlurb(draw: DailyCardDraw): string {
  return draw.reversed ? draw.card.reversed : draw.card.upright;
}

export function dailyCardKeywords(draw: DailyCardDraw): string {
  return draw.card.keywords.slice(0, 3).join(" · ");
}
