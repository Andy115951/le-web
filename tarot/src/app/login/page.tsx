import {
  isGithubOAuthConfigured,
  isGoogleOAuthConfigured,
} from "@/lib/auth/oauth";
import { safeNextPath } from "@/lib/auth/safe-next";
import { LoginForm } from "./login-form";

type SearchParams = Promise<{ error?: string; next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next, "");
  return (
    <LoginForm
      githubEnabled={isGithubOAuthConfigured()}
      googleEnabled={isGoogleOAuthConfigured()}
      initialError={sp.error ?? null}
      nextPath={next || null}
    />
  );
}
