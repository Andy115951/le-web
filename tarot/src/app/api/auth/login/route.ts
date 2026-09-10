import { NextResponse } from "next/server";
import { ensureAnonymousId, loginUser, mergeAnonymousReadings } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
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
