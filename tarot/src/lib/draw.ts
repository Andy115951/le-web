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

/** 关系双人：我方 / 对方 / 关系纽带 */
const RELATION_DUAL = [
  { position: "self", positionLabel: "我方" },
  { position: "other", positionLabel: "对方" },
  { position: "bond", positionLabel: "关系纽带" },
] as const;

/** 抉择分叉：路径甲 / 路径乙 / 关键建议 */
const CHOICE_FORK = [
  { position: "path_a", positionLabel: "路径甲" },
  { position: "path_b", positionLabel: "路径乙" },
  { position: "counsel", positionLabel: "关键建议" },
] as const;

/** 月相三问：隐流 / 显象 / 应时之举 */
const MOON_TRIAD = [
  { position: "undertow", positionLabel: "隐流" },
  { position: "apparition", positionLabel: "显象" },
  { position: "timely_act", positionLabel: "应时之举" },
] as const;

/** 凯尔特十字（十位）：现状 / 挑战 / 根基 / 近况 / 可能显化 / 近前 / 自我 / 环境 / 希冀与隐忧 / 综合走向 */
const CELTIC_CROSS = [
  { position: "present", positionLabel: "现状" },
  { position: "cross", positionLabel: "挑战" },
  { position: "foundation", positionLabel: "根基" },
  { position: "recent_past", positionLabel: "近况" },
  { position: "crown", positionLabel: "可能显化" },
  { position: "near_future", positionLabel: "近前" },
  { position: "self", positionLabel: "自我" },
  { position: "environment", positionLabel: "环境" },
  { position: "hopes_fears", positionLabel: "希冀与隐忧" },
  { position: "outcome", positionLabel: "综合走向" },
] as const;

function positionsFor(spread: SpreadType) {
  if (spread === "single") return SINGLE;
  if (spread === "five_cross") return FIVE_CROSS;
  if (spread === "relation_dual") return RELATION_DUAL;
  if (spread === "choice_fork") return CHOICE_FORK;
  if (spread === "moon_triad") return MOON_TRIAD;
  if (spread === "celtic_cross") return CELTIC_CROSS;
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

/** Draw one symbolic card, preferring cards not already in the main spread. */
export function drawSingleCard(excludeCardIds: string[] = []): DrawnCard {
  const exclude = new Set(excludeCardIds);
  const available = TAROT_DECK.filter((c) => !exclude.has(c.id));
  const pool = available.length > 0 ? available : [...TAROT_DECK];
  const shuffled = secureShuffle(pool);
  const picked = shuffled[0]!;
  return {
    position: "symbol",
    positionLabel: "象征",
    cardId: picked.id,
    reversed: coinFlip(),
  };
}
