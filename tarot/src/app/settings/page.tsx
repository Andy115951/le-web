import Link from "next/link";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { PRODUCT_NAME } from "@/data/scenes";
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
        <p className="mt-1 text-sm text-muted-foreground">
          账号、默认仪式与解读、今日额度
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">账号</CardTitle>
          <CardDescription>
            {user ? `已登录：${user.username}` : "当前为访客 · 登录后历史自动合并"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {user ? (
            <p className="text-sm text-muted-foreground">
              登录用户每日额度更高；退出可在页眉完成。
            </p>
          ) : (
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
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>访客每天 1 次新占卜、约 5 次追问；登录后 10 / 100。</p>
          <p>默认解读档与仪式速度保存在本机，每局仍可临时修改。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">关于 {PRODUCT_NAME}</CardTitle>
          <CardDescription>娱乐与自我反思</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            解读由顾问生成，仅供参考，不构成确定预言。牌阵是当下的一面镜子，决定仍在你手里。
          </p>
          <p>
            对外文案用「占卜 / 牌阵 / 解读」；可用「分享牌阵」复制本局摘要（不含账号信息）。
          </p>
          <p className="text-xs opacity-80">
            主题切换明显时，顾问可能温和建议点「新占卜」再起一卦，不强制。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
