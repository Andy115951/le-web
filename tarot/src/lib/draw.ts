import { randomBytes } from "crypto";
import { TAROT_DECK } from "@/data/deck";
import type { SpreadType } from "@/data/scenes";
import type { DrawnCard, SpreadResult } from "@/lib/types";

function secureShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const buf = randomBytes(4);
    const j = buf.readUInt32BE(0) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function coinFlip(): boolean {
  return randomBytes(1)[0]! % 2 === 1;
}

const THREE = [
  { position: "past", positionLabel: "过去" },
  { position: "present", positionLabel: "现在" },
  { position: "future", positionLabel: "未来" },
] as const;

const SINGLE = [{ position: "focus", positionLabel: "启示" }] as const;

/** 情境五牌（五牌十字）：现状 / 挑战 / 过去影响 / 近期走向 / 建议 */
const FIVE_CROSS = [
  { position: "situation", positionLabel: "现状" },
  { position: "challenge", positionLabel: "挑战" },
  { position: "past_influence", positionLabel: "过去影响" },
  { position: "near_future", positionLabel: "近期走向" },
  { position: "advice", positionLabel: "建议" },
] as const;

function positionsFor(spread: SpreadType) {
  if (spread === "single") return SINGLE;
  if (spread === "five_cross") return FIVE_CROSS;
  return THREE;
}

export function drawSpread(spread: SpreadType): SpreadResult {
  const positions = positionsFor(spread);
  const shuffled = secureShuffle(TAROT_DECK);
  const cards: DrawnCard[] = positions.map((p, i) => ({
    position: p.position,
    positionLabel: p.positionLabel,
    cardId: shuffled[i]!.id,
    reversed: coinFlip(),
  }));
  return { spread, cards };
}
