import { cookies } from "next/headers";

export const SESSION_COOKIE = "ct_session";
export const ANON_COOKIE = "ct_anon";
export const SESSION_DAYS = 30;

export async function getCookie(name: string) {
  const jar = await cookies();
  return jar.get(name)?.value ?? null;
}

/** Returns false if cookies cannot be mutated in this context (e.g. RSC page). */
export async function setCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
): Promise<boolean> {
  try {
    const jar = await cookies();
    jar.set(name, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: maxAgeSeconds,
    });
    return true;
  } catch {
    return false;
  }
}

export async function clearCookie(name: string): Promise<boolean> {
  try {
    const jar = await cookies();
    jar.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
    return true;
  } catch {
    return false;
  }
}
