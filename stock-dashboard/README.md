# Stock Dashboard

以 Nasdaq-100 市场环境、核心权重股和关联新闻为主线的市场情报看板。个人自选和持仓是辅助层，不再决定主页面是否有数据。

长期产品目标、完整功能范围、数据体系、Agent 分工和分阶段计划见 [ROADMAP.md](ROADMAP.md)；本地环境与部署见 [DEVELOPMENT.md](DEVELOPMENT.md)。

当前这版重点支持：

- 无需登录或配置自选即可运行的 Nasdaq 核心雷达
- `QQQ`、`MAGS`、官方权重靠前成分及相关科技龙头跟踪
- 近 36 小时动态新闻流：按公司名/Ticker/纳指主题词过滤，并按标题聚合去重
- 自选股列表、分组、搜索、排序、分页
- 持仓上下文：成本价、股数、持仓类型
- 今日需要处理：按回撤纪律、目标价、相对 `QQQ`、当日跌幅生成行动队列
- 当日涨跌线索：自动抓取核心雷达、`QQQ` 对照与公司公开资讯，保存最近 14 天的本地可复核快照
- 涨跌历史看板：按交易日查看每只股票的收盘涨跌、`QQQ` 对照、归因类别和原文证据
- 决策优先表格：聚焦最新价、涨跌幅、相对 `QQQ`、峰值回撤与建议动作
- 决策工作区：基于持仓浮盈亏、回撤规则、目标价距离生成摘要
- 相对 `QQQ` 强弱比较
- 峰值回撤跟踪
- 目标价与到价提醒
- 回撤止盈规则
- A 股 / 美股分析弹层
- 可选 `Supabase` 云同步

当前生产地址：

- `https://stock-dashboard-psi-henna.vercel.app`

## 当前开发进度

### 已完成

- 本地自选股管理与浏览器持久化
- `Supabase` 可选云同步与多端开发说明
- A 股 / 美股详情分析接口
- 纳指、`MAGS`、美国七巨头的默认追踪逻辑
- Nasdaq 核心雷达独立于个人自选刷新，当前观察宇宙不超过 16 个标的
- 动态新闻聚合、去重和结构化标题相关性过滤
- 未登录状态下也能查看本机最近 14 天的 Nasdaq 日度脉络
- 成本价、股数、持仓类型、目标价、峰值回撤、回撤止盈规则
- 顶部 Nasdaq 环境、核心成分总览、相对 `QQQ` 强弱排序
- 决策工作区：把持仓盈亏、回撤纪律、目标价距离整理成摘要
- 决策优先 UI：顶部行动队列 + 收敛后的自选表格
- 当日市场线索：区分市场同向、个股资讯、混合因素与证据不足；新闻原文链接保留供复核
- 历史归档基础：独立 `market_event_history` 表、30/90/180 天时间轴、收盘后自动补抓入口
- 公共 Nasdaq 历史：独立 `nasdaq_market_event_history` 表，不绑定用户账号；页面经服务端 API 读取
- 采集可观测性：每次 Cron/手动重跑写入 `market_capture_runs`，记录状态、耗时、用户数、写入数和失败摘要
- 采集任务支持单用户失败隔离，不会因一个用户异常中断整批任务
- 受 `CRON_SECRET` 保护的手动重跑与最近运行记录接口
- 标准公共行情层：`instruments`、`market_days`、`price_bars_daily`，均由服务端密钥访问
- `QQQ` 五年日线已回填：1,254 个唯一交易日，覆盖 `2021-08-12` 至 `2026-08-11`
- 公共日线查询接口：`GET /api/nasdaq/prices?symbol=QQQ&limit=1254`
- 前瞻研究标签：未来 1/3/5/20 日收益、20 日最大回撤和年化实现波动率
- 标签查询接口：`GET /api/nasdaq/labels?symbol=QQQ&limit=1254`，明确标记为研究专用
- 统一事件与来源层：`sources / events / event_sources / event_entities`，支持 URL 去重、证据关系和标的关系
- 统一事件接口：`GET /api/nasdaq/events?days=30|90|180`
- 事件人工复核：追加式 `event_review_decisions` 审计记录、确定性待复核规则和只读队列；不会覆盖原始事件
- 待复核队列接口：`GET /api/nasdaq/review-queue?days=30|90|180`
- NDX 历史成分与权重快照：首个完整官方快照含 101 个证券，生效日 `2026-05-01`，权重合计 `99.96%`
- 成分查询接口：`GET /api/nasdaq/constituents?asOf=YYYY-MM-DD`
- NDX 候选快照审核：先发现候选、生成并检查差异报告，再以显式 `--approve` 导入；导入后会保存加入、移除和权重变化事件
- 核心新闻雷达改为从最新完整快照动态选取权重前 12，并保留 `QQQ / MAGS` 基准篮子
- Nasdaq 动态月历：按美东市场日期展示 `QQQ` 涨跌、20 日后视波动状态、事件数量和最高影响等级
- 单日详情：同屏查看 `QQQ` 行情、统一事件时间线、原始证据链接和当日有效的 NDX 权重快照
- 日历查询接口：`GET /api/nasdaq/calendar?month=YYYY-MM` 和 `GET /api/nasdaq/calendar?date=YYYY-MM-DD`
- 事后研究结果与当日信息严格分区，未来 1/3/5/20 日标签不会作为实时判断输入
- 日度特征层：`daily_market_features` 固化每个交易日当时可知的价格状态、成交量状态和事件状态，供后续相似日计算复用
- 特征查询接口：`GET /api/nasdaq/features?symbol=QQQ&limit=365`，支持 `date=YYYY-MM-DD` 精确读取
- 历史相似日基线：按目标日之前的特征分布匹配非连续历史阶段，并展示已成熟的后续表现
- 相似日查询接口：`GET /api/nasdaq/similar-days?date=YYYY-MM-DD&limit=5`，已嵌入日历单日详情
- 相似日结果分布：对当前候选集计算 5/20 日历史胜率、中位收益、四分位范围和 20 日回撤，不把小样本写成预测概率
- SEC EDGAR filings 骨架：可将核心标的的 `10-K / 10-Q / 8-K / 20-F / 40-F / 6-K` 以官方归档链接、接受时间和 CIK 写入统一事件层；配置合规 `SEC_USER_AGENT` 后启用
- FRED 宏观观测骨架：可把 `CPIAUCSL / UNRATE / FEDFUNDS / GDPC1` 的官方 FRED 观测写入统一事件层；配置服务端 `FRED_API_KEY` 后启用，未配置时保持禁用
- 日度研究输入包：`GET /api/nasdaq/research-packet?date=YYYY-MM-DD` 固定后续 AI/日报可读取的泄漏安全事实边界，并按“上一交易日收盘到目标日收盘”筛选可知事件；当前不调用模型、不输出建议
- 研究摘要输出契约：未来 DeepSeek/LLM 输出必须通过来源引用、越权语言和输入/输出指纹验证；审计表已就绪，但当前没有调用模型
- 输出契约查询：`GET /api/nasdaq/research-narrative-contract?date=YYYY-MM-DD` 提供该日期允许引用的证据与固定 JSON 结构

### 当前版本重点

- 页面优先级固定为：Nasdaq 环境 → 动态新闻 → 日度脉络 → 个人信号与持仓
- `个人信号` 只展示需要判断的个人规则，不与公共市场新闻混在一起
- 信号优先级固定为：回撤纪律、目标已到、临近目标、明显跑输 `QQQ`、当日大跌
- 自选表格保留决策字段，更多上下文放到移动卡片、详情分析、规则面板里
- 当前信号是确定性规则，不是 AI 投资建议
- 当日涨跌线索是基于同期 `QQQ` 表现和公开新闻做的关联判断，不宣称单一新闻必然导致涨跌
- 历史归因从现在开始持续积累；价格可以补历史，但过去某日的新闻原因不做无证据倒推

### 下一阶段

1. 配置并验证 SEC EDGAR 与 FRED 的生产采集，再接入公司 IR、财报日历
2. 为相似日增加宏观、行业和官方公司事件特征，扩大可复核样本
3. 基于冻结的时间切分开始情景概率基线与校准评估

## 技术结构

- 前端：原生 `HTML + CSS + ES Modules`
- 本地存储：浏览器 `localStorage`
- 云同步：`Supabase Auth + watchlist_states`
- 服务端接口：`Vercel Functions`
- 外部行情源：
  - A 股：东方财富、腾讯财经
  - 美股：Yahoo Finance

## 目录说明

- `index.html`: 页面结构
- `app.js`: 主交互逻辑
- `storage.js`: 本地数据、默认股票、偏好设置
- `quotes.js`: 行情拉取
- `cloud.js`: Supabase 云同步
- `api/a-share/detail.js`: A 股分析接口
- `api/global-stock/detail.js`: 美股分析接口
- `api/global-stock/daily-events.js`: 当日行情事件接口
- `api/nasdaq/[resource].js`: 统一 Nasdaq 只读入口；保留 `/api/nasdaq/history`、`/prices`、`/labels`、`/events`、`/constituents`、`/calendar`、`/features`、`/similar-days` 等资源 URL
- `api/cron/capture-market-history.js`: 收盘后自动归档入口
- `api/cron/market-history-runs.js`: 最近采集运行记录接口
- `lib/a-share-data.js`: A 股分析数据层
- `lib/global-stock-data.js`: 美股分析数据层
- `lib/daily-market-events.js`: 当日涨跌线索、`QQQ` 对照与新闻关联规则
- `lib/nasdaq-universe.js`: 当前核心观察宇宙、来源日期和默认标的
- `lib/market-history-capture.js`: 受保护的 Supabase 历史归档任务
- `lib/historical-market-data.js`: Yahoo 日线抓取、时区转换和数据校验
- `lib/price-history-store.js`: 标准日线回填与查询
- `lib/market-forward-labels.js`: 前瞻收益、回撤和波动率纯计算逻辑
- `lib/market-label-store.js`: 标签重算、写库与查询
- `lib/unified-market-events.js`: 来源规范化、事件双写、关系维护和统一读取
- `lib/event-review.js`: 确定性复核分类、最新人工结论读取与追加式审核写入
- `scripts/review-unified-events.js`: 列出待复核事件或追加人工审核结论的受控 CLI
- `lib/ndx-snapshots.js`: NDX 快照校验、导入、版本查询与动态雷达选择依据
- `lib/ndx-snapshot-review.js`: NDX 快照差异计算与成分变更事件行生成
- `data/ndx/candidates/`: 待人工审核的官方候选快照
- `data/ndx/reviews/`: 可提交、可复核的候选差异报告
- `lib/market-calendar.js`: 按美东市场日期聚合 QQQ、后视波动、事件、研究标签和成分快照
- `lib/daily-market-features.js`: 纯函数形式的日度价格/事件特征计算与美东收盘时间截断
- `lib/daily-feature-store.js`: 日度特征的幂等重算、存储和查询
- `lib/similar-days.js`: 无未来数据泄漏的相似度基线纯计算
- `lib/similar-day-store.js`: 相似日结果的重算、物化和查询
- `lib/sec-edgar.js`: SEC 公司映射、filings 采集、接受时间处理与统一事件记录构建
- `scripts/capture-sec-filings.js`: 手动采集核心标的 SEC filings 的受控入口
- `lib/fred-macro.js`: FRED 宏观观测采集、稳定事件键与不伪造发布时间的时间边界
- `scripts/capture-fred-macro.js`: 手动采集 FRED 宏观观测的受控入口
- `lib/daily-research-packet.js`: 为未来报告/Agent 固定市场状态、跨收盘可知事件、来源与历史相似日的只读契约
- `lib/research-narrative-contract.js`: 未来 LLM 市场复盘的引用约束、禁止语义与输出验证
- `lib/research-narrative-audit.js`: 服务端审计写入；记录版本、指纹、验证结果与原始模型 JSON
- `data/ndx/`: 经校验且保留官方来源日期的 NDX 结构化快照
- `lib/cron-auth.js`: Cron/运维接口统一鉴权与 JSON 响应
- `vercel.json`: 每个工作日一次的收盘后 Cron 配置
- `SUPABASE_SETUP.md`: 云同步建表与配置说明

## 本地开发

这个项目不是纯静态页。

原因：

- 页面本体可以静态打开
- 但 `分析` 功能依赖 `api/` 下的本地函数
- 所以本地开发建议直接用 `vercel dev`

完整的 Windows/Vercel/Supabase 环境准备、环境变量、Cron 测试、部署和排错流程见 [DEVELOPMENT.md](DEVELOPMENT.md)。

## 涨跌历史的运行方式

无需登录时，页面优先从服务端 `nasdaq_market_event_history` 读取 30/90/180 天公共记录；接口暂时不可用时，回退到当前浏览器最近 14 天的数据。个人云同步只负责持仓和偏好。

历史看板有两条写入路径：

1. 你刷新页面时，核心雷达会直接抓取当天行情和相关资讯，不依赖个人自选。
2. Vercel Cron 在收盘后优先把核心雷达写入公共 `nasdaq_market_event_history`。
3. 已登录用户仍可把个人事件兼容写入 `market_event_history`，但它不影响公共归档是否成功。

当前核心观察名单参考 Nasdaq 官方 2026-06-30 NDX Fact Sheet 的权重信息，并额外保留 `QQQ`、`MAGS`、`META` 和 `AVGO` 作为市场/主题参照。它是受服务端请求量约束的新闻雷达，不等同于完整且永久不变的 Nasdaq-100 成分表；来源见 <https://indexes.nasdaq.com/docs/FS_NDX.pdf>。

详细的建表、权限、环境变量与 Cron 配置见 [SUPABASE_SETUP.md](SUPABASE_SETUP.md)。

### 首次准备

1. 安装并登录 Vercel CLI

```bash
brew install vercel-cli
vercel login
```

2. 进入项目目录

```bash
cd /Users/apple/Documents/code/other/le-web/stock-dashboard
```

3. 新设备首次开发时，绑定到已存在的 Vercel 项目

```bash
vercel link
```

选择：

- Scope: 你的团队 / 账号
- Project: `stock-dashboard`

### 启动本地服务

```bash
cd /Users/apple/Documents/code/other/le-web/stock-dashboard
vercel dev
```

本地地址通常是：

- `http://localhost:3000`

如果端口被占用，Vercel CLI 会自动换端口，请以终端输出为准。

## 生产部署

在当前目录执行：

```bash
cd /Users/apple/Documents/code/other/le-web/stock-dashboard
vercel --prod --yes
```

如果只是想先预览：

```bash
vercel
```

## 多端开发

如果你要在另一台电脑继续开发，建议按下面步骤走。

### 必做步骤

1. 拉取代码仓库
2. 安装 Vercel CLI
3. `vercel login`
4. 进入 `stock-dashboard/`
5. `vercel link`
6. `vercel dev`

### 云同步接手步骤

如果你还要继续使用云同步：

1. 打开本地页面
2. 在页面中填入：
   - `Supabase URL`
   - `Supabase Anon Key`
3. 点击 `保存云配置`
4. 输入你的邮箱
5. 点击 `发送登录链接`
6. 邮箱验证后返回页面

### 当前环境变量情况

当前这个项目：

- 页面行情与基础分析不依赖服务端私密环境变量
- `Supabase URL` 和 `Supabase Anon Key` 由页面输入并保存在浏览器本地
- 每日收盘历史归档依赖服务端的 `SUPABASE_URL`、`SUPABASE_SECRET_KEY` 和 `CRON_SECRET`
- 当前也没有接 `OpenAI / DeepSeek` 这类模型密钥

所以目前多端开发比较轻：

- 登录同一个 `Vercel` 账号
- 登录同一个 `Supabase` 项目
- 在新设备页面重新填一次 `Supabase URL / Anon Key`

就能继续开发和同步数据。

### 哪些东西不会自动同步

下面这些是本机本地状态，不会跟着 git 自动同步：

- 浏览器 `localStorage`
- Supabase 页面里保存的云配置输入值
- 邮箱登录 session
- `.vercel/`

说明：

- `.vercel/` 只保存本机到 Vercel 项目的链接信息
- 它已经被 `.gitignore` 忽略
- 不要把它手动提交进仓库

## 数据同步说明

本地默认用 `localStorage` 保存：

- 自选股列表
- 排序 / 筛选 / 自动刷新偏好
- 峰值回撤数据
- 持仓字段：`costBasis / shares / holdingType`

开启云同步后，会把这些内容同步到 Supabase 的：

- `watchlist_states`

表结构见：

- [SUPABASE_SETUP.md](/Users/apple/Documents/code/other/le-web/stock-dashboard/SUPABASE_SETUP.md)

## 当前项目绑定信息

- Vercel Project Name: `stock-dashboard`
- 当前生产地址: `https://stock-dashboard-psi-henna.vercel.app`

## 后续建议

如果后面继续把它往“智能决策智能体”方向做，建议按下面顺序补能力：

1. 图表层
   - `QQQ` 与七巨头走势对比
   - 个股相对 `QQQ` 的趋势变化
   - 回撤曲线与峰值变化

2. 决策日志层
   - 买入 / 卖出 / 继续持有的记录
   - 当时价格、仓位、理由、后续结果
   - 后续可用于训练个人纪律复盘

3. 事件上下文
   - 财报日期
   - 分析师目标价变化
   - 重大公告 / 新闻标签

4. AI 决策层
   - 接入你的个人持仓纪律
   - 生成盘前 / 收盘复盘摘要
   - 后续可接 DeepSeek 或其他模型做解释层

5. 正式环境变量管理
   - `.env.example`
   - `vercel env pull`
   - 模型密钥 / 数据供应商密钥统一管理
