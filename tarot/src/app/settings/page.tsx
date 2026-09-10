import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          默认解读档、仪式速度等将在此保存（P5 前用本地占位）
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">默认解读</CardTitle>
          <CardDescription>简要 / 详细</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          即将接入
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">默认仪式速度</CardTitle>
          <CardDescription>慢 / 常 / 快（不可跳过）</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          即将接入
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">账号</CardTitle>
          <CardDescription>用户名密码登录 · 访客额度</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          即将接入（P5）
        </CardContent>
      </Card>
    </div>
  );
}
