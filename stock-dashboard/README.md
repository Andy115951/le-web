# Stock Dashboard

围绕纳指与美国七巨头的股票决策看板。

长期产品目标、完整功能范围、数据体系、Agent 分工和分阶段计划见 [ROADMAP.md](ROADMAP.md)；本地环境与部署见 [DEVELOPMENT.md](DEVELOPMENT.md)。

当前这版重点支持：

- `QQQ` / `MAGS` / 七巨头跟踪
- 自选股列表、分组、搜索、排序、分页
- 持仓上下文：成本价、股数、持仓类型
- 今日需要处理：按回撤纪律、目标价、相对 `QQQ`、当日跌幅生成行动队列
- 当日涨跌线索：自动抓取 `QQQ` 对照与公司公开资讯，保存最近 14 天的可复核事件快照
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
- 成本价、股数、持仓类型、目标价、峰值回撤、回撤止盈规则
- 顶部市场概览、七巨头总览、相对 `QQQ` 强弱排序
- 决策工作区：把持仓盈亏、回撤纪律、目标价距离整理成摘要
- 决策优先 UI：顶部行动队列 + 收敛后的自选表格
- 当日市场线索：区分市场同向、个股资讯、混合因素与证据不足；新闻原文链接保留供复核
- 历史归档基础：独立 `market_event_history` 表、30/90/180 天时间轴、收盘后自动补抓入口
- 采集可观测性：每次 Cron/手动重跑写入 `market_capture_runs`，记录状态、耗时、用户数、写入数和失败摘要
- 采集任务支持单用户失败隔离，不会因一个用户异常中断整批任务
- 受 `CRON_SECRET` 保护的手动重跑与最近运行记录接口

### 当前版本重点

- 顶部 `今日需要处理` 只展示需要判断的信号，避免用户在完整表格里找重点
- 信号优先级固定为：回撤纪律、目标已到、临近目标、明显跑输 `QQQ`、当日大跌
- 自选表格保留决策字段，更多上下文放到移动卡片、详情分析、规则面板里
- 当前信号是确定性规则，不是 AI 投资建议
- 当日涨跌线索是基于同期 `QQQ` 表现和公开新闻做的关联判断，不宣称单一新闻必然导致涨跌
- 历史归因从现在开始持续积累；价格可以补历史，但过去某日的新闻原因不做无证据倒推

### 下一阶段

1. 登录线上看板并同步首份自选数据，验证下一次收盘任务实际写入历史表
2. 建立 `market_days`、`instruments`、`price_bars_daily`，开始 QQQ 市场记忆数据层
3. 选择长期行情供应商并回填至少 5 年 QQQ 日线
4. 实现第一个动态日历和单日详情页

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
- `api/cron/capture-market-history.js`: 收盘后自动归档入口
- `api/cron/market-history-runs.js`: 最近采集运行记录接口
- `lib/a-share-data.js`: A 股分析数据层
- `lib/global-stock-data.js`: 美股分析数据层
- `lib/daily-market-events.js`: 当日涨跌线索、`QQQ` 对照与新闻关联规则
- `lib/market-history-capture.js`: 受保护的 Supabase 历史归档任务
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

历史看板有两条写入路径：

1. 你刷新页面时，已登录用户会立即把当天事件写入 `market_event_history`。
2. 即使没有打开页面，Vercel Cron 也会在每个美股交易日收盘后读取云端自选列表并补抓当天快照。

历史页面默认展示 30 天，可切换到 90 或 180 天；按交易日展开后，可以查看当日每只股票的涨跌幅、`QQQ` 对照、归因类型和新闻原文。

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
