/**
 * Sanitize post-login redirect paths (same-origin relative only).
 * Rejects protocol-relative, absolute URLs, and junk.
 */
export function safeNextPath(
  raw: string | null | undefined,
  fallback = "/history",
): string {
  if (!raw) return fallback;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  const path = decoded.trim();
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (path.includes("://")) return fallback;
  if (path.includes("\\")) return fallback;
  // Keep query/hash; block obvious escapes
  if (/[\s<>'"]/.test(path)) return fallback;
  return path;
}

export function loginHref(next?: string | null) {
  const n = next ? safeNextPath(next, "") : "";
  if (!n) return "/login";
  return `/login?next=${encodeURIComponent(n)}`;
}

export function oauthHref(
  provider: "github" | "google",
  next?: string | null,
) {
  const base = `/api/auth/oauth/${provider}`;
  const n = next ? safeNextPath(next, "") : "";
  if (!n) return base;
  return `${base}?next=${encodeURIComponent(n)}`;
}
