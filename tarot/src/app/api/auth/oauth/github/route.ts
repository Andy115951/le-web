import { NextResponse } from "next/server";
import {
  beginOAuthState,
  getOAuthBaseUrl,
  githubAuthorizeUrl,
  isGithubOAuthConfigured,
} from "@/lib/auth/oauth";
import { safeNextPath } from "@/lib/auth/safe-next";

export async function GET(req: Request) {
  const base = getOAuthBaseUrl(req);
  if (!isGithubOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=oauth", base));
  }
  const url = new URL(req.url);
  const next = safeNextPath(url.searchParams.get("next"), "");
  const state = await beginOAuthState("github", next || null);
  return NextResponse.redirect(githubAuthorizeUrl(base, state));
}
