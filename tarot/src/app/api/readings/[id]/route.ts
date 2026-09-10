import { NextResponse } from "next/server";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import {
  canAccessReading,
  getReading,
  listMessages,
  softDeleteReading,
} from "@/lib/store/readings";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const reading = await getReading(id);
  if (!reading || !(await canAccessReading(reading, user?.id ?? null, anon))) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  const messages = await listMessages(id);
  return NextResponse.json({ reading, messages });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const reading = await getReading(id);
  if (!reading || !(await canAccessReading(reading, user?.id ?? null, anon))) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  await softDeleteReading(id);
  return NextResponse.json({ ok: true });
}
