import { NextResponse } from "next/server";
import { getTarotAI } from "@/lib/ai";
import {
  ndjsonStreamResponse,
  streamOptionsFromReq,
  wantsStream,
} from "@/lib/ai/ndjson-stream";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import {
  QUOTAS,
  addMessage,
  bumpUsage,
  canAccessReading,
  getReading,
  getUsage,
  listMessages,
  updateReadingStatus,
} from "@/lib/store/readings";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const text = String(body.content || "").trim();
    if (text.length < 1 || text.length > 500) {
      return NextResponse.json({ error: "消息长度不合适" }, { status: 400 });
    }
    const user = await getCurrentUser();
    const anon = await ensureAnonymousId();
    const subject = user ? `user:${user.id}` : `anon:${anon}`;
    const usage = await getUsage(subject);
    const quota = user ? QUOTAS.user : QUOTAS.guest;
    if (usage.messages >= quota.messages) {
      return NextResponse.json(
        {
          error: user
            ? "今日追问额度已用尽，可以先回看这卦，或明天再续。"
            : "访客追问额度已用尽，请登录后继续。",
          code: "quota",
          usage,
          quota,
        },
        { status: 429 },
      );
    }
    const reading = await getReading(id);
    if (!reading || !(await canAccessReading(reading, user?.id ?? null, anon))) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    await addMessage(id, "user", text);
    await bumpUsage(subject, "message");
    const history = await listMessages(id);
    const ai = getTarotAI();
    const softHint = /换个问题|另一件事|完全不同/.test(text);

    if (!wantsStream(req)) {
      const reply = await ai.followUp({
        question: reading.question,
        scene: reading.scene,
        spreadResult: reading.spreadResult,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        userMessage: text,
      });
      let content = reply;
      if (softHint) {
        content += "\n\n若这已是新的议题，建议点「新占卜」重新起卦。";
      }
      await addMessage(id, "assistant", content);
      await updateReadingStatus(id, "ready_for_followup");
      const messages = await listMessages(id);
      return NextResponse.json({ messages });
    }

    const options = streamOptionsFromReq(req);
    return ndjsonStreamResponse(async (write) => {
      let content = "";
      for await (const delta of ai.followUpStream(
        {
          question: reading.question,
          scene: reading.scene,
          spreadResult: reading.spreadResult,
          history: history.map((m) => ({ role: m.role, content: m.content })),
          userMessage: text,
        },
        options,
      )) {
        content += delta;
        write({ t: "delta", c: delta });
      }
      content = content.trim();
      if (softHint) {
        const hint = "\n\n若这已是新的议题，建议点「新占卜」重新起卦。";
        content += hint;
        write({ t: "delta", c: hint });
      }
      if (!content) throw new Error("回复为空");
      await addMessage(id, "assistant", content);
      await updateReadingStatus(id, "ready_for_followup");
      const messages = await listMessages(id);
      write({ t: "done", messages });
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "发送失败" },
      { status: 500 },
    );
  }
}
