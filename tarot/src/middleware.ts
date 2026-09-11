import { NextResponse, type NextRequest } from "next/server";

const ANON_COOKIE = "ct_anon";

function newAnonId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return `anon_${s}`;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.get(ANON_COOKIE)?.value) {
    response.cookies.set({
      name: ANON_COOKIE,
      value: newAnonId(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
