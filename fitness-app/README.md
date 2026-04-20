# fitness-app

基于 `Vercel + Supabase` 的个人健身执行系统（纯前端单页）。

## 目录

```text
fitness-app/
  index.html
  api/
    env.js
  supabase/
    schema.sql
```

## 1) 在 Supabase 初始化数据库

1. 创建 Supabase Project。
2. 打开 `SQL Editor`，执行 `supabase/schema.sql`。
3. 在 `Authentication -> Providers` 启用 Email 登录（默认可用）。
4. 在 `Authentication -> URL Configuration` 中加上你的线上域名（以及本地调试地址）。

## 2) 配置环境变量（Vercel）

在 Vercel 项目里添加这两个环境变量：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

你也可以用 CLI：

```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
```

前端会在启动时请求 `/api/env`，由该 API 从环境变量读取并返回配置。

## 3) 本地联调

推荐使用 `vercel dev`（可读取本地 env）：

```bash
cd fitness-app
vercel dev
```

如果需要先拉取线上环境变量到本地：

```bash
vercel env pull .env.local
```

## 4) 部署到 Vercel

```bash
cd fitness-app
vercel --prod
```

部署后，记得在 Supabase 的 Auth URL 配置里补充你的 Vercel 域名。

## 说明

- 打卡、感受、腰围、备注都存 `daily_logs`（云端）。
- `status` 支持 `pending/complete/baseline/sick`。
- 周视图和历史记录都来自 Supabase 云端数据。
- 训练计划循环推进状态（`planDate/planIndex`）保存在浏览器 `localStorage`。
