import { NextResponse } from "next/server";
import { CUSTOM_SCENE, SCENES } from "@/data/scenes";
import { getTarotAI } from "@/lib/ai";
import type { InterpretInput } from "@/lib/ai/types";
import {
  ndjsonStreamResponse,
  streamOptionsFromReq,
  wantsStream,
} from "@/lib/ai/ndjson-stream";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { questionPreview } from "@/lib/related-theme";
import {
  addMessage,
  canAccessReading,
  findPriorReadingByQuestion,
  findRelatedThemeReading,
  getReading,
  listMessages,
  updateReadingStatus,
} from "@/lib/store/readings";

type PriorCards = NonNullable<InterpretInput["priorHint"]>["cards"];

function mapCards(
  prior: { spreadResult: { cards: { positionLabel: string; cardId: string; reversed: boolean }[] } },
): PriorCards {
  return prior.spreadResult.cards.map((c) => ({
    positionLabel: c.positionLabel,
    cardId: c.cardId,
    reversed: c.reversed,
  }));
}

function sceneLabel(scene: string): string {
  return (
    [...SCENES, CUSTOM_SCENE].find((s) => s.id === scene)?.label ?? scene
  );
}

function buildPriorHint(
  prior: Awaited<ReturnType<typeof findPriorReadingByQuestion>>,
): InterpretInput["priorHint"] {
  if (!prior?.spreadResult) return null;
  return {
    createdAt: prior.createdAt,
    spread: prior.spreadResult.spread,
    cards: mapCards(prior),
  };
}

function buildRelatedThemeHint(
  prior: Awaited<ReturnType<typeof findRelatedThemeReading>>,
): InterpretInput["relatedThemeHint"] {
  if (!prior?.spreadResult) return null;
  return {
    createdAt: prior.createdAt,
    scene: sceneLabel(prior.scene),
    questionPreview: questionPreview(prior.question),
    spread: prior.spreadResult.spread,
    cards: mapCards(prior),
  };
}

export async function POST(
  req: Request,
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
    const existing = await listMessages(id);
    const hasAssistant = existing.some((m) => m.role === "assistant");
    if (hasAssistant) {
      if (wantsStream(req)) {
        return ndjsonStreamResponse(async (write) => {
          write({ t: "done", messages: existing });
        });
      }
      return NextResponse.json({ messages: existing, cached: true });
    }

    const prior = await findPriorReadingByQuestion({
      question: reading.question,
      userId: user?.id ?? null,
      anonymousId: anon,
      excludeId: id,
    });
    const priorHint = buildPriorHint(prior);

    // P49: related theme in recent days (not exact same question / not same prior)
    const related = await findRelatedThemeReading({
      question: reading.question,
      scene: reading.scene,
      userId: user?.id ?? null,
      anonymousId: anon,
      excludeId: id,
      excludeIds: prior ? [prior.id] : [],
    });
    const relatedThemeHint = buildRelatedThemeHint(related);

    const interpretInput: InterpretInput = {
      question: reading.question,
      scene: reading.scene,
      detailLevel: reading.detailLevel,
      spreadResult: reading.spreadResult,
      priorHint,
      relatedThemeHint,
    };

    if (!wantsStream(req)) {
      await updateReadingStatus(id, "interpreting");
      const ai = getTarotAI();
      const content = await ai.interpret(interpretInput);
      await addMessage(id, "assistant", content);
      await updateReadingStatus(id, "ready_for_followup");
      const messages = await listMessages(id);
      return NextResponse.json({ messages });
    }

    const options = streamOptionsFromReq(req);
    return ndjsonStreamResponse(async (write) => {
      await updateReadingStatus(id, "interpreting");
      const ai = getTarotAI();
      let content = "";
      for await (const delta of ai.interpretStream(interpretInput, options)) {
        content += delta;
        write({ t: "delta", c: delta });
      }
      content = content.trim();
      if (!content) throw new Error("解读为空");
      await addMessage(id, "assistant", content);
      await updateReadingStatus(id, "ready_for_followup");
      const messages = await listMessages(id);
      write({ t: "done", messages });
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "解读失败" },
      { status: 500 },
    );
  }
}
