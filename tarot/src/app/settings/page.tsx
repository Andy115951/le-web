import Link from "next/link";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { QUOTAS, getUsage } from "@/lib/store/readings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsDefaultsForm } from "@/components/settings/settings-defaults-form";
import { getAiProviderLabel } from "@/lib/ai";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const subject = user ? `user:${user.id}` : `anon:${anon}`;
  const usage = await getUsage(subject);
  const quota = user ? QUOTAS.user : QUOTAS.guest;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">账号、默认选项与今日额度</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">账号</CardTitle>
          <CardDescription>
            {user ? `已登录：${user.username}` : "当前为访客"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? null : (
            <Button asChild>
              <Link href="/login">登录 / 注册</Link>
            </Button>
          )}
        </CardContent>
      </Card>
      <SettingsDefaultsForm />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">今日额度</CardTitle>
          <CardDescription>
            新占卜 {usage.readings}/{quota.readings} · 追问 {usage.messages}/
            {quota.messages}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          访客 1/5；登录后 10/100。默认解读档与仪式速度可在下方设置，每局也可临时修改。
        </CardContent>
      </Card>
      <AiProviderSection />
    </div>
  );
}

function AiProviderSection() {
  const provider = getAiProviderLabel();
  const isGateway = provider === "gateway";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI</CardTitle>
        <CardDescription>
          当前：{isGateway ? "gateway（Vercel AI Gateway）" : "mock（本地模板解读）"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          通过环境变量切换：<code className="text-foreground">AI_PROVIDER=mock</code>{" "}
          或 <code className="text-foreground">AI_PROVIDER=gateway</code>。
        </p>
        <p>
          Gateway 可选{" "}
          <code className="text-foreground">AI_GATEWAY_MODEL</code>（默认{" "}
          <code className="text-foreground">openai/gpt-5.4-mini</code>
          ）；本地可设{" "}
          <code className="text-foreground">AI_GATEWAY_API_KEY</code>，生产环境可用
          Vercel OIDC。Gateway 失败时会回退到 mock，避免解读硬崩。
        </p>
      </CardContent>
    </Card>
  );
}
