import { NextResponse } from "next/server";
import { getTarotAI } from "@/lib/ai";
import {
  ndjsonStreamResponse,
  streamOptionsFromReq,
  wantsStream,
} from "@/lib/ai/ndjson-stream";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { drawSingleCard, drawSingleCards } from "@/lib/draw";
import {
  CHAIN_LABELS,
  DEFAULT_SUB_CARD_PROMPT,
  DEFAULT_SUB_CHAIN_PROMPT,
  encodeSubCardMessage,
  encodeSubChainMessage,
} from "@/lib/sub-card-message";
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

type SubSpreadKind = "single" | "chain" | null;

function parseSubSpread(raw: unknown): SubSpreadKind {
  if (raw === "single") return "single";
  if (raw === "chain") return "chain";
  return null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const rawContent = String(body.content ?? "");
    const text = rawContent.trim();
    const subSpread = parseSubSpread(body.subSpread);

    if (subSpread === "single" || subSpread === "chain") {
      if (text.length > 500) {
        return NextResponse.json({ error: "消息长度不合适" }, { status: 400 });
      }
    } else if (text.length < 1 || text.length > 500) {
      return NextResponse.json({ error: "消息长度不合适" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const anon = await ensureAnonymousId();
    const subject = user ? `user:${user.id}` : `anon:${anon}`;
    const usage = await getUsage(subject);
    const quota = user ? QUOTAS.user : QUOTAS.guest;
    const cost = subSpread === "chain" ? 3 : 1;
    const remaining = quota.messages - usage.messages;

    if (remaining < cost) {
      const chainShort =
        subSpread === "chain"
          ? remaining < 3
            ? "抽象征牌链需要至少 3 次追问额度，今日剩余不足。"
            : null
          : null;
      return NextResponse.json(
        {
          error:
            chainShort ??
            (user
              ? "今日追问额度已用尽，可以先回看这卦，或明天再续。"
              : "访客追问额度已用尽，请登录后继续。"),
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

    let storedContent: string;
    let visibleText: string;

    if (subSpread === "single") {
      const exclude = reading.spreadResult.cards.map((c) => c.cardId);
      const drawn = drawSingleCard(exclude);
      visibleText = text || DEFAULT_SUB_CARD_PROMPT;
      storedContent = encodeSubCardMessage(
        {
          cardId: drawn.cardId,
          reversed: drawn.reversed,
          positionLabel: drawn.positionLabel,
        },
        text,
      );
    } else if (subSpread === "chain") {
      const exclude = reading.spreadResult.cards.map((c) => c.cardId);
      const drawn = drawSingleCards(3, exclude);
      visibleText = text || DEFAULT_SUB_CHAIN_PROMPT;
      storedContent = encodeSubChainMessage(
        drawn.map((d, i) => ({
          cardId: d.cardId,
          reversed: d.reversed,
          positionLabel: CHAIN_LABELS[i] ?? d.positionLabel,
        })),
        text,
      );
    } else {
      storedContent = text;
      visibleText = text;
    }

    await addMessage(id, "user", storedContent);
    await bumpUsage(subject, "message", cost);
    const history = await listMessages(id);
    const ai = getTarotAI();
    const softHint = /换个问题|另一件事|完全不同/.test(visibleText);

    if (!wantsStream(req)) {
      const reply = await ai.followUp({
        question: reading.question,
        scene: reading.scene,
        spreadResult: reading.spreadResult,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        userMessage: storedContent,
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
          userMessage: storedContent,
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
