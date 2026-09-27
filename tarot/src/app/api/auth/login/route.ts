import { NextResponse } from "next/server";
import { ensureAnonymousId, loginUser, mergeAnonymousReadings } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    let body: { username?: unknown; password?: unknown };
    try {
      body = (await req.json()) as { username?: unknown; password?: unknown };
    } catch {
      return NextResponse.json({ error: "无效请求" }, { status: 400 });
    }
    const anon = await ensureAnonymousId();
    const user = await loginUser(String(body.username || ""), String(body.password || ""));
    await mergeAnonymousReadings(user.id, anon);
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "登录失败" },
      { status: 400 },
    );
  }
}
