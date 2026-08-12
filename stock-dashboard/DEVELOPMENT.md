# Stock Dashboard 开发手册

本文档面向本地开发、Supabase 初始化、Vercel 部署和每日行情历史任务维护。产品功能与进度概览见 [README.md](README.md)，完整产品路线图见 [ROADMAP.md](ROADMAP.md)，数据库完整 SQL 见 [SUPABASE_SETUP.md](SUPABASE_SETUP.md)。

## 当前环境状态（2026-08-12）

当前 Windows 开发机已经完成：

- Node.js 22 可用
- Vercel CLI 已安装
- Supabase CLI `2.113.0` 已安装到 `%LOCALAPPDATA%\Programs\Supabase`
- Docker Desktop 已安装
- Supabase CLI 已完成登录
- 当前目录已执行 `supabase init`
- 当前目录已关联 Supabase 项目 `ougpvpolmzsmaljscruo`（Singapore）
- `supabase/.temp` 已被忽略，不会提交本机链接信息
- 服务端归档代码已迁移到新版 `SUPABASE_SECRET_KEY`

当前 Mac 开发机已经完成：

- Node.js `22.22.2` 通过 NVM 管理，项目内 `.nvmrc` 和 `package.json` 固定为 Node 22
- Vercel CLI `54.18.7` 已登录并关联 `stock-dashboard`
- Supabase CLI 已升级到 `2.113.0` 并关联项目 `ougpvpolmzsmaljscruo`
- Docker Desktop `29.2.1` 已启动
- 正式 migration 已创建，远程表、约束、Data API 权限和 RLS 已通过 Management API 应用并验证
- Vercel Production 已配置 `SUPABASE_URL`、`SUPABASE_SECRET_KEY` 和 `CRON_SECRET`
- 本机 `.env.local` 已配置为仅当前用户可读，并被 Git 忽略
- 生产部署和 Cron 鉴权已验证，固定地址为 `https://stock-dashboard-psi-henna.vercel.app`

当前剩余环境事项：

- [ ] 当前网络没有公网 IPv6，`supabase db push --linked` 无法直连数据库；Schema 已通过 `supabase db query --linked --file` 应用，但仍需在具备 IPv6 或 Pooler 数据库密码时登记 migration 历史
- [x] 公共 `nasdaq_market_event_history` 已建表并完成 14 个核心标的真实写入
- [x] Cron 运行日志、失败诊断、手动重跑和最近运行记录接口
- [x] Nasdaq 核心行情/新闻入口已与个人自选解耦，无登录也可运行

页面、API、事件规则和数据库开发现在都可进行；当前未完成项不会阻塞下一批代码开发。

## 1. 当前系统边界

当前项目以 `QQQ` / Nasdaq-100 核心市场雷达为主，个人自选和持仓为辅助层，主要由四部分组成：

- 浏览器页面：原生 `HTML + CSS + ES Modules`
- 浏览器状态：`localStorage`
- 云同步：`Supabase Auth + Postgres`
- 服务端：`Vercel Functions + Vercel Cron`

页面可以静态显示，但美股/A 股分析、当日事件和每日历史归档依赖 `api/` 下的 Vercel Functions。因此，完整本地开发必须使用 `vercel dev`，不能只双击 `index.html`。

## 2. 目录与数据流

关键目录：

```text
stock-dashboard/
├─ index.html                         页面结构
├─ app.js                            主交互与看板渲染
├─ storage.js                        localStorage 状态与默认股票
├─ cloud.js                          Supabase 登录和云同步
├─ quotes.js                         页面行情请求
├─ api/
│  ├─ a-share/detail.js              A 股分析接口
│  ├─ global-stock/detail.js         美股分析接口
│  ├─ global-stock/daily-events.js   当日市场事件接口
│  ├─ nasdaq/history.js              公共 Nasdaq 历史读取接口
│  └─ cron/capture-market-history.js 收盘后历史归档入口
├─ lib/
│  ├─ a-share-data.js                A 股数据层
│  ├─ global-stock-data.js           美股数据层
│  ├─ daily-market-events.js         QQQ 对照、新闻与事件规则
│  ├─ nasdaq-universe.js             默认核心观察宇宙与来源日期
│  └─ market-history-capture.js      Supabase 服务端写入逻辑
├─ supabase/
│  └─ config.toml                    Supabase 本地项目配置
├─ vercel.json                       Cron 时间配置
├─ .env.example                      服务端环境变量模板
└─ SUPABASE_SETUP.md                 建表、RLS 与登录配置
```

当前公共雷达的数据流：

```text
Browser refresh
  → GET /api/global-stock/daily-events（无需 symbols）
  → 使用 lib/nasdaq-universe.js 的默认核心观察宇宙
  → 抓取 QQQ、核心成分行情和近 36 小时新闻
  → 标题相关性过滤 + 标题聚合去重
  → 页面新闻流 + localStorage 最近 14 天日度脉络
```

收盘历史任务数据流：

```text
Vercel Cron
  → GET /api/cron/capture-market-history
  → 校验 Authorization: Bearer <CRON_SECRET>
  → 抓取默认 Nasdaq 核心观察宇宙
  → 按 market_date + symbol 写入 nasdaq_market_event_history
  → 可选读取 watchlist_states，兼容写入个人 market_event_history
```

## 3. 开发前置条件

建议环境：

- Windows PowerShell 或 PowerShell 7
- Node.js 22（当前已验证环境为 Node.js 22）
- 可访问 Vercel 和 Supabase
- 已有 `stock-dashboard` Vercel 项目权限
- 已有目标 Supabase 项目权限

仓库根目录已安装 Vercel CLI 依赖，因此可以在 `stock-dashboard` 目录直接使用 `npx vercel`，无需再全局安装。

### 新设备接入检查清单

另一台电脑拉取代码后，按下面顺序确认。前一项未通过时，先不要继续排查后一项：

1. 在 `stock-dashboard` 目录确认 Node 主版本为 22：`node --version`。
2. 使用 `npx vercel login` 登录有项目权限的 Vercel 账号。
3. 使用 `npx vercel link` 关联现有的 `stock-dashboard`，不要创建同名新项目。
4. 使用 `supabase login` 登录有数据库权限的 Supabase 账号。
5. 使用 `supabase link --project-ref ougpvpolmzsmaljscruo` 关联现有项目。
6. 运行 `npx vercel env ls`，确认 Production 存在三项服务端变量；这里只检查变量名，不应尝试打印值。
7. 只有本地测试 Cron 或服务端归档时才配置 `.env.local`；普通页面和行情 API 开发不需要 Secret Key。
8. 运行 `npx vercel dev`，以终端显示的本地端口为准。

正常情况下，新设备不需要重新创建 Supabase 项目、Vercel 项目、数据库表或 API Key。需要的是登录同一账号并关联已有资源。

## 4. 首次关联 Vercel

进入项目：

```powershell
Set-Location E:\ecode\other\le-web\stock-dashboard
```

正常情况下依次执行：

```powershell
npx vercel login
npx vercel link
npx vercel env ls
```

`vercel link` 时选择：

- Scope：拥有现有项目的账号或团队
- Project：`stock-dashboard`

成功后会生成本机目录 `.vercel/`。它只保存项目关联信息，已被 Git 忽略，不要提交。

### Windows 出现 EXDEV 时

如果 CLI 报错：

```text
EXDEV: cross-device link not permitted ... config.json
```

说明 Vercel CLI 无法写入默认的 Roaming 配置目录。改用 LocalAppData：

```powershell
$vercelConfigDir = Join-Path $env:LOCALAPPDATA 'VercelCLI'
New-Item -ItemType Directory -Force -Path $vercelConfigDir | Out-Null
npx vercel --global-config $vercelConfigDir login
npx vercel --global-config $vercelConfigDir link
npx vercel --global-config $vercelConfigDir env ls
```

此后在这台电脑上执行 Vercel CLI 时，都继续带上 `--global-config $vercelConfigDir`。

如果 PowerShell 出现 `>>` 而不是正常提示符，表示上一条命令尚未闭合。按 `Ctrl + C` 返回正常提示符，再逐条执行命令。

## 5. Supabase 初始化

### 5.1 当前 CLI 关联

当前电脑已完成：

```powershell
supabase login
supabase init
supabase link --project-ref ougpvpolmzsmaljscruo
```

验证登录和关联状态：

```powershell
supabase --version
supabase projects list --agent no --output-format text
```

项目列表中目标项目左侧出现 `●` 表示当前目录已关联。`supabase/.temp` 保存本机链接缓存，由 `supabase/.gitignore` 忽略；应提交 `supabase/config.toml`，不应提交 `.temp`。

如果 CLI 自动浏览器登录因网络或 Agent 模式失败，可以从 Supabase Account → Access Tokens 创建 Personal Access Token，然后只在本机运行 `supabase login --token ...`。Access Token 具有账号管理权限，不得写入仓库、文档或聊天；暴露后必须立即撤销。

### 5.2 执行数据库 SQL

在 Supabase Dashboard 打开目标项目，然后进入 `SQL Editor`，执行 [SUPABASE_SETUP.md](SUPABASE_SETUP.md) 中的 SQL。

必须确认存在：

- `watchlist_states`
- `watchlist_states.market_events`
- `market_event_history`
- `nasdaq_market_event_history`
- `market_capture_runs`
- `instruments`
- `market_days`
- `price_bars_daily`
- `market_forward_labels`
- `sources`
- `events`
- `event_sources`
- `event_entities`
- 对应索引、唯一约束和 RLS Policies

最新标准行情 migration：

```text
supabase/migrations/20260812190000_add_market_price_data.sql
```

### 5.3 配置登录回调

在 Supabase Dashboard 的 `Authentication → URL Configuration` 中加入：

- `http://localhost:3000`
- 本地实际使用的其他端口（例如 `3001`、`3002`）
- `https://stock-dashboard-psi-henna.vercel.app`

页面使用的 Supabase URL 和 Publishable Key（旧项目也可使用 Anon Key）由用户在看板中填写，并保存在当前浏览器 `localStorage`。它们与服务端 Cron 环境变量是两套不同用途的配置。

## 6. 服务端环境变量

当前 Cron 必须使用以下三个变量：

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_replace-with-server-secret-key
CRON_SECRET=replace-with-a-random-secret-of-at-least-16-characters
```

获取方式：

- `SUPABASE_URL`：Supabase Dashboard → 项目 → `Settings → API Keys` 或 `Connect` → Project URL
- `SUPABASE_SECRET_KEY`：同一页面 → `Secret keys` → 创建或复制 `sb_secret_...`
- `CRON_SECRET`：自行生成至少 16 位的随机字符串

生成 32 位 `CRON_SECRET`：

```powershell
$cronChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.ToCharArray()
$cronSecret = -join (1..32 | ForEach-Object { $cronChars | Get-Random })
$cronSecret
```

安全要求：

- Secret Key 会绕过 RLS，只能存在于服务端环境
- Secret Key 是不透明 API Key，只能放在 `apikey` 请求头，不能作为 `Authorization: Bearer` JWT
- 不要把 Secret Key 或 Cron Secret 写入前端代码、README、Issue、聊天或 Git
- 不要将真实密钥填入 `.env.example`
- 如果密钥曾公开，立即在对应平台轮换

### 6.1 添加到 Vercel Production

推荐使用交互式命令，避免密钥进入 PowerShell 历史：

```powershell
npx vercel --global-config $vercelConfigDir env add SUPABASE_URL production
npx vercel --global-config $vercelConfigDir env add SUPABASE_SECRET_KEY production
npx vercel --global-config $vercelConfigDir env add CRON_SECRET production
```

每条命令出现提示后再粘贴对应值。检查变量名：

```powershell
npx vercel --global-config $vercelConfigDir env ls
```

如果没有遇到 EXDEV、没有定义 `$vercelConfigDir`，去掉每条命令中的 `--global-config $vercelConfigDir` 即可。

修改环境变量后必须重新部署，新部署才会使用新值。

### 6.2 本地 `.env.local`

只有需要在本地测试 Cron 时，才需要在 `stock-dashboard/.env.local` 放置真实服务端变量。可以复制 `.env.example` 后填写，但不要提交该文件。

当前仓库根 `.gitignore` 已忽略 `.env`、`.env.local` 和 `.env.*.local`。提交前仍应运行：

```powershell
git status --short
git check-ignore -v .env.local
```

## 7. 本地启动

在项目目录运行：

```powershell
npx vercel --global-config $vercelConfigDir dev
```

没有使用自定义配置目录时：

```powershell
npx vercel dev
```

默认地址通常是 `http://localhost:3000`。端口被占用时，以终端输出为准。

基本检查：

1. 首页能够加载。
2. 自选股行情能够刷新。
3. A 股与美股分析弹层能够请求 `api/`。
4. 页面填写 Supabase URL/Anon Key 后可以发送 Magic Link。
5. 登录后可以拉取和同步 `watchlist_states`。
6. 历史页面可以读取 `market_event_history`。

## 8. Cron 本地验证

### 8.1 QQQ 历史日线回填

先确保 `.env.local` 中有 `SUPABASE_URL` 和 `SUPABASE_SECRET_KEY`。macOS / Linux：

```bash
set -a
. ./.env.local
set +a
npm run backfill:qqq
```

Windows PowerShell 可先执行 `vercel env pull .env.local`，再把两个服务端变量只加载到当前终端后运行：

```powershell
node scripts/backfill-market-prices.js QQQ 5y
```

脚本按 `(instrument_id, market_date)` upsert，可安全重跑，不会累积重复交易日。当前已验证基线为：

- `QQQ`
- 1,254 个唯一交易日
- `2021-08-12` 至 `2026-08-11`
- 调整收盘价和成交量无缺失

启动 `vercel dev` 后可公开读取：

```text
GET /api/nasdaq/prices?symbol=QQQ&limit=1254
```

接口只允许查询 `instruments` 中已登记的标的，返回按市场日期升序排列的 OHLCV、调整收盘价、涨跌幅、来源与采集时间。

生成或重算研究标签：

```bash
set -a
. ./.env.local
set +a
npm run labels:qqq
```

脚本生成以下字段：

- `return_1d_percent / return_3d_percent / return_5d_percent / return_20d_percent`：当前调整收盘价到未来第 N 个交易日调整收盘价的收益率
- `max_drawdown_20d_percent`：当前日至未来第 20 个交易日窗口内，峰值到后续低点的最大回撤
- `realized_volatility_20d_percent`：窗口内 20 个日对数收益率的总体标准差，乘 `sqrt(252)` 后年化

最近尚未走完对应窗口的字段必须保持 `null`。这些数据只能用于历史研究、回测和预测到期评估，不能作为当日模型输入，否则会产生未来数据泄漏。

公开读取接口：

```text
GET /api/nasdaq/labels?symbol=QQQ&limit=1254
```

响应包含 `researchOnly: true`。当前已验证 1,254 行唯一日期，其中完整 20 日标签 1,234 行；重复执行使用 upsert，不产生重复记录。

### 8.2 统一事件与来源

当前收盘采集同时写入两层：

- `nasdaq_market_event_history`：兼容现有首页与历史 UI 的每日快照
- `sources / events / event_sources / event_entities`：后续日历、相似日和 Agent 使用的规范模型

统一层将行情 URL 和新闻 URL 规范化，移除 `utm_* / fbclid / gclid` 等跟踪参数，并用规范 URL 与 SHA-256 指纹去重。事件通过稳定 `event_key` 幂等写入；来源和实体使用关联表，不在事件 JSON 中重复复制。

时间语义：

- `event_time`：事件真实发生或原始行情时间；旧记录无法可靠恢复时保持 `null`
- `published_at`：来源首次发布时间
- `available_at`：系统/市场可获得时间
- `captured_at`：本系统抓取时间
- `market_date`：归属的美股交易日

用兼容快照重建统一层：

```bash
set -a
. ./.env.local
set +a
npm run events:rebuild
```

重建脚本默认读取最近 180 天，使用 upsert，可安全重复执行。当前真实基线是 14 个事件、36 个唯一来源、39 条事件来源关系和 27 条事件实体关系。

公开读取接口：

```text
GET /api/nasdaq/events?days=30|90|180
```

响应中每条事件包含 `sources` 和 `entities`，便于 UI 和 Agent 直接展示证据链接及相关标的。浏览器不能直接访问四张 RLS 表。

### 8.3 收盘归档验证

定时任务使用 `GET`，手动重跑使用 `POST`。两个入口都要求：

```http
Authorization: Bearer <CRON_SECRET>
```

启动 `vercel dev` 后，在另一个 PowerShell 窗口测试：

```powershell
$cronSecretForTest = Read-Host '请输入本地 CRON_SECRET'
$cronHeaders = @{ Authorization = "Bearer $cronSecretForTest" }
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/cron/capture-market-history' -Headers $cronHeaders
Remove-Variable cronSecretForTest, cronHeaders
```

手动重跑当前最近交易日：

```powershell
$cronSecretForTest = Read-Host '请输入本地 CRON_SECRET'
$cronHeaders = @{ Authorization = "Bearer $cronSecretForTest" }
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/cron/capture-market-history' -Headers $cronHeaders
Remove-Variable cronSecretForTest, cronHeaders
```

查看最近 20 次运行记录：

```powershell
$cronSecretForTest = Read-Host '请输入本地 CRON_SECRET'
$cronHeaders = @{ Authorization = "Bearer $cronSecretForTest" }
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/cron/market-history-runs?limit=20' -Headers $cronHeaders
Remove-Variable cronSecretForTest, cronHeaders
```

手动入口不会绕过美东收盘时间和上游行情日期检查，也不支持为任意历史日期倒推新闻原因。

可能结果：

- `401 Unauthorized`：本地环境没有 `CRON_SECRET`，或请求值不一致
- `500 Missing SUPABASE_URL or SUPABASE_SECRET_KEY`：服务端变量未加载
- `skipped: true`：尚未进入美股收盘后的归档窗口，属于正常保护
- `ok: true` 且包含 `savedEvents`：任务已执行并写入历史表
- `status: partial`：至少一个用户成功或正常跳过，同时有其他用户失败
- `status: failed`：本次所有可处理用户都失败，接口返回 `502`

每次授权调用都会写入 `market_capture_runs`，包括因未到收盘时间而产生的 `skipped`。日志保存触发类型、状态、市场日期、耗时、用户数量、写入数量和失败摘要，不保存 Secret。

不要为了测试而删除收盘时间保护。需要稳定测试时，应为时间判断和抓取层补单元测试，而不是修改生产规则。

## 9. 部署与生产验证

部署生产环境：

```powershell
npx vercel --global-config $vercelConfigDir --prod
```

部署后检查：

1. 生产首页正常访问。
2. Vercel → Project → `Settings → Environment Variables` 中三个变量都属于 Production。
3. Vercel → Project → `Settings → Cron Jobs` 中存在 `/api/cron/capture-market-history`。
4. Cron 执行后，Vercel Function Logs 无 `401` 或缺少环境变量错误。
5. Supabase `market_event_history` 出现当日记录，且同一用户、日期和股票没有重复行。

当前 `vercel.json` 在每个工作日 `22:00 UTC` 调用一次归档接口：

```json
{
  "path": "/api/cron/capture-market-history",
  "schedule": "0 22 * * 1-5"
}
```

市场休市日可能触发 Cron，但上游日期校验会阻止把旧行情误记为当天数据。

## 10. 开发约束

### 数据和时间

- 所有股票代码进入数据层前统一大写
- 交易日以美股市场日期为准，不直接使用本地北京时间日期
- 新闻发布时间、采集时间、行情日期要分开保存
- 休市日或上游陈旧行情不能写成当天记录
- 每日历史写入必须保持幂等，当前唯一键为 `user_id + market_date + symbol`
- 公共历史唯一键为 `market_date + symbol`，不得因为任务重跑产生重复行
- `lib/nasdaq-universe.js` 与 `app.js` 的核心代码列表必须同步更新；长期方案是改为数据库成分快照
- 当前核心名单是限流条件下的新闻雷达，不可在文案中称为完整 Nasdaq-100 全量成分

### 归因表达

- 新闻与价格变化只能描述为关联线索或归因假设
- Agent 只能引用 `sources` 中已有的 URL；没有来源时必须明确证据不足
- 实时预测输入不得读取未来标签，`market_forward_labels` 仅供历史研究与到期评估
- 没有足够证据时使用 `unclear` 和低置信度
- 所有新闻证据保留原始链接，方便人工复核
- 不输出“必涨”“必跌”等确定性投资结论

### 安全

- 前端只能使用 Publishable Key（或旧 Anon Key），不得引用 Secret Key
- Cron 必须校验 `CRON_SECRET`
- 用户数据读写继续受 RLS 保护
- API 错误响应不得包含完整上游响应、Token 或用户隐私数据

## 11. 当前测试与提交检查

项目已有基于 Node.js 内置测试框架的基础测试，修改后至少完成：

```powershell
npm test
git diff --check
git status --short
```

并手动验证：

- 桌面端与移动端基本布局
- 行情刷新与错误提示
- 云同步登录、拉取和写入
- 美股/A 股分析接口
- 当日事件接口
- 历史时间轴
- Cron 鉴权与跳过逻辑

提交前确认没有以下内容：

- `.env.local`
- `.vercel/`
- Supabase Secret Key
- Cron Secret
- 浏览器登录 Session

## 12. 常见问题

### `cd` 后没有输出

正常。目录切换成功时 PowerShell 默认不输出内容，可以用 `Get-Location` 确认。

### PowerShell 一直显示 `>>`

表示命令仍在等待闭合的引号、括号或管道。按 `Ctrl + C`，然后逐条重新输入。

### `vercel env ls` 报 EXDEV

使用第 4 节的 `--global-config $vercelConfigDir` 方案，避开 Roaming 配置目录。

### Node 版本不是 22

项目使用 [`.nvmrc`](.nvmrc) 和 `package.json` 的 `engines.node` 固定 Node 22，只约束 `stock-dashboard`，不会要求仓库里的其他项目跟着切换。

macOS/Linux 使用 NVM 时：

```bash
cd stock-dashboard
nvm install
nvm use
node --version
```

Windows 使用 nvm-windows 时可安装并切换到 Node 22。执行 Vercel 命令时优先使用 `npx vercel`，避免系统全局 Vercel CLI 与项目版本不一致。

### Docker 已安装但 Supabase 本地命令连接失败

仅安装 Docker CLI 不代表 Docker 引擎已经运行。先启动 Docker Desktop，再检查：

```bash
docker info
```

如果仍出现 `Cannot connect to the Docker daemon`、socket 不存在或 permission denied，等待 Docker Desktop 完成启动后重试。远程 `supabase link`、Management API 和线上 Vercel 开发不依赖本地 Docker；只有 `supabase start`、本地数据库重置和完整 migration 测试需要它。

### `vercel env pull` 后 Sensitive 变量为空

Vercel 的 Sensitive 变量设计上不能从 Dashboard 或 CLI 重新读取。`vercel env pull` 可能创建变量名，但不会恢复 Secret 明文，因此不能把它当作跨设备 Secret 同步方案。

新设备本地测试 Cron 时：

1. 从 Supabase Dashboard 的 `Settings → API Keys → Secret keys` 获取 `SUPABASE_SECRET_KEY`。
2. 从项目维护者的安全密码管理渠道获取当前 `CRON_SECRET`，或同步轮换本机和 Vercel Production 的值。
3. 按 `.env.example` 在本机创建 `.env.local`。
4. 确认 `.env.local` 被 Git 忽略，且没有出现在 `git status --short` 中。

不要把 Secret 写入 README、聊天、Git、Issue 或普通命令行参数。macOS/Linux 可以额外执行 `chmod 600 .env.local`。

### 本地 Cron 一直返回 401

先确认 `.env.local` 中的 `CRON_SECRET` 不是空值，并且与请求头完全一致。启动服务前再加载环境变量或重新启动 `vercel dev`，因为已经运行的进程不会自动获得之后才写入的变量。

请求格式必须是：

```http
Authorization: Bearer <CRON_SECRET>
```

这里使用的是 Cron Secret，不是 Supabase Secret Key。

### 新版 Supabase Secret Key 返回 `Invalid JWT`

`sb_secret_...` 是不透明 API Key，不是 JWT。服务端访问 Supabase Data API 时应发送：

```http
apikey: sb_secret_...
```

不要再发送 `Authorization: Bearer sb_secret_...`。浏览器登录用户的 Session JWT 才放在 `Authorization` 头中。旧的 `service_role` JWT 和新的 Secret Key 不要混用。

### `supabase db push --linked` 无法连接数据库

如果出现以下错误之一：

- `Connection terminated unexpectedly`
- `failed to resolve db.<project-ref>.supabase.co`
- 直连地址只有 IPv6，但当前网络没有公网 IPv6

说明失败发生在 PostgreSQL 直连层，不代表 Supabase REST API、Auth 或项目本身离线。可以依次选择：

1. 换到支持公网 IPv6 的网络后重试。
2. 使用 Supabase Pooler 连接和数据库密码执行 `db push`。
3. 临时通过 Management API 执行已审查的 SQL：

```bash
supabase db query --linked --file supabase/migrations/20260812031712_stock_dashboard_initial_schema.sql
```

第三种方式会应用 Schema，但不会自动登记 `supabase_migrations.schema_migrations` 历史。后续恢复数据库直连后仍需核对并补齐 migration 历史，不能直接假设 `db push` 已完成。

### Supabase REST 返回 `PGRST205`

例如：

```text
Could not find the table 'public.watchlist_states' in the schema cache
```

这表示数据库表尚未创建或 Schema Cache 尚未刷新，不是 API Key 错误。先检查 migration 是否已应用，再确认 `watchlist_states`、`market_event_history` 和对应 RLS Policy 存在。

### 首页能打开，但分析按钮失败

不要使用静态文件服务器；改用 `vercel dev`，因为分析能力依赖 Vercel Functions。

### 生产 Cron 返回 401

确认 `CRON_SECRET` 已配置在 Production，重新部署，并检查接口收到的请求是否由 Vercel Cron 发起。

环境变量修改只对新 Deployment 生效。添加或轮换变量后必须重新执行生产部署，旧 Deployment 不会自动更新运行时变量。

### Cron 返回 `processedUsers: 0`

这只说明没有个人自选需要兼容归档。公共 Nasdaq 写入应查看 `publicSavedEvents` 和 `savedEvents`：

```json
{
  "ok": true,
  "processedUsers": 0,
  "publicSavedEvents": 14,
  "savedEvents": 14
}
```

只有验证旧的个人历史归档时，才需要登录并同步 `watchlist_states`。如果 `publicSavedEvents` 也是 0，再检查收盘窗口、行情日期和 `nasdaq_market_event_history` migration。

### Cron 返回 `skipped: true`

收盘归档只在美东工作日 17:00 之后执行。盘前、盘中、周末或休市日被跳过是保护行为；不要为了测试删除时间和行情日期校验。

### Vercel 显示的 Node 版本与本机不同

本项目通过 `stock-dashboard/package.json` 的 `engines.node = 22.x` 固定构建和 Function 主版本。修改 Node 版本后需要重新部署。不要修改仓库根目录的 Node 配置来解决 Stock 项目的版本问题，否则可能影响其他子项目。

### Supabase 返回 401/403

浏览器请求检查登录 Session、Publishable Key 和 RLS；Cron 请求检查 Secret Key。不要互换两类密钥。

## 13. 后续环境变量

当前版本不要求 OpenAI、DeepSeek 或付费行情 API Key。以后增加 AI 摘要或收费数据源时，应在接入代码的同一变更中：

1. 更新 `.env.example`，只增加变量名和占位值。
2. 更新本文档的用途、获取路径和安全边界。
3. 在 Vercel Preview/Production 分别配置。
4. 增加缺少变量时的明确错误或功能降级。
