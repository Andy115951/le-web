import { NextResponse } from "next/server";
import { CUSTOM_SCENE, SCENES, type DetailLevel, type RitualSpeed, type SceneId, type SpreadType } from "@/data/scenes";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { QUOTAS, bumpUsage, createReading, getUsage, listReadings } from "@/lib/store/readings";

export async function GET() {
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const readings = await listReadings({
    userId: user?.id,
    anonymousId: user ? null : anon,
  });
  return NextResponse.json({ readings });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await getCurrentUser();
    const anon = await ensureAnonymousId();
    const subject = user ? `user:${user.id}` : `anon:${anon}`;
    const usage = await getUsage(subject);
    const quota = user ? QUOTAS.user : QUOTAS.guest;
    if (usage.readings >= quota.readings) {
      return NextResponse.json(
        {
          error: user
            ? "今日新占卜额度已用尽，明天再来点亮一盏吧。"
            : "访客今日起卦额度已用尽，请登录后继续。",
          code: "quota",
          usage,
          quota,
        },
        { status: 429 },
      );
    }
    const question = String(body.question || "").trim();
    if (question.length < 4 || question.length > 200) {
      return NextResponse.json({ error: "问题长度需在 4–200 字" }, { status: 400 });
    }
    const scene = (body.scene || "custom") as SceneId;
    const known = [...SCENES, CUSTOM_SCENE].some((s) => s.id === scene);
    if (!known) return NextResponse.json({ error: "未知场景" }, { status: 400 });
    const allowedSpreads: SpreadType[] = [
      "three_card",
      "single",
      "five_cross",
      "relation_dual",
      "choice_fork",
      "moon_triad",
    ];
    const rawSpread = (body.spreadType || "three_card") as SpreadType;
    if (!allowedSpreads.includes(rawSpread)) {
      return NextResponse.json({ error: "未知牌阵" }, { status: 400 });
    }
    const spreadType = rawSpread;
    const detailLevel = (body.detailLevel || "brief") as DetailLevel;
    const ritualSpeed = (body.ritualSpeed || "normal") as RitualSpeed;
    const reading = await createReading({
      userId: user?.id ?? null,
      anonymousId: anon,
      question,
      scene,
      spreadType,
      detailLevel,
      ritualSpeed,
    });
    await bumpUsage(subject, "reading");
    return NextResponse.json({ reading });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "创建失败" },
      { status: 500 },
    );
  }
}
