# Stock Dashboard 开发手册

本文档面向本地开发、Supabase 初始化、Vercel 部署和每日行情历史任务维护。产品功能与进度概览见 [README.md](README.md)，完整产品路线图见 [ROADMAP.md](ROADMAP.md)，数据库完整 SQL 见 [SUPABASE_SETUP.md](SUPABASE_SETUP.md)，新人关联解读（手动触发、不走模型出站）规格见 [docs/beginner-reading.md](docs/beginner-reading.md)。该解读不是采集或 Cron 的一部分：页面加载和行情刷新都不得自动生成正文。

## 当前环境状态（2026-08-24）

当前 Windows 开发机已经完成：

- Node.js `22.22.2` 可用，符合 `.nvmrc` 要求
- Vercel CLI `54.14.2` 已安装，通过 `C:\vcli\vc.cmd` wrapper 调用（绕过 EXDEV + 注入 Clash 代理）
- Vercel 已登录账号 `xiongjiale99-5273`，已 link 到 `les-projects-1a1adf4b/stock-dashboard`
- Supabase CLI `2.113.0` 已安装，已 link 到项目 `ougpvpolmzsmaljscruo`（`le's Project`，Singapore）
- `supabase/.temp` 已被忽略，不会提交本机链接信息
- `.env.local` 已配置以下变量（均验证通过）：
  - `SUPABASE_URL` + `SUPABASE_SECRET_KEY`：REST 查询返回 200
  - `CRON_SECRET`：本机生成随机串
  - `FRED_API_KEY`：采集验证通过，12 条宏观观测写入成功
  - `SEC_USER_AGENT`：采集验证通过，3 条 filings 写入成功
- Vercel 生产环境已补充 `FRED_API_KEY` 和 `SEC_USER_AGENT`，已重新部署
- 测试 198/198 全绿，代码零 npm 依赖，无需 `npm install`
- 服务端归档代码已迁移到新版 `SUPABASE_SECRET_KEY`

当前 Mac 开发机已经完成：

- Node.js `22.22.2` 通过 NVM 管理，项目内 `.nvmrc` 和 `package.json` 固定为 Node 22
- Vercel CLI `54.18.7` 已登录并关联 `stock-dashboard`
- Supabase CLI 已升级到 `2.113.0` 并关联项目 `ougpvpolmzsmaljscruo`
- Docker Desktop `29.2.1` 已启动
- 正式 migration 已创建，远程表、约束、Data API 权限和 RLS 已通过 Management API 应用并验证
- Vercel Production 已配置 `SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`CRON_SECRET`、`SEC_USER_AGENT`、`FRED_API_KEY`，以及 DeepSeek 网关参数
- 生产 `DEEPSEEK_MODEL` 已改为 `deepseek-v4-flash`，与本机 `.env.local` 对齐；维护者确认保留该模型（相对 `deepseek-v3.2` 输出略贵，但智力更合适；JSON 请求仍关闭 thinking）
- `DEEPSEEK_RESEARCH_ENABLED`、`DEEPSEEK_RESEARCH_DATA_APPROVED`、`DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED` 均为 `false`
- 本机 `.env.local` 已配置为仅当前用户可读，并被 Git 忽略
- 生产部署和 Cron 鉴权已验证，固定地址为 `https://stock-dashboard-psi-henna.vercel.app`

当前剩余环境事项：

- [ ] 当前网络没有公网 IPv6，`supabase db push --linked` 无法直连数据库；Schema 已通过 `supabase db query --linked --file` 应用，但仍需在具备 IPv6 或 Pooler 数据库密码时登记 migration 历史
- [x] 公共 `nasdaq_market_event_history` 已建表并完成 14 个核心标的真实写入
- [x] `daily_market_features` 已通过 Management API 应用并完成 1,254 行 QQQ 回填
- [x] `similar_day_matches` 已通过 Management API 应用并完成 5,848 条 QQQ 相似日回填
- [x] `ndx_constituent_changes` 已通过 Management API 应用；首份快照没有前序版本，因此当前尚无变更行
- [ ] NDX 全量官方快照仍是 `2026-05-01`（来源 `https://www.nasdaq.com/docs/2026/05/04/NDX.pdf`）。`2026-08-24` 探测 `nasdaq.com/docs/2026/06–08/*/NDX.pdf` 与 `business.nasdaq.com/Docs/NDX.pdf` 均重定向到同一份 5 月 PDF；公开 Fact Sheet `FS_NDX.pdf` 日期为 `2026-06-30` 但只有权重前 10，不足 100–110 只，不能当候选导入。完整名单仍需 Nasdaq 官方全量权重 PDF 或登录后的 Weighting 表
- [x] SEC EDGAR filings 采集器、统一事件写入和离线测试已实现；生产已配置合规 `SEC_USER_AGENT`，Windows 本机验证写入 3 条 filings
- [x] FRED 宏观观测采集器、稳定去重和离线测试已实现；生产已配置 `FRED_API_KEY`，Windows 本机验证写入 12 条宏观观测
- [x] `event_review_decisions` 已在远程创建；确定性分类、只读队列和追加式人工审核 CLI 已实现
- [x] `research_packet_snapshots` 已在远程创建；首份 `2026-08-11` 输入快照已验证可幂等重跑
- [x] 看板“研究回放”已接入快照摘要与按需详情读取；只展示归档事实、来源聚合和审核状态，不调用模型也不展示投资指令
- [x] `research_narrative_audits` 已在远程创建；`2026-08-15` 有一次受控快照验证审计被拒绝且未发布摘要，Production 模型出站保持 `disabled`
- [x] JSON 模式请求固定 `thinking: { type: "disabled" }` 与 `stream: false`，避免 V4 默认 thinking 把小 `max_tokens` 吃成 `finish_reason=length`
- [x] `2026-08-24` Production 无项目数据探针：审计 `08b82ea6-ecad-4ac1-83e8-15a9d0ebe9b2` 对当时模型 `deepseek-v3.2` 为 `accepted`（`stop`，校验错误 0）
- [x] 随后模型改为 `deepseek-v4-flash`；`2026-08-24` 对该模型另打一次探针，审计 `2c22bb23-a32a-4eca-af32-e6dfdcbc78b7` 为 `accepted`（`stop`，校验错误 0）；探针开关已关
- [x] `2026-08-24` 对 `2026-08-21` 研究快照用 `deepseek-v4-flash` 做一次受控验证，审计 `43401531-35b4-4cc7-9079-bbcb0e6cfaaa` 为 `accepted`；出站开关与一次性指纹已关闭
- [x] `2026-08-31` 补齐价格后重建派生数据，重新归档 `2026-08-14` 干净快照（指纹 `08fb83c7…`，含完整 `marketState` + 14 事件 + 5 相似日）；用 `deepseek-v4-flash` 做首次三支柱齐全的受控验证，审计 `65de89d4-b1d5-48e0-9b2a-f64eeb46232f` 为 `accepted`（校验错误 0）。叙述正确把同向个股归因为大盘、把偏离个股（AMZN）标为需看个股新闻、对证据不足者（WMT）拒绝归因，并列出不确定性；出站开关已关回 `false`
- [x] `research_task_runs` 已通过 Management API 扩展为 `research-task-run-v2`：新增安全的每次尝试、排队与运行耗时列及受限失败码约束
- [x] Cron 运行日志、失败诊断、手动重跑和最近运行记录接口
- [x] Cron 诊断接口脱敏：只返回状态、计数和公共观察宇宙失败摘要，不返回用户 ID、个人标的、原始异常或内部运行详情
- [x] 公共行情 Collector 已拆出独立模块，瞬时网络失败最多重试一次；可用受保护 `runId` 单条摘要关联具体运行，不重试个人自选写入或触发模型
- [x] Nasdaq 核心行情/新闻入口已与个人自选解耦，无登录也可运行
- [x] NDX 成分变更只读查询已接入动态日历：`GET /api/nasdaq/constituent-changes` 与单日详情只读取审核后快照及追加式变更行；首份快照不会被误写为“无变更”
- [x] 财报日历基础层：`earnings_events` migration、官方 IR 候选校验/显式导入、`GET /api/nasdaq/earnings` 和动态日历展示已实现；首条 NVIDIA FY2027 Q2 官方候选已归档，预定事项不进入涨跌归因
- [x] 决策日志：`decision-logs.mjs` 纯函数模块（校验/归一/last-write-wins 合并/补录结果）、`watchlist_states.decision_logs` 加性列与 RLS 继承、`storage.js`/`cloud.js`/`app.js` 三层接线（含旧库列缺失降级）、看板面板与观察记录一键起草已实现；只记录用户已做的决定与理由，不生成买卖建议
- [x] 新人关联解读第一期：`lib/beginner-reading.mjs` 确定性模板 + 首页/日历手动「读一下」按钮；打开页面和行情刷新都不生成正文，不写云、不调用模型；规格见 [docs/beginner-reading.md](docs/beginner-reading.md)
- [x] 新人关联解读第二期：`POST /api/beginner-reading/polish` + 「生成 AI 解读」卡片内确认小框；讲解写在模板下方单独区域，不替换五段事实；独立开关 `DEEPSEEK_BEGINNER_READING_ENABLED`；不发送股数/成本；失败保留模板；不设每日次数上限
- [x] `2026-08-24` 生产打开 `DEEPSEEK_BEGINNER_READING_ENABLED`；`DEEPSEEK_RESEARCH_ENABLED` 与 `DEEPSEEK_RESEARCH_DATA_APPROVED` 保持 false，探针开关保持关闭

页面、API、事件规则和数据库开发现在都可进行；当前未完成项不会阻塞下一批代码开发。

## 0. 本机 Windows 实际环境（`E:\ecode\other\le-web`）

> 本节记录当前这台 Windows 开发机的真实运行方式。它与第 4、6、7 节的通用 `--global-config` 方案是**两套并行手段**：本机实际使用的是下面的 `vc.cmd` wrapper，遇到 Vercel CLI 相关操作时以本节为准。

### 0.1 关键事实

- 项目实际路径：`E:\ecode\other\le-web\stock-dashboard`（文档其余部分出现的 `/Users/apple/Documents/...` 是 Mac 机路径，本机忽略）。
- 终端：Git Bash（POSIX sh）。示例命令以 Git Bash 为准，PowerShell 段落见对应通用章节。
- Node `22.x`、npm、Vercel CLI `54.x`、Supabase CLI `2.113.0` 均已安装。
- **本项目代码零 npm 依赖**：只用 Node 内建 `crypto / fs / path`，`package.json` 的 `dependencies` 为空。因此 `stock-dashboard` 目录**不需要 `npm install`**，测试和脚本可直接跑。
- Supabase CLI 已 link 到项目 `ougpvpolmzsmaljscruo`（`le's Project`），链接信息在被忽略的 `supabase/.temp/` 下。

### 0.2 EXDEV + 代理：必须用 `vc.cmd` wrapper

直接运行 `vercel ...` 会失败：

```text
EXDEV: cross-device link not permitted ... com.vercel.cli\config.json
```

原因是 Vercel CLI 用 `fs.rename` 写 `%APPDATA%\Roaming` 下的配置，撞上本机的目录虚拟化 / 跨卷限制。本机的解决方案不是 `--global-config`，而是一个固定 wrapper：

- 路径：`C:\vcli\vc.cmd`
- 作用：
  1. 把 `XDG_DATA_HOME` 重定向到 `C:\vcli`，让 CLI 配置落到同卷目录 `C:\vcli\com.vercel.cli`，绕过 EXDEV；
  2. 注入 `HTTPS_PROXY / HTTP_PROXY = http://127.0.0.1:7890`（Clash），并通过 `NODE_OPTIONS=--import .../proxy-preload.mjs` 把 Node 的全局 `https/http` agent 和 undici dispatcher 都强制走该代理——因为 Node CLI 默认**不读** `HTTPS_PROXY`，OAuth / API 请求否则无法出网。

配套文件（均在 `C:\vcli\`）：`vc.cmd`、`proxy-preload.mjs`、`proxy-preload.cjs`、`com.vercel.cli/`。

**前置条件：Clash 必须运行在 `127.0.0.1:7890`。** 快速自检：

```bash
curl -s -x http://127.0.0.1:7890 -o /dev/null -w "%{http_code}\n" https://api.vercel.com
# 返回 3xx/200 即代理可达；连接被拒说明 Clash 没起
```

### 0.3 本机 Vercel 命令用法

在 Git Bash 里统一通过 wrapper 调用（`cmd //c` 调用 `.cmd`）：

```bash
cmd //c "C:\\vcli\\vc.cmd whoami"        # 检查登录状态
cmd //c "C:\\vcli\\vc.cmd login"         # 重新登录（浏览器 OAuth）
cmd //c "C:\\vcli\\vc.cmd link"          # 关联到 stock-dashboard 项目
cmd //c "C:\\vcli\\vc.cmd env ls"        # 只看变量名
cmd //c "C:\\vcli\\vc.cmd dev"           # 本地起服务
cmd //c "C:\\vcli\\vc.cmd --prod --yes"  # 生产部署
```

> 本节所有 `vercel` 操作都替换成上面的 `vc.cmd` 形式；不要在本机直接敲 `vercel` 或 `npx vercel`，否则复现 EXDEV。

### 0.4 本机接入检查清单

```bash
# 1. 运行时齐不齐
node -v            # 期望 v22.x
cmd //c "C:\\vcli\\vc.cmd --version"      # Vercel CLI 54.x
supabase --version                         # 2.113.0

# 2. 代理在不在
curl -s -x http://127.0.0.1:7890 -o /dev/null -w "%{http_code}\n" https://api.vercel.com

# 3. 测试基线（零依赖，直接可跑）
node --test        # 期望全绿

# 4. 登录 & 关联（token 会过期，失效就重登）
cmd //c "C:\\vcli\\vc.cmd whoami"
cmd //c "C:\\vcli\\vc.cmd login"   # 仅当上一步报 token 无效
cmd //c "C:\\vcli\\vc.cmd link"    # 仅当缺少 .vercel/ 目录

# 5. 需要联调 Supabase 接口时，再准备 .env.local（见 6.2）
```

### 0.5 Windows 首次配置待办

- [ ] 如 Vercel token 已失效，重跑 `vc.cmd login`（浏览器 OAuth，需人工完成）。
- [ ] 如该 Windows 设备还没有 `stock-dashboard/.env.local`，纯页面 / 测试不需要；联调 Supabase 接口前按第 6.2 节补齐 `SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`CRON_SECRET`。
- [ ] 如该 Windows 设备还没有 `.vercel/`，登录后执行 `vc.cmd link` 关联既有 `stock-dashboard`，不要新建同名项目。

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
├─ personal-observations.mjs         自动观察记录纯函数（触发/归一/合并）
├─ decision-logs.mjs                 用户决策日志纯函数（校验/归一/last-write-wins 合并/补录结果）
├─ quotes.js                         页面行情请求
├─ api/
│  ├─ a-share/detail.js              A 股分析接口
│  ├─ global-stock/detail.js         美股分析接口
│  ├─ global-stock/daily-events.js   当日市场事件接口
│  ├─ nasdaq/[resource].js           公共 Nasdaq 查询入口（保留各资源 URL）
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

Vercel Hobby 对单次部署的 Serverless Function 数量有限制。Nasdaq 的 `calendar`、`prices`、`labels`、`features`、`similar-days` 等只读资源统一由 `api/nasdaq/[resource].js` 分发，外部 URL 保持不变，例如 `/api/nasdaq/calendar`。新增 Nasdaq 只读接口时优先扩展这个入口，避免重新触发函数数量限制。

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
  → backfillDailyPrices("QQQ", "1y") — 更新 price_bars_daily 与 market_days
    （日历读取此表；失败只记录 priceHistoryStatus，不中断主流程）
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
6. 运行 `npx vercel env ls`，确认 Production 存在三项核心服务端变量；这里只检查变量名，不应尝试打印值。
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
- `watchlist_states.observations`
- `watchlist_states.decision_logs`
- `market_event_history`
- `nasdaq_market_event_history`
- `market_capture_runs`
- `instruments`
- `market_days`
- `price_bars_daily`
- `market_forward_labels`
- `daily_market_features`
- `similar_day_matches`
- `sources`
- `events`
- `event_sources`
- `event_entities`
- `ndx_constituent_snapshots`
- `ndx_constituent_members`
- `ndx_constituent_changes`
- `earnings_events`
- `research_packet_snapshots`
- `research_narrative_audits`
- `research_task_runs`
- `research_outcome_evaluations`
- `daily_research_reports`
- `market_event_attributions`
- `event_rule_labels`
- `event_review_decisions`
- `model_gateway_compatibility_audits`
- 对应索引、唯一约束和 RLS Policies

当前市场数据 migrations 的完整列表见 `supabase/migrations/`。近期加性变更包括：

```text
supabase/migrations/20260815110000_add_earnings_calendar.sql
supabase/migrations/20260815130000_add_personal_observations_to_watchlist_states.sql
supabase/migrations/20260817120000_add_decision_logs_to_watchlist_states.sql
```

### 5.3 配置登录回调

在 Supabase Dashboard 的 `Authentication → URL Configuration` 中加入：

- `http://localhost:3000`
- 本地实际使用的其他端口（例如 `3001`、`3002`）
- `https://stock-dashboard-psi-henna.vercel.app`

页面使用的 Supabase URL 和 Publishable Key（旧项目也可使用 Anon Key）由用户在看板中填写，并保存在当前浏览器 `localStorage`。它们与服务端 Cron 环境变量是两套不同用途的配置。

## 6. 服务端环境变量

当前 Cron 必须使用以下三个核心变量：

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
npx vercel --global-config $vercelConfigDir env add SEC_USER_AGENT production
npx vercel --global-config $vercelConfigDir env add FRED_API_KEY production
```

每条命令出现提示后再粘贴对应值。检查变量名：

```powershell
npx vercel --global-config $vercelConfigDir env ls
```

如果没有遇到 EXDEV、没有定义 `$vercelConfigDir`，去掉每条命令中的 `--global-config $vercelConfigDir` 即可。

修改环境变量后必须重新部署，新部署才会使用新值。

`SEC_USER_AGENT` 不是 API Key，但 SEC 要求其包含应用名称和可联系邮箱，例如 `StockDashboard your-monitored-email@example.com`。不能填写假的联系人，也不能将其写进仓库。未配置时收盘任务不会请求 SEC；配置错误或 SEC 暂时不可用时，任务会记录 `secFilingStatus: failed`，但不会丢弃已完成的行情快照。

`FRED_API_KEY` 是 FRED 官方 API 的 32 位小写字母数字 Key，仅服务端保存。未配置时收盘任务不会请求 FRED。配置后，任务读取 `CPIAUCSL`、`UNRATE`、`FEDFUNDS`、`GDPC1` 的最近观测；FRED 的观测响应不提供精确发布时间，因此实现不会伪造 `published_at` 或 `event_time`，只将本系统实际采集时间写入 `available_at`。同一观测值使用稳定事件键去重，重复轮询不会被重新标记成当天的新事件。

### 6.2 本地 `.env.local`

本地联调任何访问 Supabase 的服务端接口（Cron、公共历史、研究回放、人工审核）时，都需要在 `stock-dashboard/.env.local` 放置真实服务端变量。可以复制 `.env.example` 后填写，但不要提交该文件。

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

```bash
set -a
. ./.env.local
set +a
npx vercel dev
```

当前 Vercel 项目的 Development 环境没有保存 Secret，因此单独执行 `vercel dev` 只能验证静态页面和无凭据接口；上面的三行会只为当前 shell 加载被 Git 忽略的本机变量。默认地址通常是 `http://localhost:3000`。端口被占用时，以终端输出为准。

基本检查：

1. 首页能够加载。
2. 自选股行情能够刷新。
3. A 股与美股分析弹层能够请求 `api/`。
4. 页面填写 Supabase URL/Anon Key 后可以发送 Magic Link。
5. 登录后可以拉取和同步 `watchlist_states`。
6. 刷新行情后，个人回撤纪律、目标价或弱势触发会出现在“自动观察记录”；同一美东日期的同一触发不会重复创建。
7. 在“决策日志”表单填写标的、动作与理由后可提交，或从某条观察记录点“记录决策”一键起草；提交后卡片出现在列表，可补录结果、删除，刷新页面后仍在。
8. 历史页面可以读取 `market_event_history`。

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
- 251 个唯一交易日（1y 区间）
- `2025-08-19` 至 `2026-08-18`
- 调整收盘价和成交量无缺失

**注意**：`price_bars_daily` 与事件采集（`nasdaq_market_event_history`）是两条独立管线。收盘 Cron 现已同时更新两者（`backfillDailyPrices("QQQ", "1y")`），日历数据会随每次收盘自动保持新鲜；无需再手动执行本脚本补缺。

**价格是研究系统的地基**：`marketState`（研究包里的 QQQ 基准）、`daily_market_features`、`market_forward_labels`、`similar_day_matches` 全部派生自 `price_bars_daily`。若某段价格曾缺失，那段时间生成的研究快照会带 `marketState: null` 且相似日为空——快照不可变，不会自动回填。补齐价格后，须按顺序重建派生数据，历史快照则需重新归档才会带上完整基准：

```bash
npm run features:qqq   # 日度特征
npm run labels:qqq     # 前瞻标签
npm run similar-days:qqq  # 相似日
```

`2026-08-31` 已完成一次全量重建（features/labels 各 1267 天，similar-days 5913 条匹配），修复了此前价格缺口导致的 `marketState` 与相似日空缺。

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

#### 8.2.1 人工复核队列

原始 `events` 和 `sources` 是事实记录，人工审核永远不覆盖它们。每次结论只会向 `event_review_decisions` 追加一行，保留审核人、结论、备注、规则版本和时间。当前确定性规则会把以下项目送入待复核：缺少 primary source、低置信度、缺少可知时间、市场涨跌启发式归因，以及缺少精确发布时间的 FRED 宏观观测。

读取队列（只读、不会写数据库）：

```text
GET /api/nasdaq/review-queue?days=30
```

看板“归因审核”使用同一只读接口，默认筛选 `needs_attention`，可切换 `unreviewed` 与全部事件。卡片只显示状态、规则标记、置信度和规范化原始来源链接；不会显示审核人或备注，也不能在浏览器中提交结论。当前远程已有 14 条低置信度启发式市场归因待核对，这是预期的保守规则输出，而不是模型判断。

本地人工审核使用服务端 `.env.local`，不提供浏览器写入接口：

```bash
set -a
. ./.env.local
set +a

# 查看 30 / 90 / 180 天事件及待复核原因
npm run events:review -- list 30

# 追加审核结论，不改写原始事件
npm run events:review -- decide 'market-move:2026-08-11:NVDA:v1' needs_attention apple 'Check the cited evidence before using this attribution.'
```

结论只能是 `accepted`、`rejected` 或 `needs_attention`。同一事件可以追加多次结论，读取队列时只显示最新一条；CLI 不接受匿名审核人。公开队列只返回审核状态、规则版本与时间，不返回审核人或备注；完整记录只允许服务端和本地 CLI 读取。后续模型只能读取队列中的原始来源和最新结论，不能自行写入审核表。

#### SEC EDGAR filings

SEC collector 使用公司 ticker 映射和 `https://data.sec.gov/submissions/CIK##########.json`，只处理 `10-K`、`10-Q`、`8-K`、`20-F`、`40-F`、`6-K`。事件的可知时间严格采用 EDGAR 的 `acceptanceDateTime`，不是本系统的抓取时间；每个事件的 primary source 指向 SEC Archive 原始文档。

手动验证前，需先在当前 shell 安全加载包含真实 `SEC_USER_AGENT` 的 `.env.local`：

```bash
set -a
. ./.env.local
set +a
npm run sec:filings
```

可选地只采集指定标的：

```bash
npm run sec:filings -- NVDA,AAPL,MSFT
```

运行结果只会输出数量、标的和日期，不会回显 User-Agent。官方 API 不需要 API Key，但必须遵守 SEC 的公平访问规范：声明 User-Agent、总请求速率不超过 10 次/秒、只拉取必要数据。实现当前以 125ms 间隔串行请求，且只回看最近 7 个自然日。参考：[SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) 和 [SEC Developer Resources](https://www.sec.gov/about/developer-resources)。

#### FRED 宏观观测

FRED collector 只在当前 shell 已安全加载 `FRED_API_KEY` 后运行：

```bash
set -a
. ./.env.local
set +a
npm run fred:macro
```

命令只输出 series id 与写入数量，不会回显 Key。请求走 FRED 官方 `series/observations` API，但持久化的来源 URL 始终是公开的 `https://fred.stlouisfed.org/series/<SERIES_ID>`，不会把含 Key 的 API 请求 URL 写入数据库。首次启用会捕获每个系列最近 3 个有效观测；之后相同的 series、观测日期和数值会被稳定事件键去重，只有新观测或数值修订才会写入新事件。参考：[FRED series observations API](https://fred.stlouisfed.org/docs/api/fred/series_observations.html)。

#### 8.2.2 日度研究输入包（Agent 前置契约）

模型执行器只允许读取这份已归档的输入契约，不能直接访问数据库、未来标签或不受控的网页文本：

```text
GET /api/nasdaq/research-packet?date=2026-08-11
```

响应核心字段：

- `asOf`：目标市场日期、美东时区、数据边界和明确排除项
- `marketState`：QQQ 调整收盘、当日涨跌、后视波动与重新计算后的已知事件摘要
- `events`：只含上一交易日美东收盘后至目标日美东 `16:00` 前实际可知的结构化事件和证据 URL
- `ndxSnapshot`：目标日或更早的成分权重快照
- `historicalSimilarity`：更早候选日的历史结果、方法版本、特征版本与描述统计
- `constraints`：允许和禁止的后续 Agent 用途

该接口明确不包含 `researchOutcome`，也不输出交易建议、目标价或模型概率。收盘后才采集或发布的事件会进入下一交易日的研究窗口，而不是被丢弃或倒灌到前一日。已经由人工追加审核明确标记为 `rejected` 的事件会从输入包中移除；未审核或 `needs_attention` 事件保留其公开审核标记，供后续报告明确不确定性。未来接 LLM 时，只能向模型传入这个 JSON 或其更严格的裁剪版本；模型输出必须单独保存，不能回写或覆盖本接口中的原始事实。

#### 8.2.3 研究摘要输出契约与审计

已实现 `research-narrative-v1` 输出校验器、`research_narrative_audits` 服务端审计表与默认关闭的 DeepSeek 执行器。Production 已配置受限网关参数，但 `DEEPSEEK_RESEARCH_ENABLED` 与 `DEEPSEEK_RESEARCH_DATA_APPROVED` 均保持 `false`，因此不会产生模型请求或费用。

面向新人的「读一下今天」不是本小节的研究摘要。它是首页/单日详情上的手动讲解，第一期只拼确定性模板，按钮不调用 DeepSeek、不写 `research_narrative_audits`。两者不要接在同一个点击上。产品规格见 [docs/beginner-reading.md](docs/beginner-reading.md)。

获取某市场日允许引用的证据与输出形状：

```text
GET /api/nasdaq/research-narrative-contract?date=2026-08-11
```

合法输出必须包含：目标日期、短标题、复盘文字、逐条 claim、每条 claim 的事件/来源或相似日候选引用，以及至少一项不确定性。校验器会拒绝：

- 输入包中不存在的 `eventKey`、来源 URL 或相似日候选日期
- 事件引用缺少该事件对应的来源 URL
- 人工审核为 `rejected` 的事件（不会出现在可引用 event key 列表中）
- 买入/卖出、加减仓、目标价、止盈止损和“预测概率”等越权措辞
- 日期或契约版本不匹配、重复 claim id、过长字段或没有不确定性

离线检查模型 JSON，不写数据库：

```bash
npm run narrative:validate -- /tmp/research-packet.json /tmp/narrative.json
```

启用后，收盘 Cron 会先保存稳定研究快照，再将该同一份输入交给 DeepSeek。执行器在请求前检查：显式开关、当日美东请求上限、同一输入指纹与同一模型的已接受摘要；响应必须是完整 JSON、通过来源引用和非建议语言校验，才会成为 `accepted`。失败或违规响应仍以 `rejected` 形式追加审计，但不保存原始非 JSON 文本。数据库还有部分唯一索引，避免并发下对同一快照和同一模型发布两条接受结果。

已接受摘要可通过只读接口读取：

```text
GET /api/nasdaq/research-narratives?date=2026-08-11
```

“研究回放”只显示与当前快照指纹一致的已接受摘要；网页不提供模型调用按钮。审计记录保存输入/输出 SHA-256 指纹、模型标识、受限元数据和验证错误；该表仅服务端可读写，不能向浏览器或 LLM 反向暴露密钥。

审计 `metadata` 不透传调用方对象，仅允许 `runId`、生成时间、延迟、输入/输出 token 数和 temperature。不要将 API Key、Authorization、请求头或完整模型响应放入该参数。

#### 8.2.4 启用一次受控 DeepSeek 验证

先在本机 `.env.local` 和 Vercel Production 配置相同的服务器变量，不要写入 Git、浏览器或 `VITE_` 前缀变量：

```dotenv
DEEPSEEK_RESEARCH_ENABLED=false
DEEPSEEK_RESEARCH_DATA_APPROVED=false
DEEPSEEK_API_KEY=<只放服务器的 DeepSeek Key>
DEEPSEEK_MODEL=<DeepSeek 控制台当前可用的模型 ID>
DEEPSEEK_MAX_DAILY_REQUESTS=1
DEEPSEEK_MAX_OUTPUT_TOKENS=1400
# DEEPSEEK_REQUEST_TIMEOUT_MS=50000
```

第一次保持两个开关为 `false` 部署并检查运行日志；确认模型 ID、每日预算和账户归属后，才考虑把 `DEEPSEEK_RESEARCH_ENABLED` 改为 `true`。即使它为 `true`，服务端仍要求 `DEEPSEEK_RESEARCH_DATA_APPROVED=true` 才会把不可变研究包发送给第三方：这是独立于”功能启用”的人工数据出站确认。代码层硬性限制每日最多 `3` 次请求、单次最多 `1400` 输出 token，即使环境变量误填更大也不会放宽。

`DEEPSEEK_REQUEST_TIMEOUT_MS` 控制单次模型请求的超时时间，单位毫秒，默认 `50000`（50 秒），硬性上限 `90000`（90 秒）。生成 1400 token 响应约需 35–45 秒，25 秒以内的值会导致必然超时；未设置时使用默认值，只有网关延迟极高时才需要调大。DeepSeek 的 JSON 模式需要请求 `response_format: { type: "json_object" }` 且提示词明确要求 JSON；实现已经固定这两点，参考 [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode)。`deepseek-v4-flash` 默认会开启 thinking：若不显式关闭，推理 token 会占满较小的 `max_tokens`，网关返回 `finish_reason=length` 且 `content` 为空，校验就会记成「未完整结束」。JSON 请求因此固定发送 `thinking: { type: "disabled" }` 和 `stream: false`（兼容 OpenAI Chat Completions 网关也接受这两个字段）。

如果使用兼容 OpenAI Chat Completions 的第三方网关，可额外设置仅服务端变量 `DEEPSEEK_API_URL` 为完整 HTTPS `/chat/completions` 地址；未设置时继续使用官方 DeepSeek 地址。该地址、密钥、模型名称和请求限制均必须在本机 `.env.local` 与 Vercel Production 分别配置，绝不能写入 Git 或浏览器变量。先以不含项目数据的最小 JSON 请求确认该网关支持 `response_format: json_object`；在项目维护者明确批准把不可变研究快照发送给该第三方前，不得把 `DEEPSEEK_RESEARCH_DATA_APPROVED` 设为 `true`。

若只批准一次指定快照验证，必须同时设置 `DEEPSEEK_ALLOWED_PACKET_FINGERPRINT=<64 位快照指纹>` 与 `DEEPSEEK_ONE_TIME_VALIDATION=true`。执行器会在任何数据库或网关请求前拒绝其它指纹，返回 `packet_not_approved`；同一指纹一旦已有任意审计尝试，也会永久拒绝后续发送并返回 `one_time_validation_consumed`。换一份新快照（新指纹）可以再批准一次。这项硬限制与每日上限、已接受快照去重共同生效。完成验证后仍应将该变量和两个开关恢复为关闭状态。

完成部署后，唯一的生产验证入口是 `POST /api/cron/validate-approved-research-snapshot`。它必须带 `Authorization: Bearer $CRON_SECRET`，不读取请求体、日期或指纹参数；服务端只会按环境变量中的已批准指纹查询归档快照。运行以下命令前，先在当前终端安全设置 `CRON_SECRET`，不要把真实值粘贴到聊天、Git 或 shell 历史：

```bash
curl --fail-with-body -X POST \
  https://stock-dashboard-psi-henna.vercel.app/api/cron/validate-approved-research-snapshot \
  -H "Authorization: Bearer $CRON_SECRET"
```

响应只含状态、已批准快照日期/指纹、审计 ID 和校验错误数量，不会返回研究包、密钥、上游请求或完整模型输出。无论首次尝试被接受还是拒绝，`DEEPSEEK_ONE_TIME_VALIDATION=true` 都会阻止第二次出站尝试；不要用改变请求参数的方式重试，因为该路由没有可变输入。

#### 8.2.4.1 已执行验证记录

`2026-08-15` 已对批准的 `2026-08-11` 快照执行一次受控验证。审计记录 `7ca68fea-797e-46c9-9ee2-34b503dfceb1` 为 `rejected`，原因是网关没有返回可接受的完整结束状态；系统未发布模型摘要。该结果本身证明固定指纹、服务端审计与拒绝路径均已工作。`2026-08-24` 对本机同一网关做了无项目数据对照：默认 thinking 打开时，`max_tokens=48` 的探针得到 `finish_reason=length`、正文为空；加上 `thinking: { type: "disabled" }` 后得到 `finish_reason=stop` 且 JSON 为 `{"ok":true,"probeVersion":"model-gateway-compatibility-v1"}`。验证后已将 Production 和本机的 `DEEPSEEK_RESEARCH_ENABLED`、`DEEPSEEK_RESEARCH_DATA_APPROVED` 设回 `false`，并移除 Production 的一次性指纹和验证变量；生产 `research-quality` 的 `modelNarrative` 状态为 `disabled`。

后续若要再次验证，必须先使用**不含项目研究数据**的最小请求确认该网关会返回完整结束状态和 JSON 对象，再由维护者重新明确批准一份**尚未尝试过**的不可变快照、单独设置新的指纹与一次性变量。不得复用已经消耗的指纹授权，也不得通过关闭保护重试同一份研究输入。

`2026-08-24` 已对市场日 `2026-08-21` 快照（指纹 `0668ae6f9f6e…7b39`）用生产模型 `deepseek-v4-flash` 执行一次受控验证。审计 `43401531-35b4-4cc7-9079-bbcb0e6cfaaa` 为 `accepted`，校验错误 0。验证后已将 `DEEPSEEK_RESEARCH_ENABLED`、`DEEPSEEK_RESEARCH_DATA_APPROVED`、`DEEPSEEK_ONE_TIME_VALIDATION` 设回 `false`，并移除 `DEEPSEEK_ALLOWED_PACKET_FINGERPRINT`。这仍不打开网页「读一下」的模型出站；解读 AI 必须另做单独确认按钮。

#### 8.2.4.2 无项目数据网关兼容性探针

`POST /api/cron/check-model-gateway-compatibility` 是与研究快照完全分离的协议检查入口。它仅发送固定 JSON：要求返回 `{"ok":true,"probeVersion":"model-gateway-compatibility-v1"}`；不会读取 Supabase 的市场、事件、新闻、持仓或研究包数据。请求仍可能产生模型费用，因此默认关闭，并同时要求 `CRON_SECRET` 与 `DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED=true`。

探针先向仅服务端的 `model_gateway_compatibility_audits` 写入 `pending` 预留记录，再允许请求网关；相同“探针版本 + 提供商 + 模型”组合只能尝试一次。审计只保存状态、`finish_reason`、输出 SHA-256 指纹、受控错误码和耗时，不保存输出原文、请求头、密钥或异常原文。无论成功还是失败，要再次尝试都必须升级探针版本、重新部署并得到新的人工批准，避免反复收费或用探针绕开研究快照出站审批。

在维护者已明确批准后，才临时在本机与 Vercel Production 设置：

```dotenv
DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED=true
```

重新部署后使用以下命令；请求体不会被读取：

```bash
curl --fail-with-body -X POST \
  https://stock-dashboard-psi-henna.vercel.app/api/cron/check-model-gateway-compatibility \
  -H "Authorization: Bearer $CRON_SECRET"
```

完成后立刻把该变量恢复为 `false` 并重新部署。探针成功仅说明网关协议可用，不等同于研究摘要已获批准，也不会开启 `DEEPSEEK_RESEARCH_ENABLED` 或 `DEEPSEEK_RESEARCH_DATA_APPROVED`。

`2026-08-24` 已对 Production 执行两次无项目数据探针，唯一键按模型分开：

- `deepseek-v3.2` 审计 `08b82ea6-ecad-4ac1-83e8-15a9d0ebe9b2` 为 `accepted`（`stop`，校验错误 0）
- 随后生产改为 `deepseek-v4-flash`（与本机对齐，已确认保留）；审计 `2c22bb23-a32a-4eca-af32-e6dfdcbc78b7` 为 `accepted`（`stop`，校验错误 0）

两次均未发送研究数据。验证后已将 `DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED` 设回 `false` 并重新部署。同一「探针版本 + 提供商 + 模型」不可再打。这不批准研究快照出站，「读一下」也仍不调模型。

启用前先使用已归档的历史快照做一次人工、可审计验证：

```bash
set -a
. ./.env.local
set +a
npm run narrative:run -- 2026-08-11
```

命令只打印状态、快照指纹、审计 ID 和校验错误数量，不会输出 Key、请求头或完整上游响应。成功后再次执行应返回 `already_accepted` 而不重复请求模型。若返回 `rejected`，先在 `research_narrative_audits` 排查校验错误，不应手动修改审计记录。

#### 8.2.4.2b 一键受控验证 `narrative:verify`

`narrative:run` 要求快照已归档，且数据出站门控（`DEEPSEEK_RESEARCH_DATA_APPROVED` 等）需手动在 `.env.local` 开关。`narrative:verify` 把整条链路收敛成一条命令，且**门控只存在于该进程内存**——通过临时 `env` 对象传给库，绝不写入 `.env.local` 或导出到全局环境，进程退出即自动关闭：

```bash
set -a
. ./.env.local
set +a
npm run narrative:verify -- 2026-08-14              # 验证已归档快照
npm run narrative:verify -- 2026-08-14 --archive    # 先归档一份干净快照再验证
npm run narrative:verify -- 2026-08-14 --full       # 额外打印标题/复盘/论点/不确定性
npm run narrative:verify -- 2026-08-14 --bypass-limit  # 仅本地：跳过每日上限与一次性消耗
```

脚本流程：生成研究包 → 校验三支柱（`marketState` / `events` / 相似日）均非空 → 确认（或用 `--archive` 归档）对应指纹的快照 → 进程内钉住该指纹开启一次性受控出站 → 调用模型 → 打印审计状态。`--bypass-limit` 仅用于本地一次会话内验证多天，绝不能用于共享或生产运行。`.env.local` 仍需提供 `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` 且 `DEEPSEEK_RESEARCH_ENABLED=true`。

**已知约束（`2026-08-31` 实测）：**

- `DEEPSEEK_MAX_OUTPUT_TOKENS` 过小（旧默认 `900`）在事件多的交易日（如 `2026-08-13` 有 14 事件 + SEC filing）会截断模型响应，返回 `Model response did not finish cleanly`。`2026-08-31` 已把库默认值提到硬上限 `1400`（漏配时也用满血），并把 Vercel Production 显式设为 `1400`；本机 `.env.local` 同步为 `1400`。该值仅在收盘 Cron 运行时读取，无需重新部署即生效。
- 模型早期会把目标日自身误填进 `candidateMarketDates`，被合约校验以「unknown similar-day candidate」拒绝。`2026-08-31` 已在 prompt 收敛此约束（字段说明改为「historical similar-day date; never the target date」并加一条 prohibited）；`2026-08-11` 实测模型改为正确引用 5 个真实历史相似日。收敛仅微增 prompt token，不加长冗余文字——事件多的交易日（如 `2026-08-13` 有 14 事件）叙述本就逼近 `1400` token 上限，堆砌 prompt 会挤占输出导致截断。
- 纯数据类 claim（QQQ 收盘价来自 `marketState`、NDX 权重来自 `ndxSnapshot`）过去没有可引用的 `eventKey`，会被「requires at least one citation」拒绝。`2026-08-31` 已在合约新增第三类可引证据 `baselineKeys`（`market:<symbol>` 与 `ndx-weights`），向后兼容：缺失该字段的旧叙述仍合法。`2026-08-11` 实测模型正确用 `baselineKeys` 引用 QQQ 收盘与 NDX 权重，通过校验。
- 仍待收敛：模型引用 `ndx-weights` 时会额外塞 NDX PDF 的 `sourceUrls`，但当前 `sourceUrls` 只认「已引 event 的来源」，导致「not attached」。baseline 是包内事实，不需外部 URL；下一步在 prompt 明确 baseline 引用不要带 `sourceUrls`，或让 baseline 自带来源白名单。

#### 8.2.4.3 本地绕过速率限制与超时的测试脚本

`scripts/dev-narrative-bypass.js` 用于本地管道调试，不受每日请求配额和生产 fetch 超时限制的约束。它通过两个注入点绕过这两项限制：

- `getAttempts: () => Promise.resolve([])` —— 始终向执行器汇报"今日零次尝试"，因此无论远程审计表实际有多少记录都不会触发 `daily_request_limit`
- `fetchImpl` —— 用 `AbortSignal.timeout(60000)` 替换生产用的 `AbortSignal`，把单次请求硬上限从 50 秒拉高到 60 秒，适合网关延迟偏高的测试环境

运行前加载 `.env.local`（需包含 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`DEEPSEEK_RESEARCH_ENABLED=true`、`DEEPSEEK_RESEARCH_DATA_APPROVED=true`）：

```bash
set -a
. ./.env.local
set +a
node scripts/dev-narrative-bypass.js 2026-08-14
```

脚本只打印 `status`、快照指纹和校验错误；不会输出 API Key、请求头或模型原始响应。它仅用于本地测试，不应出现在 Cron 或生产路径中，也不得用于绕过已接受快照的去重保护。

#### 8.2.5 研究输入快照与回放

每次收盘归档在公共行情、可选 SEC/FRED 采集完成后，会尝试生成当天研究输入包并写入 `research_packet_snapshots`。快照保存完整输入 JSON、去除 `generatedAt` 后的稳定 SHA-256 指纹、来源/事件/审核状态聚合摘要和真实捕获时间。相同市场日、相同事实输入只保留一份，不会因重新运行而覆盖或复制。

指纹使用字段顺序无关的规范 JSON 序列化，因此 Postgres `jsonb` 读回时重排对象键也不会把同一份事实误判为新输入。已在 `2026-08-12` 对远程既有快照执行一次迁移；只有导入了更早版本数据库时，才需再次运行：

```bash
set -a
. ./.env.local
set +a
npm run research-packet:rehash
```

命令会先检查同一市场日是否会归并为重复指纹；存在冲突时会停止，而不会删除或合并任何快照。

默认读取只返回摘要：

```text
GET /api/nasdaq/research-packet-snapshots?date=2026-08-11&limit=10
```

需要回放某次完整 Agent 输入时，显式请求：

```text
GET /api/nasdaq/research-packet-snapshots?date=2026-08-11&includePacket=true
```

网页的“研究回放”导航也使用同一边界：初始只读摘要列表，用户选择某个日期后才请求该日 `includePacket=true` 的完整包。详情分为市场状态、可引用事件、历史相似日、来源/审核汇总与可展开的原始 JSON；它不请求模型、不生成判断，也不会展示用户持仓、密钥或请求头。

手动补一份历史日快照：

```bash
set -a
. ./.env.local
set +a
npm run research-packet:snapshot -- 2026-08-11
```

若当天研究包没有 `QQQ` 市场状态，Cron 记录 `researchPacketSnapshotStatus: skipped`，不会把不完整输入伪装成可回放结论；若快照写入失败，主行情归档仍会成功并在运行详情记录安全错误摘要。

#### 8.2.6 冻结 walk-forward 评估边界

在任何概率模型、校准曲线或 Agent 情景数字上线前，先提交固定评估工件：[data/evaluation/qqq-walk-forward-v1.json](data/evaluation/qqq-walk-forward-v1.json)。它由已存的 `daily_market_features` 与 `market_forward_labels` 生成，当前版本固定为：

- 标的：`QQQ`
- 特征版本：`qqq-daily-state-v1`
- 标签版本：`adjusted-close-forward-v1`
- 目标结果期：未来 20 个交易日
- 初始训练：252 个交易日
- 验证窗口 / 滚动步长：各 63 个交易日
- 训练与验证间 embargo：20 个交易日

每个新验证折的训练集可以包含更早折已经结束的日期，但绝不包含在新验证日尚未成熟的 20 日标签。这样符合扩展式 walk-forward，而不是随机打乱或把未来结果倒灌给训练。

重建候选工件时运行：

```bash
set -a
. ./.env.local
set +a
npm run evaluation:splits
git diff -- data/evaluation/qqq-walk-forward-v1.json
```

只有当特征/标签版本或数据边界发生有意变更，并经过 review 后才提交新工件；不要让日常 Cron 重写它。网页和后续评估器通过只读接口获取已提交版本：

```text
GET /api/nasdaq/evaluation-splits
```

此工件仅定义评估边界，不包含预测、方向准确率或概率，因此不能被解释为投资信号。

#### 8.2.7 概率对照基线

第一份冻结报告为 [data/evaluation/qqq-baseline-evaluation-v1.json](data/evaluation/qqq-baseline-evaluation-v1.json)，只能使用 `qqq-walk-forward-v1` 的 16 折边界。它刻意从两个弱而可解释的参考开始：

- `alwaysUp`：始终以 `1.0` 输出 20 交易日上涨概率
- `conditionalMomentum20d`：按每一折训练集里“当日过去 20 日收益为负 / 非负 / 缺失”的实际后续上涨频率估计概率；验证期的结果不参与拟合

报告只记录每折训练边界、embargo、估计频率和 `Accuracy`、`Balanced Accuracy`、`Brier Score`。`summary` 的普通指标是按验证样本数加权的折级均值，`Balanced Accuracy` 保持折级诊断口径，不能误读为完整生产模型评价。

重建报告：

```bash
set -a
. ./.env.local
set +a
npm run evaluation:baselines
git diff -- data/evaluation/qqq-baseline-evaluation-v1.json
```

只读查询：

```text
GET /api/nasdaq/evaluation-baselines
```

它的用途是为后续 Logistic Regression、校准和情景概率建立“必须优于什么”的对照线；绝不能把报告里的历史分数当作今天上涨概率或交易建议。

#### 8.2.8 Logistic Regression 候选与校准诊断

第一份候选报告为 [data/evaluation/qqq-logistic-evaluation-v1.json](data/evaluation/qqq-logistic-evaluation-v1.json)。模型固定为训练期均值/标准差标准化、训练期均值填补缺失、L2 正则的 batch Logistic Regression；每个验证折独立拟合，绝不复用验证期的标准化参数、标签或概率。

它使用同一份 20 交易日方向目标和 `qqq-walk-forward-v1`，输出：

- 每折的激活特征、训练样本量、标准化统计、系数和超参数
- 逐折与总体的 `Accuracy`、`Balanced Accuracy`、`Brier Score`
- 5 个概率分桶的平均预测概率与实际上涨率，样本不足的分桶必须保留样本数

当前真实 QQQ 报告的 `Brier Score` 为 `0.253391`，没有优于条件动量对照的 `0.248766`，且平衡准确率为 `0.472306`。因此报告固定标记为 `research_only_not_selected`：不能接入当前行情页面、Cron 或 DeepSeek 输入，也不能用于生成投资建议。只有先在预先定义的指标和校准门槛上持续优于对照，才可讨论下一版候选。

重建与查询：

```bash
set -a
. ./.env.local
set +a
npm run evaluation:logistic
git diff -- data/evaluation/qqq-logistic-evaluation-v1.json
```

```text
GET /api/nasdaq/evaluation-logistic
```

#### 8.2.8a Shallow Probability Tree 候选

第二份候选为 [data/evaluation/qqq-tree-evaluation-v1.json](data/evaluation/qqq-tree-evaluation-v1.json)。它是特意受约束的 CART 风格概率树，而不是自动调参的黑盒：最大深度固定为 `2`，每叶最少 `30` 个训练样本；每个节点只在训练期特征的 10 个分位阈值候选中按 Gini gain 选择；缺失值使用对应训练期中位数；叶节点按训练期基础上涨率做 Laplace 平滑。

每个冻结折都重新拟合树与中位数，验证区数据从不参与分裂、填补或概率计算。报告只保留树结构、训练统计、折级/总体指标和 5 分桶校准结果，不保存逐日预测。真实 QQQ 评估为 `Brier Score 0.267957`、`Balanced Accuracy 0.476918`，均未超过条件动量对照，因此持续标记 `research_only_not_selected`，不得接入页面行情、Cron、DeepSeek 或投资建议。

重建与只读查询：

```bash
set -a
. ./.env.local
set +a
npm run evaluation:tree
git diff -- data/evaluation/qqq-tree-evaluation-v1.json
```

```text
GET /api/nasdaq/evaluation-tree
GET /api/nasdaq/evaluation-tree-review
GET /api/nasdaq/evaluation-candidate-reviews
```

#### 8.2.10 概率门控 walk-forward 回测

[data/evaluation/qqq-probability-gated-backtest-v1.json](data/evaluation/qqq-probability-gated-backtest-v1.json) 使用与模型报告完全相同的冻结 16 折：在每个验证折中每 20 个交易日抽取一次样本，使用当时该折训练出的概率；概率至少 `0.5` 才记为持有 QQQ，否则该段记为现金。抽样窗口在每折内不重叠，且所有 20 日结果在评估时都已成熟。

工件只记录聚合的决策次数、持有比例、平均/中位回报、正回报率、复利累计回报和最大回撤；不保存日期级决策、概率或仓位。它未计入成本、税、滑点或实际执行。真实 QQQ 结果中，始终持有的累计模拟回报为 `158.859345%`，条件动量为 `131.725576%`，Logistic 为 `90.353840%`，树为 `109.027750%`，且回撤没有改善。因此它不能作为交易策略、更不能提升任一候选模型。

```bash
set -a
. ./.env.local
set +a
npm run evaluation:backtest
git diff -- data/evaluation/qqq-probability-gated-backtest-v1.json
```

```text
GET /api/nasdaq/evaluation-backtest
```

#### 8.2.9 固定模型晋升门槛与失败标签

任何候选在训练前都必须使用 [lib/model-promotion-governance.js](lib/model-promotion-governance.js) 的 `qqq-model-promotion-policy-v1`。政策不可根据某次评估结果临时放宽，且所有门槛必须同时满足：同一 `qqq-walk-forward-v1` 切分、至少 16 折和 900 个样本、相对 `conditionalMomentum20d` 的 Brier 至少改善 `0.005`、平衡准确率至少改善 `0.005`、每个至少 60 样本的校准分桶绝对误差不超过 `0.10`。

通过只意味着 `eligible_for_human_review`，仍然明确是 `not_deployed`，不会自动生成市场信号、影响 Cron 或交给 DeepSeek。当前 Logistic 与 Shallow Probability Tree 的确定性复核均为 `not_eligible`；两者都由 `brier_improvement`、`balanced_accuracy_improvement`、`calibration` 等失败标签解释，而不是展示无上下文分数。

复核输出还会给出最多 5 个阶段级失败案例：每项仅比较一个冻结验证区间内候选与 `conditionalMomentum20d` 的聚合 Brier/平衡准确率差距，标签为 `probability_degradation` 与/或 `direction_degradation`。为避免把研究工件变成实时信号流，它不保留逐日预测、当前概率或任何交易指令。

只读查询：

```text
GET /api/nasdaq/evaluation-logistic-review
```

#### 8.2.11 研究快照到期结果审计

收盘任务在归档当天研究包后，会额外扫描历史 `research_packet_snapshots`：仅当同一 `market_date` 已拥有成熟的 `market_forward_labels.return_20d_percent` 时，才以 `research-outcome-20d-v1` 追加真实收益、20 日最大回撤和已实现波动率。未成熟标签、休市和缺失数据都会保留为待评估，绝不写成 `0`。

写入采用 `(snapshot_id, evaluation_version)` 唯一键和 `resolution=ignore-duplicates`，因此 Cron 重跑安全。该评估只用于“当时记录的市场研究在事后发生了什么”的审计，不包含模型概率、个人持仓或交易指令；失败时也不会让行情归档任务失败。

可手动重跑：

```bash
set -a
. ./.env.local
set +a
npm run research-outcomes:evaluate
```

只读查询最多返回 30 条公共市场结果，不包含 `snapshot_id`、完整研究包、用户持仓或任何服务端密钥：

```text
GET /api/nasdaq/research-outcomes?limit=12
```

当前远程首个 `2026-08-11` 研究快照尚未有成熟 20 日标签，实测正确返回 `matureOutcomesWritten: 0`。

#### 8.2.12 研究运行健康与脱敏告警

`GET /api/nasdaq/research-health` 使用 Supabase `Content-Range` 的 exact count 计算快照与到期审计总数，不再把分页读取的前 30 条误作全量。响应仅包含最近一次采集的状态、日期、时间与写入事件数，以及 `capture_history_missing`、`capture_failed`、`capture_partial`、`capture_skipped`、`mature_outcomes_pending`、`model_disabled` 等确定性告警。

该公共接口特意不回传 `market_capture_runs.id`、`error_message`、`details`、用户计数、完整研究包或密钥。需要诊断运行状态时，仍必须用 `CRON_SECRET` 调受保护的 `/api/cron/market-history-runs`；该接口同样只返回脱敏的状态、计数和公共观察宇宙失败摘要，绝不返回用户 ID、个人自选标的、原始异常或完整 `details`。

#### 8.2.13 每日确定性研究报告

每次收盘 Cron 成功归档 `research_packet_snapshots` 后，会先按 `(market_date, packet_fingerprint)` 找回同一不可变快照，再向 `daily_research_reports` 写入 `daily-research-report-v1`。报告只包含 QQQ 的已知收盘状态、归档时的事件/来源/审核统计和相似日候选数；它不会调用模型，也不包含预测、目标价、仓位、买卖或任何交易指令。

写入使用 `(snapshot_id, report_version)` 唯一键和 `resolution=ignore-duplicates`，所以同日 Cron 重跑不会覆盖或复制日报。日报生成或写入失败只会以 `dailyResearchReportStatus: failed` 记录在采集运行详情里，既不会丢弃行情归档，也不会阻断到期结果审计。

看板“每日研究事实摘要”与以下只读接口使用同一数据边界，默认最多读取 12 条、最大 30 条：

```text
GET /api/nasdaq/daily-reports?limit=7
```

当前每日确定性事实摘要已完成；周度动态汇总与冻结归档见下一节。两者都不能被视为模型结论或投资建议。

#### 8.2.14 每周确定性事实汇总

`GET /api/nasdaq/weekly-reports?limit=6` 会读取最近最多 30 条 `daily_research_reports`，按纽约自然周（周一开始）聚合为 `weekly-research-report-v1`。输出只包含实际归档的日报天数、首末观察日、两端 QQQ 收盘推导出的已观察区间变化、事件/来源/审核汇总和相似样本计数。

动态周汇总不会由页面或接口写库：它实时派生自不可变日报。`coverage.status` 为 `limited` 表示当周不足 3 个归档日，`substantial` 仅表示已有至少 3 个归档日，均不表示市场周完整或数据质量已经通过人工审核。缺失交易日、假日、未采集会保留为未知，绝不补零或推断。

收盘流程会选择最近一个已经走到最后预期交易日的周来尝试冻结：正常周在周五冻结；如果周五是全天休市，则周四可冻结；假日周若当天没有收盘任务，则会在下一次交易日任务中补做上一个周。只有该周每个预期交易日各自已有至少一份实际归档日报，才会向只追加的 `frozen_weekly_research_reports` 写入 `weekly-research-report-v1`。冻结记录保存 `frozen_at`、预期交易日、全天休市日与日历版本；唯一键 `(week_start, report_version)` 使其不可被同周重跑覆盖。接口优先返回冻结周报；尚未冻结或不符合完整条件的周继续返回动态汇总。

`lib/nyse-trading-calendar.js` 固定了 [NYSE Holidays & Trading Hours](https://www.nyse.com/trade/hours-calendars) 已公布的 2026–2028 年**全天休市**日期。提前收盘仍是有效收盘交易日，必须保留日报。任何跨出这三年范围的周都会显式使用 `strict_weekday_fallback`，继续要求五个工作日，不会把漏采或未知休市猜成完整周。周报不调用模型、不保留用户数据、不输出预测或交易指令。

#### 8.2.15 研究任务账本与看板

`research_task_runs` 是收盘采集的独立、追加式阶段账本。每个进入完整收盘采集流程的 `market_capture_runs.id` 会尝试记录 8 个阶段：`market_collection`、`event_attribution`、`event_labeling`、`research_input_snapshot`、`daily_fact_report`、`weekly_fact_report`、`model_recap`、`outcome_evaluation`。记录保存市场日、固定任务版本、`succeeded / partial / skipped / failed / disabled` 状态及少量公共计数；不保存原始异常文本、用户标识、完整输入包、模型原文、请求头或密钥。

从 `research-task-run-v2` 起，账本还安全保存每次尝试的 `attempt`、入队/开始/结束时间、排队耗时和运行耗时。公共行情 Collector、研究输入、每日事实报告、冻结周报和到期结果审计在确定性网络瞬断（例如超时、`429`、部分 `5xx`）时最多自动再试一次：首次失败和后续尝试会作为两条追加式记录保存，失败码仅为 `retryable_task_failure` 或 `task_failed`，不保存原始错误。非瞬断错误不会盲目重试；模型摘要仍不自动重试，以免增加第三方调用或费用。

`market_collection` 仅追加 `publicRowsWritten`、`unifiedEventsWritten`、`unifiedSourcesWritten` 和 `failedSymbolCount`。只要公共市场快照可用但有个别标的失败，就标记为 `partial`，不把部分成功伪装为完全成功，也不公开失败标的名称。它不表示 SEC、FRED 或其他可选数据源在本次运行中一定成功写入。

唯一键 `(capture_run_id, task_kind, attempt)` 与 `resolution=ignore-duplicates` 保证同一次采集、同一阶段、同一尝试不会重复写入。任务账本失败本身不会阻断行情归档；运行详情仅保留脱敏的 `researchTaskRunStatus` 与实际新增记录数。

网页“研究任务看板”和只读接口读取同一边界：

```text
GET /api/nasdaq/research-tasks?limit=20
```

#### 8.2.16 研究覆盖面板

`GET /api/nasdaq/research-quality` 是只读聚合层，固定使用已有研究健康状态、最近 30 份日报、动态周报、近 30 日归因审核队列和最近 50 条任务账本，返回 `research-quality-v1`。它只提供以下可解释的观察值：已归档快照/日报/周报数量、已成熟和待成熟的 20 交易日结果数量、需人工核对与未审核事件数量，以及每个阶段的最新安全状态。

页面“研究覆盖”只展示这些聚合计数与限制说明。它不会调用模型、不会写入 Supabase、不会公开任务原始错误、审核人、审核备注或完整研究输入，也不会把“有多少材料”表述为数据已完整、归因已正确、预测成立或可以执行交易。

当前生产环境已配置 `SEC_USER_AGENT` 与 `FRED_API_KEY`，Windows 本机已验证手动采集写入。下一次完整收盘 Cron 应自动请求两者，首次自动写入仍需在运行日志中复核。模型网关参数已配置，生产 `DEEPSEEK_MODEL` 为 `deepseek-v4-flash`；`DEEPSEEK_RESEARCH_ENABLED`、`DEEPSEEK_RESEARCH_DATA_APPROVED` 与 `DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED` 保持 `false`，模型摘要不会运行。`deepseek-v3.2` 与 `deepseek-v4-flash` 的无项目数据探针均已 `accepted`，不表示研究数据获准出站。历史运行不做推测性回填。

覆盖面板中的“研究集成准备度”会把内置市场采集固定标为 `ready`，并按当前服务端环境分别显示 SEC、FRED、模型摘要和无项目数据网关探针状态。模型摘要会精确区分 `needs_configuration`（缺少网关参数）、`disabled`（已配置但功能开关关闭）、`data_approval_required`（功能已打开但尚未批准把研究快照发送给第三方）和 `ready`。网关探针只显示 `needs_configuration / disabled / ready`，它不表示研究数据获准出站。这是为多端协作准备的安全检查，不会返回 `SEC_USER_AGENT`、`FRED_API_KEY`、`DEEPSEEK_API_KEY`、联系人、环境变量值或具体配置失败原因；状态为待配置时，按第 6 节和第 13 节在本机 `.env.local` 与 Vercel Production 分别补齐变量后重新部署即可。

覆盖面板还会以最新 QQQ 价格日为基准，读取 `daily_market_features`、`market_forward_labels` 和 `similar_day_matches` 的最近日期，显示 `最新 / 滞后 / 未构建 / 未观测`。这只是只读的新鲜度提示：相似日没有匹配行时不能推断它从未计算过，因此保持 `未观测`；网页和 Cron 都不会自动执行全量重建。需要更新时，仍在受控环境依次运行 `npm run features:qqq`、`npm run labels:qqq`、`npm run similar-days:qqq`，并先检查命令输出。

#### 8.2.16.1 独立确定性事件归因 Agent 与阶段账本

每次成功写入统一市场事件后，收盘流程会运行独立的 `market-attribution-agent-v1`，再向同一个 `capture_run_id` 追加 `event_attribution` 阶段。它只读取已保存的结构化事件：当日涨跌、QQQ 对照、上游规则类别、有限来源关系计数；不会请求模型、不会抓取网页，也不会将新闻正文或 URL 写入新表。

每一条结果写入追加式 `market_event_attributions`，唯一键是 `(event_id, attribution_version, input_fingerprint)`。输入指纹由固定版本与结构化数值/计数组成；同一输入重跑不会新增记录，任何结构化输入或规则版本改变都会留下新的可审计行，而不会覆盖旧结论。分类只能是 `market`、`company`、`mixed` 或 `insufficient_evidence`；后者是默认保守降级，绝不把缺少证据说成单一原因。

`GET /api/nasdaq/attributions?date=2026-08-12` 仅供研究型只读查询。它会对同一事件只返回最近一个版本，并严格省略内部事件 ID、输入指纹、标题、标的、来源 URL、新闻正文、错误和人工审核结论。阶段账本固定记录归因总数、本次新增数、主来源数和证据来源数；归因失败不会回滚已经完成的行情归档，重试遥测继续记录为安全的次数与耗时而不公开原始异常。

它表示“规则归因已实际运行”，不表示人类已经认可因果解释。是否需要人工核对继续由只读审核队列计算；网页仍没有重试按钮或受保护的逐条运维诊断链接。

#### 8.2.16.2 独立事件 Labeler

`event-labeler-agent-v1` 在可选 SEC/FRED 事件采集结束后读取当日统一事件，并把来源完整度、置信度、`available_at` 和事件类型对应的确定性风险标记追加到 `event_rule_labels`。每条记录用 `(event_id, label_version, input_fingerprint)` 幂等：相同事实重跑不重复写入，规则或结构化输入改变会留下新版本。

自动标签只能建议 `accepted` 或 `needs_attention`，且只包含受限的 `code / severity` 数组。它不会写入、更新或删除 `event_review_decisions`；人工 `rejected` 仍是研究输入包过滤事件的唯一依据。任务账本新增 `event_labeling` 阶段，只显示处理数、新写入数和待核对数，不公开事件标题、URL、人工结论或原始错误。

审核队列和研究输入包读取时优先使用已有的最新归档标签；早于 Labeler 上线的历史事件或标签暂缺时才按同一纯规则实时回退。无论标签如何，人工审核状态始终单独保留且优先：`rejected` 才会排除事件，`accepted` 不会删除自动风险标记。

需要验证历史已入库事实时，可运行：

```bash
npm run agents:replay -- 2026-08-12
npm run agents:replay -- 2026-08-12 --apply
```

第一条只输出候选数；第二条才向 `market_event_attributions` 与 `event_rule_labels` 追加记录。它不触发网页抓取、Cron、模型调用或人工审核写入，也不伪造过去的采集时间。

#### 8.2.17 快照级研究流程回放

`GET /api/nasdaq/research-flow?snapshotId=<uuid>` 以单个不可变 `research_packet_snapshots.id` 为唯一入口，精确关联：该输入包、同一 `snapshot_id` 的确定性日报、同一 `packet_fingerprint` 的模型审计状态，以及同一 `snapshot_id` 的 20 交易日结果审计。新建快照还会把保存时的 `capture_run_id` 只用于服务端查询同一次 `research_task_runs`，看板显示已关联的阶段数、总尝试次数、最终尝试编号和安全耗时，并列出八个固定阶段的白名单计数摘要（例如行情/事件行数、归因/证据数、周报归档日数、结果写入数）；不返回内部运行 ID、错误、标的、来源 URL、任务原始 JSON 或密钥。看板“研究输入回放”选择快照后，展示收盘运行、输入归档、每日事实、模型摘要和结果审计五个阶段的真实状态。

模型审计的查询分为两条：所有尝试只读取 `status / provider / model / failure_code / created_at` 摘要；只有 `accepted` 记录才读取并显示已通过校验的叙述。`rejected` 尝试会按固定白名单汇总“响应未完整结束、空响应、无效 JSON、网关 HTTP 异常、网关请求失败、输出契约不通过”；旧行或未知码只标记为未分类历史拒绝。回放绝不读取或返回原始模型文本、验证错误、元数据、请求头或密钥。日报和结果若不存在只标记 `not_archived`，该状态不推断是任务未执行、仍在 20 日窗口中，还是历史记录缺失。

该接口不触发 Cron、模型或写入。迁移之前的历史快照因没有 `capture_run_id` 会标记为 `not_linked`，绝不按日期、时间或日志推断关联；首次新的完整收盘采集后才会出现真实关联回放。Attribution、Labeler 与公共行情 Collector 都具有独立运行和受限重试遥测；Collector 的单次运维摘要可通过受 `CRON_SECRET` 保护的 `/api/cron/market-history-runs?runId=<uuid>` 查询。它只返回固定状态、次数、计数和公共失败摘要，不返回个人标的、用户 ID、原始异常或模型数据。完整跨 Agent 流程回放仍不会伪造缺失阶段。

#### 8.2.18 冻结失败案例的事后市场阶段诊断

`data/evaluation/qqq-evaluation-regime-diagnostic-v1.json` 是独立冻结的 `posthoc_evaluation_interval_diagnostic` 工件。它以 `qqq-walk-forward-v1` 的每个验证区间为边界，基于该区间**已经发生**的 QQQ 调整后收盘路径计算区间收益、最大回撤和年化实现波动，并按固定 `posthoc-qqq-63d-regime-rules-v1` 分类为 `stress_drawdown`、`volatile`、`strong_uptrend`、`strong_downtrend`、`range_bound` 或 `mixed`。

生成命令为：

```bash
set -a; source .env.local; set +a
npm run evaluation:regimes
```

脚本只读 `price_bars_daily`，要求所有冻结验证区间都具有完整价格覆盖；任一折缺失、端点不一致或行数不等于冻结 `observationCount` 时会失败，不会猜测阶段。输出仅保存每折聚合指标、规则、来源覆盖和限制说明，不保存逐日价格、个别预测、当前概率或交易指令。

模型晋升复核将该工件作为事后展示字段加入失败案例，并支持按阶段筛选。它明确不进入训练特征、交叉验证拟合、概率校准、固定晋升门槛、实时市场输入或 Agent 指令，因此不会改变既有候选的 `not_eligible` 结论。

首次部署不会用旧版 `market_capture_runs.details` 猜测补填历史任务。下一次完整美股收盘采集后才会出现第一批真实阶段记录；尚未进入收盘窗口或被提前跳过的运行没有伪造的阶段账本。网页不提供重试按钮，诊断或手动重跑必须继续使用受 `CRON_SECRET` 保护的运维入口。

### 8.3 NDX 成分与权重快照

首个完整快照保存在：

```text
data/ndx/2026-05-01.json
```

来源是 Nasdaq 官方 NDX UCITS 成分 PDF。官方说明权重是指示性数值并四舍五入到两位小数，因此 101 个证券权重合计为 `99.96%`，不应强行归一化成 100%。Alphabet 的两类证券分别计数，所以证券数可以大于公司数 100。

候选快照流程：

```bash
set -a
. ./.env.local
set +a
npm run ndx:discover
npm run ndx:review -- data/ndx/candidates/<official-date>.json --output data/ndx/reviews/<official-date>.json
npm run ndx:import -- data/ndx/candidates/<official-date>.json --approve
```

候选文件必须来自官方来源，并保留其 `sourceUrl`、`effectiveDate` 与 `publishedAt`。`ndx:review` 会与 `data/ndx/` 中最新的已审核快照比较，输出加入/移除、权重变化、总权重变化和来源元数据。导入命令没有 `--approve` 时会主动拒绝写库。

导入不会覆盖旧 `effective_date`：相同生效日只有在来源、发布时间、成分、名称和权重完全一致时才允许幂等重导；任何差异都会被拒绝。对于第二份及以后的快照，服务端还会把差异写入 `ndx_constituent_changes`：`membership_added`、`membership_removed` 和 `weight_changed`。这些行带前后快照、前后权重和生成时间，供后续历史成分回放与 Agent 追溯使用。

导入器校验：

- 证券数在 100-110 之间
- symbol 唯一且格式合法
- 权重非负且总和在 99%-101%
- 来源 URL、快照生效日和发布时间存在
- 排名和 instrument 关联完整

公开查询：

```text
GET /api/nasdaq/constituents
GET /api/nasdaq/constituents?asOf=2026-08-12
```

查询返回 `asOf` 当日或更早的最新快照，并同时返回真实 `effective_date`。早于首个快照的日期返回 404，错误日期格式返回 400。不要把 `asOf=今天` 解读为快照也一定是今天。

默认市场雷达会从数据库最新完整快照选择权重前 12，再加 `QQQ / MAGS`，总请求量保持在 16 以下。数据库或服务端环境变量不可用时，回退到代码内有明确来源日期的小型雷达，不阻断页面。

当前远程验证：1 个快照、101 个唯一成员、101 个唯一排名、权重 `99.96%`、0 个缺失 instrument；`ndx_constituent_changes` 表已建但因还没有第二份快照而为 0 行。后续新增快照只能追加新的 `effective_date`，不得覆盖旧日期来伪造历史。

研究覆盖面板和首页“核心成分总览”都会显示 NDX 成分新鲜度：参考日严格取美东市场日期，与最近已审核 `effective_date` 相差不超过 `45` 天为 `current`，`46–90` 天为 `aging`，超过 `90` 天为 `stale`；快照日期晚于参考日则为 `inconsistent_future`。它只提示维护待办，不会自动抓取、导入或替换官方成分；首页在 `aging / stale` 时还会明确核心观察篮子不等于完整当前成分。截至 `2026-08-15`，现有 `2026-05-01` 快照会正确标记为 `stale`，应通过既有候选审核流程补充下一份官方快照。

#### 8.2.20 财报日历候选导入

`earnings_events` 是独立于市场涨跌事件的服务端表，保存经人工核对的公司 Investor Relations 财报事项。每条记录保存标的、市场日期、可选精确公布时间、`before_market / after_market / during_market / unknown` 时段、`scheduled / reported / cancelled` 状态、可选财务期和来源的可知/采集时间。表已启用 RLS，仅服务端 Secret Key 可读写；浏览器只能读取受限 API。

候选放在 [data/earnings/candidates/](data/earnings/candidates/) 后，先核对公司官方 IR 页面与日期、时段、来源链接，再显式执行：

```bash
npm run earnings:import -- data/earnings/candidates/<file>.json --approve
```

候选可为 JSON 数组或 `{ "events": [...] }`，每项必须含 `symbol`、`marketDate`、`sourceUrl`、`provider` 和 `sourceTitle`。`scheduledAt` 只在官方页面给出确切时点时填写 ISO 时间；只写“盘后”或没有时点时保持空值并使用 `session`，不得补造时间。导入会按标的和官方 URL 生成稳定键、去重来源，并拒绝未注册标的；它不会抓取网页、不会导入估算为实际、不会写入 `events` 市场归因表。

读取接口：`GET /api/nasdaq/earnings?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=100`。动态日历会把这些事项标记为“财报”，单日详情显示来源与时段，并明确不是当日涨跌原因；首页还会读取未来 30 天、最多 8 条已归档事项，直接展示市场日期、时段、状态和官方 IR 原页。空状态仅表示没有当前范围内已核对的候选，不能推导为市场没有财报。当前远程 `earnings_events` 已创建并验证 RLS，已有 1 条已核对记录：NVIDIA `FY2027 Q2` 在 `2026-08-26 13:20 PT`（`20:20 UTC`）预定公布，来源为 `data/earnings/candidates/nvda-fy2027-q2-2026-08-26.json` 中保留的官方 IR 原页；它仍是 `scheduled`，不代表已公布结果。

### 8.4 Nasdaq 动态日历与单日详情

启动本地服务后可公开读取：

```text
GET /api/nasdaq/calendar?month=2026-08
GET /api/nasdaq/calendar?date=2026-08-11
```

页面“直达市场日期”会将输入严格校验为真实 `YYYY-MM-DD` 日期，再切换对应月份并读取同一条单日详情 API；点击任意日历日期后输入值也会同步。它支持回看已归档交易日、周末和未来日期，但只展示已有行情、事件、财报和研究材料，缺失数据不会被补写成涨跌原因。

月份模式返回自然月内的每一天，并按美东市场日期区分：

- `trading`：存在已入库的 `QQQ` 日线
- `weekend`：已过去的周末
- `upcoming`：尚未到来的日期
- `closed-or-missing`：已过去但没有价格的工作日；在没有正式交易所日历前，不武断标记为法定休市

交易日卡片包含 `QQQ` OHLCV、涨跌幅、截至当日最近 20 个交易日的年化后视波动率、统一事件数量、最高影响等级和涉及标的。后视波动率只读取该日及以前的价格。

日期模式额外返回：

- 当天的完整统一事件、来源和实体关系
- 当日或更早的最新 NDX 成分权重快照及权重前 10
- 未来 1/3/5/20 日收益、20 日最大回撤和实现波动率标签

未来标签位于 `researchOutcome`，页面标记为 `RESEARCH ONLY / 事后验证`。它只能解释历史结果，禁止进入当日特征、归因或预测输入。最近尚未成熟的标签保持 `null`，不能用 `0` 代替。

当前真实联调基线：

- `2026-08` 返回 31 个自然日
- `2026-08-11` 能返回 `QQQ` 行情、统一事件证据关系和 `2026-05-01` NDX 快照
- 非法日期（例如 `2026-02-31`）返回 `400`

#### 8.4.1 新人关联解读（手动触发）

产品规格见 [docs/beginner-reading.md](docs/beginner-reading.md)。这是页面讲解层，不是采集、Cron 或 DeepSeek 摘要。

第一期已落地：

- 模板：`lib/beginner-reading.mjs`（`beginner-reading-v1`）
- 测试：`test/beginner-reading.test.mjs`
- 首页卡片：`#beginnerReadingHome`，默认只有说明和「读一下今天」
- 日历单日：`#calendarBeginnerReading`，默认「读一下这一天」；切日期会丢掉上一篇
- 接线：`app.js` 只在 `data-beginner-reading-action="generate|collapse"` 的 click 里调用 `buildBeginnerReading`；`init`、`refreshQuotes`、自动刷新计时器都不得生成正文

点击时只用当时已经在内存里的数据：行情、当日事件、`current-scenario`、已加载的 earnings、个人观察；日历侧在详情尚未返回时先加载该日详情再生成，仍算一次手动触发。正文不写入 `localStorage`、云同步或研究快照。预定财报只能写成日历事项，不能解释当天涨跌。按钮不调用 DeepSeek，也不写 `research_narrative_audits`。

验证：

```bash
node --test test/beginner-reading.test.mjs
```

打开本地页面后确认：未点击时没有五段正文；点击后出现五段；再刷新行情，正文不变，必须点「按当前页面再读一次」才会重算。

### 8.5 日度相似日输入特征

日度特征是后续“历史相似日”计算的唯一基础输入，当前只覆盖 `QQQ` 的价格、成交量和已知事件状态。它与 `market_forward_labels` 严格分表：前者只记录当日收盘时已经可知的信息，后者只用于事后研究。

重建或幂等回填：

```bash
set -a
. ./.env.local
set +a
npm run features:qqq
```

查询：

```text
GET /api/nasdaq/features?symbol=QQQ&limit=365
GET /api/nasdaq/features?symbol=QQQ&date=2026-08-11
```

特征版本当前为 `qqq-daily-state-v1`。价格特征只使用该日及以前的日线；事件特征只保留 `available_at` 不晚于该日美东 `16:00` 的事件。此规则会排除事后采集、后来才发现或只有归因价值的事件，避免未来数据泄漏。

当前回填验证：

- `1,254` 行，`2021-08-12` 至 `2026-08-11`
- `1,234` 行具备成熟 20 日前瞻研究标签，标签不参与特征
- 当前可用事件天数为 `0`，因为现有 14 条统一事件都在对应交易日收盘后才被本系统获得

### 8.6 历史相似日研究基线

相似日结果用于回看历史市场状态，不构成买卖建议或对未来的预测。当前方法版本为 `qqq-price-state-v1`，只比较 QQQ 收盘时已知的四组输入：

- 动量：1 / 5 / 20 日收益与当日跳空
- 风险：过去 20 个交易日的年化波动率与回撤
- 参与度：当日成交量相对过去 20 日均量
- 已知事件：截至当日美东 `16:00` 已获得的统一事件；当前事件样本尚未满足该时间规则，因此该项不参与实际区分

标准化参数只由目标日期之前的至少 60 个交易日拟合。候选日必须早于目标日，且其未来 20 个交易日研究结果在目标日当时已经成熟；不同候选日之间至少相隔 20 个交易日。这样候选与分数不会读取目标日之后的信息。

重建全部历史匹配：

```bash
set -a
. ./.env.local
set +a
npm run similar-days:qqq
```

公开查询：

```text
GET /api/nasdaq/similar-days?date=2026-08-11&limit=5
GET /api/nasdaq/current-scenario
```

响应会返回相似度总分、动量/风险/成交量/事件分项、候选日以及该候选日后续 1 / 3 / 5 / 20 日收益、20 日最大回撤和实现波动率。历史候选结果仅用于研究验证，不能直接当成当前市场的预期收益。

响应中的 `summary` 只对本次返回的前 N 个已成熟候选做描述统计：

- `candidateCount`：当前候选数，默认最多 5，不是训练样本总量
- `return5d / return20d`：可用数、正收益数、历史正收益频率、均值、中位数和 25/75 分位
- `maxDrawdown20d`：均值、中位数、25/75 分位与候选集中最差回撤

UI 将它称为“候选结果分布”。正收益频率必须标记为历史频率，不得改写成预测概率；候选少于 5 个时必须展示小样本提示。缺失或未成熟数据不补零。

首页“当前历史情景”通过 `GET /api/nasdaq/current-scenario` 读取同一份最新 QQQ 物化结果，但仅返回目标市场日期、方法版本、最多 5 个候选的聚合统计和边界说明，不返回候选日期、分项分数、原始数据库字段或个人数据。接口和首页均不触发重建、Cron、模型调用或对第三方的数据传输。它始终以“历史经验分布”呈现：历史正收益频率不是当前预测概率，历史中位收益也不是收益预期或交易指令。

当前真实回填基线：

- `1,193` 个具备可用相似日的目标交易日
- `5,848` 条匹配，覆盖 `2021-11-08` 至 `2026-08-11`
- 每个目标日最多返回 5 个候选日；历史不足时明确返回空结果而不是伪造分数

### 8.7 收盘归档验证

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

如需查看某一次运行的脱敏 Collector 摘要，使用响应中的 `runId`：

```powershell
$cronSecretForTest = Read-Host '请输入本地 CRON_SECRET'
$runId = Read-Host '请输入 UUID 格式的 runId'
$cronHeaders = @{ Authorization = "Bearer $cronSecretForTest" }
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/cron/market-history-runs?runId=$runId" -Headers $cronHeaders
Remove-Variable cronSecretForTest, runId, cronHeaders
```

该查询不是网页接口，且只返回脱敏的状态、计数、重试次数及公共观察宇宙失败摘要。

手动入口不会绕过美东收盘时间和上游行情日期检查，也不支持为任意历史日期倒推新闻原因。

可能结果：

- `401 Unauthorized`：本地环境没有 `CRON_SECRET`，或请求值不一致
- `500 Missing SUPABASE_URL or SUPABASE_SECRET_KEY`：服务端变量未加载
- `skipped: true`：尚未进入美股收盘后的归档窗口，属于正常保护
- `ok: true` 且包含 `savedEvents`：任务已执行并写入历史表
- `status: partial`：至少一个用户成功或正常跳过，同时有其他用户失败
- `status: failed`：本次所有可处理用户都失败，接口返回 `502`
- `fredMacroStatus: disabled`：未配置 `FRED_API_KEY`，属于正常保护；`succeeded` / `failed` 会同时附带 FRED 写入数量或安全错误摘要

每次授权调用都会写入 `market_capture_runs`，包括因未到收盘时间而产生的 `skipped`。日志保存触发类型、状态、市场日期、耗时、用户数量、写入数量和失败摘要，不保存 Secret。

不要为了测试而删除收盘时间保护。需要稳定测试时，应为时间判断和抓取层补单元测试，而不是修改生产规则。

## 9. 部署与生产验证

部署生产环境：

```powershell
npx vercel --global-config $vercelConfigDir --prod
```

部署后检查：

1. 生产首页正常访问。
2. Vercel → Project → `Settings → Environment Variables` 中 `SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`CRON_SECRET`、`SEC_USER_AGENT` 和 `FRED_API_KEY` 都属于 Production。
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
- “决策日志”只记录用户已经做过的动作与理由，属个人研究记录，系统不生成任何买卖建议或概率；`action` 全部是中性的既成动作词（买入/加仓/减仓/清仓/继续持有/观望/放弃）

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
- 决策日志的记录、补录结果与删除，以及刷新后本地持久化
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

通用方案：使用第 4 节的 `--global-config $vercelConfigDir`，避开 Roaming 配置目录。

当前 Windows 本机（`E:\ecode\other\le-web`）用的是另一套固定 wrapper `C:\vcli\vc.cmd`（重定向 `XDG_DATA_HOME` + 注入 Clash 代理），详见第 0 节；本机所有 Vercel 命令都通过它调用，不要直接敲 `vercel` / `npx vercel`。

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

DeepSeek 摘要是可选功能，默认关闭。它使用下列服务端变量：`DEEPSEEK_RESEARCH_ENABLED`、`DEEPSEEK_RESEARCH_DATA_APPROVED`、`DEEPSEEK_API_KEY`、`DEEPSEEK_API_URL`、`DEEPSEEK_MODEL`、`DEEPSEEK_MAX_DAILY_REQUESTS`、`DEEPSEEK_MAX_OUTPUT_TOKENS`。当前生产与本机模型均为 `deepseek-v4-flash`。启用前必须先设置不超过预算的每日请求数，并在 Vercel Production 与本机 `.env.local` 分别配置；无需在 Vercel Development 保存 Secret。无项目数据的协议探针另用 `DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED`，它不替代研究快照的两道出站开关；唯一键是 `(probe_version, provider, model)`，换模型等于新的一次额度。

以后增加其他 AI 摘要或收费数据源时，应在接入代码的同一变更中：

1. 更新 `.env.example`，只增加变量名和占位值。
2. 更新本文档的用途、获取路径和安全边界。
3. 在 Vercel Preview/Production 分别配置。
4. 增加缺少变量时的明确错误或功能降级。
