# Stock Dashboard

以 Nasdaq-100 市场环境、核心权重股和关联新闻为主线的市场情报看板。个人自选和持仓是辅助层，不再决定主页面是否有数据。

长期产品目标、完整功能范围、数据体系、Agent 分工和分阶段计划见 [ROADMAP.md](ROADMAP.md)；本地环境与部署见 [DEVELOPMENT.md](DEVELOPMENT.md)；新人关联解读（手动「读一下今天」）规格见 [docs/beginner-reading.md](docs/beginner-reading.md)。

当前这版重点支持：

- 无需登录或配置自选即可运行的 Nasdaq 核心雷达
- `QQQ`、`MAGS`、官方权重靠前成分及相关科技龙头跟踪
- 近 36 小时动态新闻流：按公司名/Ticker/纳指主题词过滤，并按标题聚合去重
- 自选股列表、分组、搜索、排序、分页
- 持仓上下文：成本价、股数、持仓类型
- 今日需要处理：按回撤纪律、目标价、相对 `QQQ`、当日跌幅生成行动队列
- 自动观察记录：行情刷新时把个人回撤纪律、目标价、相对 `QQQ` 弱势和单日显著跌幅保留为可复核事实，按账号同步最近 90 天；不自动下单，也不构成交易建议
- 个人决策日志：在观察记录上一键起草，记录已做的买入/加仓/减仓/清仓/继续持有/观望/放弃、理由和事后结果；按账号同步，不生成买卖建议
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
- 个人观察记录：首次触发时保留价格、阈值与时间，按“美东日期 + 标的 + 触发类型”去重，最近 90 天可跨设备复核
- 个人决策日志：`decision-logs.mjs` 校验/归一/last-write-wins 合并与补录结果；`watchlist_states.decision_logs` 加性列继承 RLS；看板可从观察记录一键起草，只记录用户已做决定
- 当日市场线索：区分市场同向、个股资讯、混合因素与证据不足；新闻原文链接保留供复核
- 历史归档基础：独立 `market_event_history` 表、30/90/180 天时间轴、收盘后自动补抓入口
- 公共 Nasdaq 历史：独立 `nasdaq_market_event_history` 表，不绑定用户账号；页面经服务端 API 读取
- 采集可观测性：每次 Cron/手动重跑写入 `market_capture_runs`，记录状态、耗时、计数和脱敏失败摘要；运维接口不返回用户 ID、个人标的或原始异常
- 采集任务支持单用户失败隔离，不会因一个用户异常中断整批任务
- 受 `CRON_SECRET` 保护的手动重跑与最近运行记录接口
- 公共行情 Collector 独立运行：瞬时网络失败最多重试一次；可按 `runId` 获取脱敏单次诊断摘要
- 标准公共行情层：`instruments`、`market_days`、`price_bars_daily`，均由服务端密钥访问
- `QQQ` 五年日线已回填：1,254 个唯一交易日，覆盖 `2021-08-12` 至 `2026-08-11`
- 公共日线查询接口：`GET /api/nasdaq/prices?symbol=QQQ&limit=1254`
- 前瞻研究标签：未来 1/3/5/20 日收益、20 日最大回撤和年化实现波动率
- 标签查询接口：`GET /api/nasdaq/labels?symbol=QQQ&limit=1254`，明确标记为研究专用
- 统一事件与来源层：`sources / events / event_sources / event_entities`，支持 URL 去重、证据关系和标的关系
- 统一事件接口：`GET /api/nasdaq/events?days=30|90|180`
- 事件人工复核：追加式 `event_review_decisions` 审计记录、确定性待复核规则和只读队列；看板“归因审核”可筛选待核对项并直达原始来源，决定仍通过受控 CLI 写入，不会覆盖原始事件
- 待复核队列接口：`GET /api/nasdaq/review-queue?days=30|90|180`
- NDX 历史成分与权重快照：首个完整官方快照含 101 个证券，生效日 `2026-05-01`，权重合计 `99.96%`
- 成分查询接口：`GET /api/nasdaq/constituents?asOf=YYYY-MM-DD`
- NDX 候选快照审核：先发现候选、生成并检查差异报告，再以显式 `--approve` 导入；导入后会保存加入、移除和权重变化事件
- NDX 成分新鲜度：研究覆盖面板按官方快照距参考日 `<=45 / 46–90 / >90` 天显示新鲜、待检查或滞后；只提示维护，不自动替换成分
- 核心成分总览会同步显示 NDX 快照新鲜度；快照滞后时明确说明核心观察篮子不等于完整当前成分，避免将旧权重误作实时指数成分
- NDX 成分变更可读化：动态日历单日详情会展示该已审核快照相对前一份快照的加入、移除和权重调整；首份快照会明确说明尚无比较基线，不从新闻或当前名单猜测历史变更
- 成分变更查询接口：`GET /api/nasdaq/constituent-changes?asOf=YYYY-MM-DD&limit=12`，仅返回已审核导入的追加式记录
- 官方财报日历基础层：`earnings_events` 与候选导入会保存公司、市场日期、盘前/盘后时段、可知时间和 IR 来源；未知精确时间保持为空，计划财报不自动成为涨跌归因
- 财报查询接口：`GET /api/nasdaq/earnings?start=YYYY-MM-DD&end=YYYY-MM-DD`；动态日历会显示已审核归档的财报事项
- 首页近期官方财报：展示未来 30 天内已审核归档的公司 IR 事项、盘前/盘后时段和原始来源链接；空结果不会被解释为“没有公司将发布财报”
- 首条已核对事项：NVIDIA `FY2027 Q2` 预定于 `2026-08-26 13:20 PT` 公布结果，来源为 NVIDIA 官方 IR；该记录仅是财报日历，不含实际业绩或交易结论
- 核心新闻雷达改为从最新完整快照动态选取权重前 12，并保留 `QQQ / MAGS` 基准篮子
- Nasdaq 动态月历：按美东市场日期展示 `QQQ` 涨跌、20 日后视波动状态、事件数量和最高影响等级
- 单日详情：可按市场日期直接跳转，同屏查看 `QQQ` 行情、统一事件时间线、原始证据链接和当日有效的 NDX 权重快照
- 日历查询接口：`GET /api/nasdaq/calendar?month=YYYY-MM` 和 `GET /api/nasdaq/calendar?date=YYYY-MM-DD`
- 事后研究结果与当日信息严格分区，未来 1/3/5/20 日标签不会作为实时判断输入
- 日度特征层：`daily_market_features` 固化每个交易日当时可知的价格状态、成交量状态和事件状态，供后续相似日计算复用
- 特征查询接口：`GET /api/nasdaq/features?symbol=QQQ&limit=365`，支持 `date=YYYY-MM-DD` 精确读取
- 历史相似日基线：按目标日之前的特征分布匹配非连续历史阶段，并展示已成熟的后续表现
- 相似日查询接口：`GET /api/nasdaq/similar-days?date=YYYY-MM-DD&limit=5`，已嵌入日历单日详情
- 相似日结果分布：对当前候选集计算 5/20 日历史胜率、中位收益、四分位范围和 20 日回撤，不把小样本写成预测概率
- 首页当前历史情景：自动读取最新已物化的 QQQ 相似日，展示最多 5 个成熟历史候选的 5/20 日经验分布与回撤范围；它不调用 AI、不读取个人持仓，也不将历史正收益频率写成当前预测概率
- 冻结 walk-forward 评估基线：提交了 `QQQ` 16 折扩展式时间切分，训练到验证间隔离 20 个交易日结果期；`GET /api/nasdaq/evaluation-splits` 提供后续概率模型共用的只读边界
- 概率对照基线：在冻结切分上生成“永远看涨”和训练期条件动量报告，包含准确率、平衡准确率和 Brier 分数；`GET /api/nasdaq/evaluation-baselines` 仅供研究评估，不是当前预测
- Logistic Regression 候选：基于训练期标准化与 L2 正则完成首份概率/校准报告；当前没有胜过弱对照，因此标记为 `research_only_not_selected`，`GET /api/nasdaq/evaluation-logistic` 只用于复核
- Shallow Probability Tree 候选：最大深度 `2`、每叶至少 `30` 个训练样本、训练期分位数阈值与 Laplace 概率平滑；同样没有胜过对照，因此固定为 `research_only_not_selected`，`GET /api/nasdaq/evaluation-tree` 只用于复核
- Walk-forward 概率门控回测：以每 20 个交易日的非重叠冻结样本模拟“概率 ≥ 0.5 才持有 QQQ”，汇总收益与回撤；现有三个候选均未优于始终持有 QQQ，`GET /api/nasdaq/evaluation-backtest` 只用于研究复盘
- 到期结果审计：收盘任务会对已有研究输入快照检查成熟的 20 日标签，并以只追加记录保存真实收益、回撤和波动；`npm run research-outcomes:evaluate` 可手动幂等重跑，`GET /api/nasdaq/research-outcomes` 只读查看公共结果
- 研究运行健康：`GET /api/nasdaq/research-health` 以 Supabase 精确计数显示脱敏的最新运行状态、快照/成熟结果数量、模型启用状态与确定性告警代码；不会暴露 Cron 错误正文
- 模型晋升治理：固定 `qqq-model-promotion-policy-v1` 对候选执行样本、冻结切分、相对 Brier/平衡准确率及校准门槛检查；当前 Logistic 的失败标签可由 `GET /api/nasdaq/evaluation-logistic-review` 复核，永不自动部署
- 看板模型复核：可切换 Logistic 与浅层树候选，直接呈现冻结候选的门槛通过情况、指标差距、失败标签和事后市场阶段筛选；阶段标签来自每个已完成验证区间的 QQQ 收益/回撤/实现波动，不参与训练、晋升或实时输出
- SEC EDGAR filings 采集：可将核心标的的 `10-K / 10-Q / 8-K / 20-F / 40-F / 6-K` 以官方归档链接、接受时间和 CIK 写入统一事件层；生产已配置合规 `SEC_USER_AGENT`，本机验证写入 3 条 filings；配置错误不会丢弃已完成的行情快照
- FRED 宏观观测采集：可把 `CPIAUCSL / UNRATE / FEDFUNDS / GDPC1` 的官方 FRED 观测写入统一事件层；生产已配置 `FRED_API_KEY`，本机验证写入 12 条观测；不伪造精确发布时间，稳定事件键去重
- 日度研究输入包：`GET /api/nasdaq/research-packet?date=YYYY-MM-DD` 固定后续 AI/日报可读取的泄漏安全事实边界，并按“上一交易日收盘到目标日收盘”筛选可知事件；人工 `rejected` 事件不会进入模型证据集合
- 研究输入回放：收盘任务会追加保存字段顺序无关稳定指纹的研究包快照；看板“研究回放”以摘要列表加按需详情方式复原当时事实输入，`GET /api/nasdaq/research-packet-snapshots` 默认只返回摘要，显式 `includePacket=true` 才返回完整历史输入
- 快照级流程回放：`GET /api/nasdaq/research-flow?snapshotId=<uuid>` 对新快照还会精确关联同一次收盘运行的安全阶段摘要，再串联输入归档、确定性日报、已验证模型摘要状态和 20 日结果审计；历史未关联快照明确标记，不会按日期猜测 Agent 运行结果
- 模型拒绝回放：研究流程只显示受控的拒绝类别，例如未完整结束、无效 JSON、网关失败或输出契约不通过；不公开模型原文、验证错误或网关异常文本
- 每日研究事实摘要：每次成功归档研究快照后，系统会按同一快照与报告版本幂等写入日报；`GET /api/nasdaq/daily-reports?limit=7` 只返回 QQQ 收盘、涨跌和证据计数，不含预测、建议或交易指令
- 每周研究事实汇总：`GET /api/nasdaq/weekly-reports?limit=6` 按纽约自然周聚合已归档日报，明确展示实际归档日数与观察区间；2026–2028 年会按 NYSE 官方“全天休市”日历减少应有日报数，提前收盘仍算交易日，未知年份保守维持五个工作日校验
- 研究任务看板：收盘采集会为市场采集、确定性事件归因、研究输入、日报、模型摘要与到期评估追加阶段运行摘要；归因阶段只记录归因/来源计数，市场采集以 `partial` 明确标记部分标的失败，`GET /api/nasdaq/research-tasks?limit=20` 不公开原始错误、来源 URL 或提供网页重试
- 独立归因 Agent：收盘写入统一事件后，`market-attribution-agent-v1` 以结构化涨跌、QQQ 对照和已链接来源计数生成版本化归因；`GET /api/nasdaq/attributions?date=YYYY-MM-DD` 仅返回分类、置信度、证据数量与计算时间，不返回事件 ID、标题、URL 或新闻正文
- 独立事件 Labeler：`event-labeler-agent-v1` 将来源完整度、置信度和可知时间写成追加式风险标签，供任务看板追踪；它不覆盖人工审核，也不会自动拒绝研究证据
- 受控历史重放：`npm run agents:replay -- YYYY-MM-DD` 默认只预览已存事实可生成的归因/标签；加 `--apply` 才会追加派生记录，不调用模型或网页、不改写原始事件和人工审核
- 阶段重试与耗时：公共行情 Collector、研究输入、日报、冻结周报和到期评估遇到短暂网络故障时最多自动重试一次；回放显示阶段数、总尝试次数与最终安全耗时，原始异常不进入接口或网页
- 研究覆盖面板：`GET /api/nasdaq/research-quality` 汇总实际归档的研究快照、日报/周报、到期结果、归因审核积压与任务账本状态；它只做可回放性观察，不宣称资料完整、正确或可用于交易决策
- 研究集成准备度：覆盖面板还会显示内置市场采集、SEC 公司披露、FRED 宏观观测、模型研究摘要和无项目数据的模型网关探针的 `就绪 / 待配置` 状态，便于多端开发核对；接口不会返回任何密钥、联系人、环境变量值或具体失败原因
- 受控模型摘要执行器：只可读取已归档研究输入；可使用官方 DeepSeek 或服务端配置的 HTTPS 兼容网关，启用后受每日请求上限、稳定输入指纹、引用/越权校验与服务端审计共同约束；一次性验证另有 `CRON_SECRET` 保护的固定快照入口，不接受网页或请求参数指定输入
- 无项目数据网关探针：单独使用固定 JSON 验证 `finish_reason=stop` 与 JSON 模式；JSON 请求关闭 V4 thinking、不走 stream；服务端先预留一次性审计记录；默认关闭且不触碰研究快照。`2026-08-24` 已对当时生产模型 `deepseek-v3.2` 打通一次（审计 `accepted`）；生产 `DEEPSEEK_MODEL` 现为 `deepseek-v4-flash`，与本机对齐，该模型名下尚未消耗正式探针额度
- 已验证摘要回放：研究回放会显示与所选快照指纹一致、且已通过校验的模型摘要；没有摘要时明确显示未生成，网页不会触发模型调用
- 输出契约查询：`GET /api/nasdaq/research-narrative-contract?date=YYYY-MM-DD` 提供该日期允许引用的证据与固定 JSON 结构

### 当前版本重点

- 页面优先级固定为：Nasdaq 环境 → 动态新闻 → 日度脉络 → 个人信号与持仓
- `个人信号` 只展示需要判断的个人规则，不与公共市场新闻混在一起
- 信号优先级固定为：回撤纪律、目标已到、临近目标、明显跑输 `QQQ`、当日大跌
- 自选表格保留决策字段，更多上下文放到移动卡片、详情分析、规则面板里
- 当前信号是确定性规则，不是 AI 投资建议
- 当日涨跌线索是基于同期 `QQQ` 表现和公开新闻做的关联判断，不宣称单一新闻必然导致涨跌
- 历史归因从现在开始持续积累；价格可以补历史，但过去某日的新闻原因不做无证据倒推
- 新人关联解读第一期已上线：默认只有说明和「读一下今天 / 读一下这一天」按钮；点击后用当时可见数据生成五段模板；行情刷新不改写正文；不写云、不调用模型

### 下一阶段

产品层（不插入研究批次的顺序，规格见 [docs/beginner-reading.md](docs/beginner-reading.md)）：

- 新人关联解读第一期已落地。模型润色仍不由该按钮出站，除非规格修订为单独确认动作

研究层仍严格按顺序：

1. 确认下一次完整收盘 Cron 实际写入 SEC filings 与 FRED 观测；扩展公司 IR 财报日历覆盖，并为日度特征 / 相似日补齐官方宏观和公司事件维度
2. `deepseek-v3.2` 无项目数据探针已通过。若要对当前生产模型 `deepseek-v4-flash` 留下正式探针记录，需另一次人工批准（唯一键含模型名）。只有重新批准一份新的历史研究快照后，才做下一次受控模型验证；新人解读的 AI 润色必须是单独确认按钮，不能绑在「读一下」上
3. 特征扩充后再重跑冻结评估，并重新冻结事后阶段诊断工件；当前 Logistic / 浅层树均未晋升

## 技术结构

- 前端：原生 `HTML + CSS + ES Modules`
- 本地存储：浏览器 `localStorage`
- 云同步：`Supabase Auth + watchlist_states`
- 服务端接口：`Vercel Functions`
- 外部行情源：
  - A 股：东方财富、腾讯财经
  - 美股：Yahoo Finance

## 目录说明

- `docs/beginner-reading.md`: 新人关联解读产品规格（手动触发、五段骨架、禁止句、两期实现）
- `lib/beginner-reading.mjs`: 第一期确定性模板；只在用户点击时由页面调用
- `index.html`: 页面结构
- `app.js`: 主交互逻辑
- `storage.js`: 本地数据、默认股票、偏好设置
- `quotes.js`: 行情拉取
- `cloud.js`: Supabase 云同步
- `personal-observations.mjs`: 自动观察记录纯函数
- `decision-logs.mjs`: 个人决策日志纯函数
- `api/a-share/detail.js`: A 股分析接口
- `api/global-stock/detail.js`: 美股分析接口
- `api/global-stock/daily-events.js`: 当日行情事件接口
- `api/nasdaq/[resource].js`: 统一 Nasdaq 只读入口；保留 `/api/nasdaq/history`、`/prices`、`/labels`、`/events`、`/constituents`、`/calendar`、`/features`、`/similar-days`、`/current-scenario` 等资源 URL
- `api/cron/capture-market-history.js`: 收盘后自动归档入口
- `api/cron/market-history-runs.js`: 最近采集运行记录接口
- `api/cron/validate-approved-research-snapshot.js`: 受 `CRON_SECRET` 保护的一次性研究快照验证入口
- `api/cron/check-model-gateway-compatibility.js`: 无项目数据的网关兼容性探针
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
- `lib/current-market-scenario.js`: 从最新已物化 QQQ 相似日生成去候选明细的当前经验情景摘要
- `lib/sec-edgar.js`: SEC 公司映射、filings 采集、接受时间处理与统一事件记录构建
- `scripts/capture-sec-filings.js`: 手动采集核心标的 SEC filings 的受控入口
- `lib/fred-macro.js`: FRED 宏观观测采集、稳定事件键与不伪造发布时间的时间边界
- `scripts/capture-fred-macro.js`: 手动采集 FRED 宏观观测的受控入口
- `lib/daily-research-packet.js`: 为未来报告/Agent 固定市场状态、跨收盘可知事件、来源与历史相似日的只读契约
- `lib/research-packet-snapshots.js`: 研究输入的稳定指纹、来源摘要、追加式快照写入与回放读取
- `lib/daily-research-reports.js`: 基于不可变研究快照的确定性日报构建、幂等写入与只读查询
- `lib/nyse-trading-calendar.js`: 固定 2026–2028 年 NYSE 官方全天休市日历；覆盖外自动回退为严格工作日校验
- `lib/weekly-research-reports.js`: 基于不可变日报与 NYSE 交易周契约的纽约自然周事实聚合、冻结和只读查询
- `lib/research-task-runs.js`: 追加式研究阶段账本、幂等写入和脱敏只读查询
- `scripts/capture-research-packet-snapshot.js`: 手动生成某个市场日研究输入快照的受控入口
- `lib/research-narrative-contract.js`: 未来 LLM 市场复盘的引用约束、禁止语义与输出验证
- `lib/research-narrative-audit.js`: 服务端审计写入；记录版本、指纹、验证结果与原始模型 JSON
- `lib/deepseek-research-narrative.js`: 受控模型摘要执行器；只读取归档输入，校验引用后写审计
- `lib/earnings-calendar.js`: 官方 IR 财报候选校验、显式导入和只读查询
- `lib/market-attribution-agent.js`: 确定性涨跌归因 Agent
- `lib/event-labeler-agent.js`: 确定性事件风险标签 Agent
- `data/ndx/`: 经校验且保留官方来源日期的 NDX 结构化快照
- `data/earnings/candidates/`: 待人工审核的公司 IR 财报候选
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
set -a
. ./.env.local
set +a
vercel dev
```

本地地址通常是：

- `http://localhost:3000`

`vercel dev` 会优先读取 Vercel 的 Development 环境；当前项目没有在 Vercel 保存 Development Secret。要联调依赖 Supabase 的接口（例如“研究回放”），请先按上面的三行把本机、被 Git 忽略的 `.env.local` 仅注入当前终端。纯静态页面查看不需要这些变量。

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
- 模型执行器已接入；网关、模型和严格限额只保存在服务器环境变量。部署、页面访问和公共只读接口都不会调用模型；只有显式开启两项出站开关、锁定一份快照指纹并由 `CRON_SECRET` 保护的接口手动触发时，才可能向第三方发送归档研究快照

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
   - 已完成：在观察记录上一键起草，记录动作、理由和事后结果，并按账号同步
   - 后续：个人纪律复盘统计、按决策结果回看当时价格与仓位

3. 事件上下文
   - 已完成：官方 IR 财报日历基础层，以及 SEC filings / FRED 宏观采集
   - 后续：扩大财报覆盖，把宏观和公司事件写进日度特征与相似日

4. 新人关联解读
   - 规格： [docs/beginner-reading.md](docs/beginner-reading.md)；模板 `lib/beginner-reading.mjs`；开发说明见 [DEVELOPMENT.md](DEVELOPMENT.md) 第 8.4.1 节
   - 第一期已上线。首页和日历单日详情用手动按钮生成讲解，不自动出现、不随行情刷新改写
   - 第一期只跑本地模板，按钮不触发模型出站；模型润色是另一次经规格修订的确认动作

5. AI 研究摘要层
   - 已完成：受控 DeepSeek / 兼容网关执行器、输出契约、一次性验证入口和拒绝回放
   - 后续：在维护者重新批准后接入完整 Agent 流程回放；不自动生成交易指令
   - 与「读一下今天」不是同一功能：研究摘要在研究回放里展示已 `accepted` 的归档输出；关联解读面向新人把同屏事实串起来

6. 正式环境变量管理
   - 已完成：`.env.example`、服务端密钥与模型出站开关分离
   - 后续：新设备继续用 `vercel env pull`，密钥不进 Git 或聊天
