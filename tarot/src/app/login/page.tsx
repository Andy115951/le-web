import {
  isGithubOAuthConfigured,
  isGoogleOAuthConfigured,
} from "@/lib/auth/oauth";
import { LoginForm } from "./login-form";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  return (
    <LoginForm
      githubEnabled={isGithubOAuthConfigured()}
      googleEnabled={isGoogleOAuthConfigured()}
      initialError={sp.error ?? null}
    />
  );
}
