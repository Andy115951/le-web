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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">关于解读</CardTitle>
        <CardDescription>娱乐与自我反思</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        解读由顾问生成，仅供参考，不构成确定预言。牌阵是当下的一面镜子，决定仍在你手里。
      </CardContent>
    </Card>
  );
}
