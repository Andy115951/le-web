# Stock Dashboard Supabase 云同步说明

## 1. 在 Supabase 执行建表 SQL

在 Supabase Dashboard 的 SQL Editor 执行下面语句：

```sql
create table if not exists public.watchlist_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  us_peaks jsonb not null default '{}'::jsonb,
  market_events jsonb not null default '[]'::jsonb,
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

如果表已经创建过，只需要额外执行这一条迁移：

```sql
alter table public.watchlist_states
add column if not exists market_events jsonb not null default '[]'::jsonb;
```

### 行情历史表

执行下面 SQL，保存每日收盘涨跌、`QQQ` 对照与可复核新闻证据：

```sql
create table if not exists public.market_event_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  market_date date not null,
  symbol text not null,
  display_name text not null,
  change_percent numeric,
  benchmark_change_percent numeric,
  driver_type text not null default 'unclear',
  confidence text not null default 'low',
  summary text not null default '',
  reasons jsonb not null default '[]'::jsonb,
  news jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, market_date, symbol),
  check (driver_type in ('market', 'company', 'mixed', 'unclear')),
  check (confidence in ('high', 'medium', 'low'))
);

create index if not exists market_event_history_user_date_idx
on public.market_event_history (user_id, market_date desc);

alter table public.market_event_history enable row level security;

drop policy if exists "market_history_select_own" on public.market_event_history;
create policy "market_history_select_own"
on public.market_event_history
for select
using (auth.uid() = user_id);

drop policy if exists "market_history_insert_own" on public.market_event_history;
create policy "market_history_insert_own"
on public.market_event_history
for insert
with check (auth.uid() = user_id);

drop policy if exists "market_history_update_own" on public.market_event_history;
create policy "market_history_update_own"
on public.market_event_history
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

### 采集运行日志表

`market_capture_runs` 保存每次定时任务或手动重跑的运行状态，用于判断任务是否启动、跳过、部分失败或完整失败。其正式定义位于：

- `supabase/migrations/20260812141057_add_market_capture_runs.sql`

该表包含：

- `trigger_type`: `cron` 或 `manual`
- `status`: `running / succeeded / partial / skipped / failed`
- `market_date`、开始/结束时间和耗时
- 来源用户数、成功用户数、跳过用户数、失败用户数和写入事件数
- 截断后的错误摘要与非敏感诊断详情

该表启用 RLS，不给 `anon` 和 `authenticated` 角色访问权限，只允许服务端 Secret Key 管理。浏览器不能直接读取运维日志。

## 2. 打开邮箱登录

在 Supabase Dashboard:

1. `Authentication -> Providers -> Email` 开启 Email。
2. 在 `URL Configuration` 中把你的访问地址加入 Redirect URLs。

本地开发建议加入：

- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:3002`

线上建议加入：

- `https://stock-dashboard-psi-henna.vercel.app`

## 3. 在看板里配置云端

打开股票看板页面后：

1. 在 `Supabase 云同步` 填 `Supabase URL` 和 `Anon Key`。
2. 点 `保存云配置`。
3. 输入邮箱，点 `发送登录链接`。
4. 邮箱里打开链接返回页面后，看状态变成 `已登录`。
5. 点 `从云端拉取` 或 `同步到云端`。

## 4. 多设备开发时怎么接手

这个项目当前的云同步配置不是通过服务端环境变量注入，而是：

- 在页面里输入 `Supabase URL`
- 在页面里输入 `Anon Key`
- 保存到浏览器本地

所以换一台设备后，需要重新做一次：

1. 打开本地或线上页面
2. 填 `Supabase URL`
3. 填 `Supabase Anon Key`
4. 点 `保存云配置`
5. 用邮箱 magic link 登录

注意：

- 这些输入值保存在当前浏览器的 `localStorage`
- 不会通过 git 自动同步到另一台设备
- 当前页面不会使用 `Supabase Secret Key`
- 行情历史的定时补抓会在服务端使用 Secret Key，浏览器拿不到这个值

## 5. 本地开发建议

如果你要在新设备本地联调：

```bash
cd /Users/apple/Documents/code/other/le-web/stock-dashboard
vercel login
vercel link
vercel dev
```

说明：

- `分析` 功能依赖 `api/` 本地函数
- 所以不要只用静态文件方式打开
- 应优先使用 `vercel dev`

## 6. 迁移行为说明

- 云端已有数据：默认拉云端覆盖本地。
- 云端为空：自动把本地数据迁移到云端一次。
- 之后每次本地变更会自动后台同步云端。

## 7. 数据结构说明

- `items`: 自选列表
- `preferences`: 筛选/排序/分页/自动刷新偏好
- `us_peaks`: 全市场峰值记录（用于计算较峰值回撤，字段名为历史遗留）
- `market_events`: 最近 14 天的自动行情事件。每只股票每天保留一条最新快照，包含当日涨跌、`QQQ` 对照、关联资讯与来源链接。

当前 `items` 里除了基础字段外，还会保存这些持仓上下文字段：

- `costBasis`: 成本价
- `shares`: 股数
- `holdingType`: 持仓类型（`watchlist / core / trading`）

所以如果你在一台设备补了持仓数据，同步后另一台设备也会直接拿到，用于生成“我的持仓上下文”和“今日决策摘要”。

行情事件也会随着普通云同步保存。迁移未执行前，看板会自动降级为只同步原有数据，不会影响自选股和持仓同步；执行迁移后，事件才能跨设备保留。

`market_event_history` 是长期历史表：同一用户、同一交易日、同一股票只保留一条最新快照。这样即使定时任务重复运行，也只会更新当天记录，不会产生重复数据。

## 8. 开启每日收盘自动归档

`vercel.json` 已配置为每个工作日 `22:00 UTC` 触发一次，覆盖美东冬夏令时的收盘后时段。Hobby 计划的 Cron 每天最多运行一次，且可能在该小时内的任意时间执行，因此选用这个较晚的窗口。

在 Vercel 项目的 `Settings -> Environment Variables` 添加以下 **Production** 变量：

- `SUPABASE_URL`: Supabase Project URL
- `SUPABASE_SECRET_KEY`: Supabase 的 `sb_secret_...` Secret Key，只给服务端 Cron 使用
- `CRON_SECRET`: 至少 16 位随机字符串，用于验证 Vercel Cron 请求

本地可复制 [`.env.example`](.env.example) 为 `.env.local` 填写测试值；`.env.local` 已被 git 忽略。不要把 Secret Key 或 Cron Secret 写进前端、README 示例或 git。Secret Key 通过 `apikey` 请求头发送，不能作为 `Authorization: Bearer` JWT 使用。

部署后可在 Vercel 项目的 `Settings -> Cron Jobs` 查看 `/api/cron/capture-market-history`。首次也可以等下一次交易日收盘，或在本地通过带 `Authorization: Bearer <CRON_SECRET>` 的请求测试。

授权的 `POST /api/cron/capture-market-history` 可手动重跑当前最近交易日；授权的 `GET /api/cron/market-history-runs?limit=20` 可查看最近运行记录。两个接口都不能暴露到浏览器公开调用。
