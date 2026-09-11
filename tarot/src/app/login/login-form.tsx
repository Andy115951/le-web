"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Props = {
  githubEnabled: boolean;
  googleEnabled: boolean;
  initialError?: string | null;
};

export function LoginForm({ githubEnabled, googleEnabled, initialError }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    initialError
      ? initialError === "oauth"
        ? "第三方登录未完成，请再试一次或使用用户名密码。"
        : initialError
      : "",
  );
  const [loading, setLoading] = useState(false);

  const showOauth = githubEnabled || googleEnabled;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "登录未成功，请再试一次。");
      router.push("/history");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录未成功，请再试一次。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "login" ? "欢迎回来" : "创建账号"}
        </h1>
        <p className="text-sm text-muted-foreground">
          登录后历史会合并到账号，每日额度提升为 10 次新占卜 / 100 次追问。访客也可直接起卦。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{mode === "login" ? "登录" : "注册"}</CardTitle>
          <CardDescription>
            {showOauth
              ? "用户名密码，或使用下方第三方账号。"
              : "用户名 + 密码即可，无需邮箱。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="u">用户名</Label>
              <Input
                id="u"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p">密码</Label>
              <Input
                id="p"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "请稍候…" : mode === "login" ? "登录" : "注册"}
            </Button>
          </form>

          {showOauth && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="shrink-0 text-xs text-muted-foreground">或使用</span>
                <Separator className="flex-1" />
              </div>
              <div className="grid gap-2">
                {githubEnabled && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href="/api/auth/oauth/github">使用 GitHub 继续</a>
                  </Button>
                )}
                {googleEnabled && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href="/api/auth/oauth/google">使用 Google 继续</a>
                  </Button>
                )}
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="link"
            className="mt-2 px-0"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "没有账号？注册" : "已有账号？登录"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
