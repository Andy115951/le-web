# quadrant-todo

基于 `Vercel + Supabase` 的四象限 Todo 工具。

## 目录

```text
quadrant-todo/
  index.html
  app.js
  styles.css
  api/
    env.js
    auth/
    tasks/
    _lib/
  supabase/
    schema.sql
```

## 环境变量

在 Vercel 项目中配置：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_REGISTRATION`：可选，默认 `true`

## 初始化数据库

在 Supabase SQL Editor 执行：

- `supabase/schema.sql`

## 本地联调

```bash
cd quadrant-todo
npm install
vercel dev
```

## 部署

```bash
cd quadrant-todo
vercel --prod
```
