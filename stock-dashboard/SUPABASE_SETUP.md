# Stock Dashboard Supabase 迁移说明

## 1. 在 Supabase 执行建表 SQL

在 Supabase Dashboard 的 SQL Editor 执行下面语句：

```sql
create table if not exists public.watchlist_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  us_peaks jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.watchlist_states enable row level security;

drop policy if exists "watchlist_select_own" on public.watchlist_states;
create policy "watchlist_select_own"
on public.watchlist_states
for select
using (auth.uid() = user_id);

drop policy if exists "watchlist_insert_own" on public.watchlist_states;
create policy "watchlist_insert_own"
on public.watchlist_states
for insert
with check (auth.uid() = user_id);

drop policy if exists "watchlist_update_own" on public.watchlist_states;
create policy "watchlist_update_own"
on public.watchlist_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 2. 打开邮箱登录

在 Supabase Dashboard:

1. `Authentication -> Providers -> Email` 开启 Email。
2. 在 `URL Configuration` 中把你的访问地址加入 Redirect URLs。

本地开发建议加入：

- `http://localhost:xxxx`（你的本地端口）
- `https://mini-love-web.vercel.app`

## 3. 在看板里配置云端

打开股票看板页面后：

1. 在 `Supabase 云同步` 填 `Supabase URL` 和 `Anon Key`。
2. 点 `保存云配置`。
3. 输入邮箱，点 `发送登录链接`。
4. 邮箱里打开链接返回页面后，看状态变成 `已登录`。
5. 点 `从云端拉取` 或 `同步到云端`。

## 4. 迁移行为说明

- 云端已有数据：默认拉云端覆盖本地。
- 云端为空：自动把本地数据迁移到云端一次。
- 之后每次本地变更会自动后台同步云端。

## 5. 数据结构说明

- `items`: 自选列表
- `preferences`: 筛选/排序/分页/自动刷新偏好
- `us_peaks`: 美股峰值记录（用于计算回撤）
