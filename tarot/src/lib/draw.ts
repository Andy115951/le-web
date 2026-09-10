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
  return randomBytes(1)[0] % 2 === 1;
}

const THREE = [
  { position: "past", positionLabel: "过去" },
  { position: "present", positionLabel: "现在" },
  { position: "future", positionLabel: "未来" },
] as const;

const SINGLE = [{ position: "focus", positionLabel: "启示" }] as const;

export function drawSpread(spread: SpreadType): SpreadResult {
  const positions = spread === "single" ? SINGLE : THREE;
  const shuffled = secureShuffle(TAROT_DECK);
  const cards: DrawnCard[] = positions.map((p, i) => ({
    position: p.position,
    positionLabel: p.positionLabel,
    cardId: shuffled[i].id,
    reversed: coinFlip(),
  }));
  return { spread, cards };
}
