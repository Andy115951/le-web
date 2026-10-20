import { NextResponse } from "next/server";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { parseHistoryQuery } from "@/lib/history-query";
import { listHistoryPage } from "@/lib/store/history";

// POST carries device-local favorite IDs without exposing them in browser URLs.
// This endpoint is read-only and never trusts a client-supplied owner ID.
export async function POST(request: Request) {
  let query;
  try {
    const body = await request.text();
    if (body.length > 100_000) throw new Error("筛选内容过长");
    query = parseHistoryQuery(JSON.parse(body));
  } catch {
    return NextResponse.json(
      { error: "筛选条件无效，请清除筛选后重试。" },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  try {
    const user = await getCurrentUser();
    const anon = user ? null : await ensureAnonymousId();
    const result = await listHistoryPage(
      { userId: user?.id, anonymousId: anon },
      query,
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "烛火晃了一下，没能取回历史，请稍后重试。" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
