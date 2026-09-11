import { NextResponse } from "next/server";
import {
  beginOAuthState,
  getOAuthBaseUrl,
  googleAuthorizeUrl,
  isGoogleOAuthConfigured,
} from "@/lib/auth/oauth";

export async function GET(req: Request) {
  const base = getOAuthBaseUrl(req);
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=oauth", base));
  }
  const state = await beginOAuthState("google");
  return NextResponse.redirect(googleAuthorizeUrl(base, state));
}
