import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getCookie, setCookie, clearCookie } from "@/lib/cookies";

export type OAuthProvider = "github" | "google";

export const OAUTH_STATE_COOKIE = "ct_oauth_state";

const STATE_TTL_MS = 10 * 60 * 1000;

function sessionSecret() {
  return process.env.SESSION_SECRET || "dev-insecure-session-secret";
}

function b64url(buf: Buffer | string) {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest();
}

export function isGithubOAuthConfigured() {
  return Boolean(
    process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET,
  );
}

export function isGoogleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

export function isProviderConfigured(provider: OAuthProvider) {
  return provider === "github" ? isGithubOAuthConfigured() : isGoogleOAuthConfigured();
}

/** Public origin for OAuth redirects (no trailing slash). */
export function getOAuthBaseUrl(req: Request): string {
  const configured = process.env.OAUTH_BASE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

export function oauthCallbackUrl(baseUrl: string) {
  return `${baseUrl}/api/auth/oauth/callback`;
}

export async function beginOAuthState(provider: OAuthProvider) {
  const nonce = randomBytes(16).toString("hex");
  const exp = Date.now() + STATE_TTL_MS;
  const payload = b64url(JSON.stringify({ p: provider, n: nonce, exp }));
  const sig = b64url(sign(payload));
  const token = `${payload}.${sig}`;
  await setCookie(OAUTH_STATE_COOKIE, token, Math.floor(STATE_TTL_MS / 1000));
  return token;
}

export async function consumeOAuthState(
  stateFromQuery: string | null,
): Promise<OAuthProvider | null> {
  if (!stateFromQuery) return null;
  const cookieVal = await getCookie(OAUTH_STATE_COOKIE);
  await clearCookie(OAUTH_STATE_COOKIE);
  if (!cookieVal || cookieVal !== stateFromQuery) return null;

  const [payload, sig] = stateFromQuery.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  let got: Buffer;
  try {
    got = fromB64url(sig);
  } catch {
    return null;
  }
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;

  let parsed: { p?: string; exp?: number };
  try {
    parsed = JSON.parse(fromB64url(payload).toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed.exp || parsed.exp < Date.now()) return null;
  if (parsed.p !== "github" && parsed.p !== "google") return null;
  return parsed.p;
}

export type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  usernameHint: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export async function exchangeGithubCode(
  code: string,
  redirectUri: string,
): Promise<OAuthProfile> {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET!;
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || "GitHub token exchange failed");
  }
  const headers = {
    Authorization: `Bearer ${tokenJson.access_token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "Candle-Taro",
  };
  const userRes = await fetch("https://api.github.com/user", { headers });
  if (!userRes.ok) throw new Error("GitHub user fetch failed");
  const user = (await userRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  };

  let email = user.email;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", { headers });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary =
        emails.find((e) => e.primary && e.verified) ||
        emails.find((e) => e.verified) ||
        emails[0];
      email = primary?.email ?? null;
    }
  }

  const loginSanitized = (user.login || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
  const usernameHint =
    loginSanitized.length >= 2 ? `gh_${loginSanitized}` : `gh_${user.id}`;

  return {
    provider: "github",
    providerUserId: String(user.id),
    usernameHint,
    displayName: user.name || user.login || null,
    email,
    avatarUrl: user.avatar_url,
  };
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<OAuthProfile> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || "Google token exchange failed");
  }
  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userRes.ok) throw new Error("Google userinfo fetch failed");
  const user = (await userRes.json()) as {
    sub: string;
    name?: string;
    email?: string;
    picture?: string;
    given_name?: string;
  };
  if (!user.sub) throw new Error("Google profile missing sub");

  // Google sub can be long — keep stable unique username within relaxed oauth length
  const idPart = user.sub.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
  const usernameHint = `go_${idPart}`;

  return {
    provider: "google",
    providerUserId: user.sub,
    usernameHint,
    displayName: user.name || user.given_name || user.email || null,
    email: user.email ?? null,
    avatarUrl: user.picture ?? null,
  };
}

export function githubAuthorizeUrl(baseUrl: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_OAUTH_CLIENT_ID!,
    redirect_uri: oauthCallbackUrl(baseUrl),
    scope: "read:user user:email",
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export function googleAuthorizeUrl(baseUrl: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: oauthCallbackUrl(baseUrl),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
