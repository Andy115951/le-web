import { cookies } from "next/headers";

export const SESSION_COOKIE = "ct_session";
export const ANON_COOKIE = "ct_anon";
export const SESSION_DAYS = 30;

export async function getCookie(name: string) {
  const jar = await cookies();
  return jar.get(name)?.value ?? null;
}

export async function setCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
) {
  const jar = await cookies();
  jar.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearCookie(name: string) {
  const jar = await cookies();
  jar.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
}
