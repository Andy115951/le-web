import { NextResponse } from "next/server";
import {
  beginOAuthState,
  getOAuthBaseUrl,
  githubAuthorizeUrl,
  isGithubOAuthConfigured,
} from "@/lib/auth/oauth";

export async function GET(req: Request) {
  const base = getOAuthBaseUrl(req);
  if (!isGithubOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=oauth", base));
  }
  const state = await beginOAuthState("github");
  return NextResponse.redirect(githubAuthorizeUrl(base, state));
}
