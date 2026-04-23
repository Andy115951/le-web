# mini-love-web

把微信小程序 `miniprogram-1` 迁移到 `Vercel + Supabase` 的 Web 版本（首版）。

## 已迁移功能

- 网关（检查是否注册）
- 注册（昵称 + 头像）
- 配对（6 位配对码）
- 首页（我的信息、对方信息、在一起天数、待回答统计）
- 每日问答（提问、回答）
- 历史记录（可按日期筛选）
- 设置（编辑昵称/头像、解除配对、退出登录）
- 社区论坛（发帖、看帖、评论）
- 消息（按用户 ID 发送与查看）
- 导航页（地铁路线搜索 + 常用地图入口）
- 链接管理（自定义链接新增/打开/删除，本地保存）

## 暂未迁移

- 天气/web-view 页面

## 目录

```text
mini-love-web/
  index.html
  api/env.js
  supabase/schema.sql
```

## 1) 初始化 Supabase

在 Supabase SQL Editor 执行：

- `supabase/schema.sql`

> 当前 schema 使用开放 RLS（demo 便于快速迁移验证）。
> 上线前建议改为严格 RLS + Auth。

## 2) 配置 Vercel 环境变量

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 3) 本地运行

```bash
cd mini-love-web
vercel dev
```

打开本地地址后，页面会通过 `/api/env` 自动读取 Supabase 配置。

## 4) 部署

```bash
cd mini-love-web
vercel --prod
```

## 迁移说明

- 小程序中的 `openid` 在 Web 版中改为 `device_id`（保存在 localStorage）。
- 小程序云函数被替换为前端直连 Supabase 的查询与写入。
- 数据模型核心保持一致：`users` + `questions`。
- 访问首页默认先进入“导航页”，再点击“进入我们的小世界”进入注册/配对/主流程。
