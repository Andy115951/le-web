import { NextResponse } from "next/server";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import {
  canAccessReading,
  getReading,
  listMessages,
  renameReading,
  softDeleteReading,
} from "@/lib/store/readings";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isReadingId(value: string) {
  return UUID_PATTERN.test(value);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!isReadingId(id)) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const reading = await getReading(id);
  if (!reading || !(await canAccessReading(reading, user?.id ?? null, anon))) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  const messages = await listMessages(id);
  return NextResponse.json({ reading, messages });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!isReadingId(id)) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const reading = await getReading(id);
  if (!reading || !(await canAccessReading(reading, user?.id ?? null, anon))) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  let body: { title?: unknown };
  try {
    body = (await req.json()) as { title?: unknown };
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }
  await renameReading(id, title);
  const updated = await getReading(id);
  return NextResponse.json({ reading: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!isReadingId(id)) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const reading = await getReading(id);
  if (!reading || !(await canAccessReading(reading, user?.id ?? null, anon))) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  await softDeleteReading(id);
  return NextResponse.json({ ok: true });
}
