import { NextResponse } from "next/server";
import { getTarotAI } from "@/lib/ai";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import {
  canAccessReading,
  getReading,
  listMessages,
} from "@/lib/store/readings";

/** Prefer explicit focus card; otherwise first card of the spread. */
function focalCard(reading: Awaited<ReturnType<typeof getReading>>) {
  if (!reading) return null;
  const cards = reading.spreadResult.cards;
  const focus =
    cards.find((c) => c.position === "focus") ??
    cards.find((c) => c.position === "situation") ??
    cards[0];
  return focus ?? null;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const user = await getCurrentUser();
    const anon = await ensureAnonymousId();
    const reading = await getReading(id);
    if (!reading || !(await canAccessReading(reading, user?.id ?? null, anon))) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    const messages = await listMessages(id);
    const hasAssistant = messages.some((m) => m.role === "assistant");
    if (!hasAssistant) {
      return NextResponse.json(
        { error: "解读尚未完成，信物还在烛影里酝酿。" },
        { status: 400 },
      );
    }
    const focal = focalCard(reading);
    if (!focal) {
      return NextResponse.json({ error: "本局没有可用的焦点牌" }, { status: 400 });
    }

    const ai = getTarotAI();
    let verse = await ai.tokenVerse({
      question: reading.question,
      scene: reading.scene,
      spreadResult: reading.spreadResult,
      cardId: focal.cardId,
      reversed: focal.reversed,
      positionLabel: focal.positionLabel,
    });
    verse = verse
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("\n")
      .slice(0, 80);

    if (!verse) {
      return NextResponse.json({ error: "短签没能落定，请稍后再试。" }, { status: 500 });
    }

    return NextResponse.json({
      verse,
      cardId: focal.cardId,
      reversed: focal.reversed,
      positionLabel: focal.positionLabel,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "信物生成失败" },
      { status: 500 },
    );
  }
}
