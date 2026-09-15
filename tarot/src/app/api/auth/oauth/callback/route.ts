import { NextResponse } from "next/server";
import {
  consumeOAuthState,
  exchangeGithubCode,
  exchangeGoogleCode,
  getOAuthBaseUrl,
  isProviderConfigured,
  oauthCallbackUrl,
} from "@/lib/auth/oauth";
import { safeNextPath } from "@/lib/auth/safe-next";
import {
  createSession,
  ensureAnonymousId,
  mergeAnonymousReadings,
  upsertOAuthUser,
} from "@/lib/auth/session";

function fail(base: string) {
  return NextResponse.redirect(new URL("/login?error=oauth", base));
}

export async function GET(req: Request) {
  const base = getOAuthBaseUrl(req);
  const url = new URL(req.url);
  const err = url.searchParams.get("error");
  if (err) return fail(base);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return fail(base);

  const consumed = await consumeOAuthState(state);
  if (!consumed || !isProviderConfigured(consumed.provider)) return fail(base);

  try {
    const redirectUri = oauthCallbackUrl(base);
    const profile =
      consumed.provider === "github"
        ? await exchangeGithubCode(code, redirectUri)
        : await exchangeGoogleCode(code, redirectUri);

    const anon = await ensureAnonymousId();
    const user = await upsertOAuthUser(profile);
    await createSession(user.id);
    await mergeAnonymousReadings(user.id, anon);
    const dest = safeNextPath(consumed.next, "/history");
    return NextResponse.redirect(new URL(dest, base));
  } catch (e) {
    console.error("[oauth/callback]", e);
    return fail(base);
  }
}
