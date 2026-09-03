export function shouldBypassPwaCache(pathname) {
  const path = String(pathname || "");
  return path === "/api" || path.startsWith("/api/") || path === "/auth" || path.startsWith("/auth/");
}

export function isPwaStaticAsset({ destination = "", pathname = "" } = {}) {
  return ["style", "script", "image"].includes(destination)
    || /\.(?:css|js|mjs|svg|png|webmanifest)$/i.test(String(pathname));
}

export function isPwaCacheableNavigationResponse(response) {
  if (!response?.ok) return false;
  const contentType = String(response.headers?.get?.("content-type") || "");
  return /^text\/html(?:;|$)/i.test(contentType);
}
