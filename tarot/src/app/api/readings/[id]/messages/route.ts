import { NextResponse } from "next/server";
import { getTarotAI } from "@/lib/ai";
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
        { error: user ? "今日追问次数已用完" : "访客追问额度已用完，请登录", code: "quota" },
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
    const reply = await ai.followUp({
      question: reading.question,
      scene: reading.scene,
      spreadResult: reading.spreadResult,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      userMessage: text,
    });
    // soft suggest new reading if keywords
    let content = reply;
    if (/换个问题|另一件事|完全不同/.test(text)) {
      content += "\n\n若这已是新的议题，建议点「新占卜」重新起卦。";
    }
    await addMessage(id, "assistant", content);
    await updateReadingStatus(id, "ready_for_followup");
    const messages = await listMessages(id);
    return NextResponse.json({ messages });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "发送失败" },
      { status: 500 },
    );
  }
}
