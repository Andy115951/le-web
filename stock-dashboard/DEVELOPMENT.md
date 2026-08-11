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

开始完整云端联调前仍需完成：

- [ ] 将现有建表 SQL 整理成 `supabase/migrations/` 中的正式 migration
- [ ] 执行 `supabase db push`，确认远程表、约束和 RLS 已创建
- [ ] 在当前电脑关联 Vercel 的 `stock-dashboard` 项目
- [ ] 在 Vercel Production 配置 `SUPABASE_URL`
- [ ] 在 Vercel Production 配置 `SUPABASE_SECRET_KEY`
- [ ] 生成并配置 `CRON_SECRET`
- [ ] 重新部署并验证 Vercel Cron 与 `market_event_history` 写入

页面、API 和事件规则开发现在即可进行；只有每日云端归档闭环依赖上述未完成事项。

## 1. 当前系统边界

当前项目是围绕 `QQQ`、美国七巨头和个人自选股的决策看板，主要由四部分组成：

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
│  └─ cron/capture-market-history.js 收盘后历史归档入口
├─ lib/
│  ├─ a-share-data.js                A 股数据层
│  ├─ global-stock-data.js           美股数据层
│  ├─ daily-market-events.js         QQQ 对照、新闻与事件规则
│  └─ market-history-capture.js      Supabase 服务端写入逻辑
├─ supabase/
│  └─ config.toml                    Supabase 本地项目配置
├─ vercel.json                       Cron 时间配置
├─ .env.example                      服务端环境变量模板
└─ SUPABASE_SETUP.md                 建表、RLS 与登录配置
```

每日历史任务的数据流：

```text
Vercel Cron
  → GET /api/cron/capture-market-history
  → 校验 Authorization: Bearer <CRON_SECRET>
  → 用 Supabase Secret Key 读取 watchlist_states
  → 抓取 QQQ、自选股行情和公开资讯
  → 按 user_id + market_date + symbol 写入 market_event_history
```

## 3. 开发前置条件

建议环境：

- Windows PowerShell 或 PowerShell 7
- Node.js 22（当前已验证环境为 Node.js 22）
- 可访问 Vercel 和 Supabase
- 已有 `stock-dashboard` Vercel 项目权限
- 已有目标 Supabase 项目权限

仓库根目录已安装 Vercel CLI 依赖，因此可以在 `stock-dashboard` 目录直接使用 `npx vercel`，无需再全局安装。

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
- 对应索引、唯一约束和 RLS Policies

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

Cron 接口只允许 `GET`，并要求：

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

可能结果：

- `401 Unauthorized`：本地环境没有 `CRON_SECRET`，或请求值不一致
- `500 Missing SUPABASE_URL or SUPABASE_SECRET_KEY`：服务端变量未加载
- `skipped: true`：尚未进入美股收盘后的归档窗口，属于正常保护
- `ok: true` 且包含 `savedEvents`：任务已执行并写入历史表

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

### 归因表达

- 新闻与价格变化只能描述为关联线索或归因假设
- 没有足够证据时使用 `unclear` 和低置信度
- 所有新闻证据保留原始链接，方便人工复核
- 不输出“必涨”“必跌”等确定性投资结论

### 安全

- 前端只能使用 Publishable Key（或旧 Anon Key），不得引用 Secret Key
- Cron 必须校验 `CRON_SECRET`
- 用户数据读写继续受 RLS 保护
- API 错误响应不得包含完整上游响应、Token 或用户隐私数据

## 11. 当前测试与提交检查

项目目前没有自动化测试套件，修改后至少完成：

```powershell
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

### 首页能打开，但分析按钮失败

不要使用静态文件服务器；改用 `vercel dev`，因为分析能力依赖 Vercel Functions。

### 生产 Cron 返回 401

确认 `CRON_SECRET` 已配置在 Production，重新部署，并检查接口收到的请求是否由 Vercel Cron 发起。

### Supabase 返回 401/403

浏览器请求检查登录 Session、Publishable Key 和 RLS；Cron 请求检查 Secret Key。不要互换两类密钥。

## 13. 后续环境变量

当前版本不要求 OpenAI、DeepSeek 或付费行情 API Key。以后增加 AI 摘要或收费数据源时，应在接入代码的同一变更中：

1. 更新 `.env.example`，只增加变量名和占位值。
2. 更新本文档的用途、获取路径和安全边界。
3. 在 Vercel Preview/Production 分别配置。
4. 增加缺少变量时的明确错误或功能降级。
