import { NextResponse } from "next/server";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { publicShareAbsoluteUrl, publicSharePath } from "@/lib/public-share";
import {
  canAccessReading,
  disablePublicShare,
  enablePublicShare,
  getReading,
  listMessages,
} from "@/lib/store/readings";

function originFrom(req: Request) {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

async function requireOwner(id: string) {
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const reading = await getReading(id);
  if (!reading || !(await canAccessReading(reading, user?.id ?? null, anon))) {
    return { error: NextResponse.json({ error: "未找到" }, { status: 404 }) } as const;
  }
  return { reading } as const;
}

/** Owner: current share status. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const gate = await requireOwner(id);
    if ("error" in gate) return gate.error;
    const token = gate.reading.publicShareToken;
    const enabled = Boolean(token);
    return NextResponse.json({
      enabled,
      path: token ? publicSharePath(token) : null,
      url: token ? publicShareAbsoluteUrl(token, originFrom(req)) : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "查询失败" },
      { status: 500 },
    );
  }
}

/** Owner: enable (or rotate) public share link. Requires at least one assistant message. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const gate = await requireOwner(id);
    if ("error" in gate) return gate.error;

    const messages = await listMessages(id);
    if (!messages.some((m) => m.role === "assistant")) {
      return NextResponse.json(
        { error: "解读尚未完成，短链还在烛影里酝酿。" },
        { status: 400 },
      );
    }

    const updated = await enablePublicShare(id);
    if (!updated?.publicShareToken) {
      return NextResponse.json({ error: "未能开启短链" }, { status: 500 });
    }
    const token = updated.publicShareToken;
    return NextResponse.json({
      enabled: true,
      path: publicSharePath(token),
      url: publicShareAbsoluteUrl(token, originFrom(req)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "开启失败" },
      { status: 500 },
    );
  }
}

/** Owner: disable / invalidate public share link. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const gate = await requireOwner(id);
    if ("error" in gate) return gate.error;
    await disablePublicShare(id);
    return NextResponse.json({ enabled: false, path: null, url: null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "关闭失败" },
      { status: 500 },
    );
  }
}
