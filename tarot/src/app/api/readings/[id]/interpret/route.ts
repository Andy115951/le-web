import { NextResponse } from "next/server";
import { getTarotAI } from "@/lib/ai";
import {
  ndjsonStreamResponse,
  streamOptionsFromReq,
  wantsStream,
} from "@/lib/ai/ndjson-stream";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import {
  addMessage,
  canAccessReading,
  getReading,
  listMessages,
  updateReadingStatus,
} from "@/lib/store/readings";

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

    if (!wantsStream(req)) {
      await updateReadingStatus(id, "interpreting");
      const ai = getTarotAI();
      const content = await ai.interpret({
        question: reading.question,
        scene: reading.scene,
        detailLevel: reading.detailLevel,
        spreadResult: reading.spreadResult,
      });
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
      for await (const delta of ai.interpretStream(
        {
          question: reading.question,
          scene: reading.scene,
          detailLevel: reading.detailLevel,
          spreadResult: reading.spreadResult,
        },
        options,
      )) {
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
