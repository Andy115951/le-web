import { NextResponse, type NextRequest } from "next/server";

const ANON_COOKIE = "ct_anon";

function newAnonId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return `anon_${s}`;
}

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(ANON_COOKIE)?.value;
  if (existing) {
    return NextResponse.next();
  }

  // Mint once here and forward onto the request so route handlers /
  // ensureAnonymousId() see the same id (avoids a second Set-Cookie).
  const id = newAnonId();
  const requestHeaders = new Headers(request.headers);
  const prior = requestHeaders.get("cookie");
  requestHeaders.set(
    "cookie",
    prior ? `${prior}; ${ANON_COOKIE}=${id}` : `${ANON_COOKIE}=${id}`,
  );

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.cookies.set({
    name: ANON_COOKIE,
    value: id,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
