# Tarot Plan（冻结 v2.10 · 2026-09-11）

> 实现状态：P0–P31 已落地（大阿尔卡纳全套 + 圣杯 + 权杖 + 宝剑 + 星币花色混合位图齐；78 张 `CARD_ART`；追问子牌阵；牌阵剧场三阵；烛火信物；场景剧场软提示）。AI 默认 mock；`AI_PROVIDER=deepseek`（legacy `gateway`）对齐 stock-dashboard OpenAI 兼容接口，不再用 Vercel AI Gateway。生产需 `DEEPSEEK_API_KEY`。Vercel↔GitHub 自动部署已接通。混合位图渐进已收官（不强制外购整副）。产品决策仍按下表冻结。

## 0. 产品名

**Candle Taro**（对外文案不出现「塔罗」）。

## 1. 项目定位

`tarot` 是 [`Andy115951/le-web`](https://github.com/Andy115951/le-web) monorepo 下的占卜 Web 应用。

用户选择场景或自定义问题 → 经历洗牌/抽牌仪式 → AI 解读 → 可自由追问 → 历史会话可回看。

定位：**仪式感神秘的 AI 占卜顾问**。每一局绑定「问题 + 牌阵」；追问可延伸为持续顾问对话，但开场解读以本局牌为锚。

## 2. 仓库与部署

| 项 | 结论 |
|----|------|
| 仓库 | `Andy115951/le-web` |
| 目录 | `tarot/` |
| Vercel | 独立项目，Root Directory = `tarot` |
| Supabase | 复用 `le's Project`，表前缀 `tarot_` |
| 技术（实现向） | Next.js App Router + Tailwind + **shadcn**（基础控件）+ AI SDK（deepseek / mock，含 streamText）；仪式/牌面自定义；认证对齐 quadrant-todo |

## 3. 已冻结的产品决策

### 3.1 调性与视觉

- **调性**：仪式感神秘——步骤更慢、文案更满
- **视觉**：深色背景、暖金/烛光点缀、低对比纹理；安静神秘，不花哨

### 3.2 仪式

- 提供 **慢 / 常 / 快** 三档，**不提供跳过**
- 默认「常」；设置里可改默认速度
- 即便前期纯文本，也保留阶段：静心 → 洗牌 → 问牌 → 逐张翻开 → 解读
- **牌面结果服务端生成并落库**，前端只负责揭晓

### 3.3 起卦与场景

- 六场景 + 自定义：`感情` `事业` `学业` `人际` `日常抉择` `身心状态`
- 选场景后 **带出示例问题，用户可直接改**；自定义入口为空白自写
- **牌阵**：主流程默认三牌（过去/现在/未来）；`日常抉择` 默认单牌；高级选项可改；界面少堆术语
- **P26 情境五牌**：可选 `five_cross`（现状 / 挑战 / 过去影响 / 近期走向 / 建议）；凯尔特十字等更复杂阵型仍后置
- **P29 牌阵剧场**：新增 `relation_dual`（关系双人：我方/对方/关系纽带）、`choice_fork`（抉择分叉：路径甲/路径乙/关键建议）、`moon_triad`（月相三问：隐流/显象/应时之举）；起卦可选；仪式/历史/分享文案与 PNG 走 `positionLabel`/`spreadLabel`
- **P30 一卦一物 · 烛火信物**：解读完成后可生成焦点牌竖版壁纸（约 1080×1920）+ 中文短签；`POST /api/readings/[id]/token` 按需返回 `{ verse, cardId, reversed }`（无 DB migration）；下载 / Web Share

### 3.4 解读

- **简要 / 详细** 两档
- 设置里有默认档，**每局仍可临时改**
- 简要：结论 + 关键牌意；详细：意象与分牌叙事更满
- 固定娱乐/自我反思向免责声明
- **P7**：解读与追问默认走 NDJSON 流式呈现；兼容非流式 JSON

### 3.5 追问与新局

- 追问：**较自由**，像持续顾问对话
- 常驻 **「新占卜」** 按钮
- 若对话明显换成新主题，**温和建议重新抽牌**，不强制
- **P28 追问子牌阵**：解读页追问区可抽 **单张象征牌**；计入 **1 次追问额度**；文字可选（空文仍发送，服务端落默认追问句）；用户气泡展示牌面；顾问以主牌阵 + 该象征牌为锚回应；尽量避开主阵已出牌；无 DB migration（元数据编码进 message content）

### 3.6 历史

- 卡片式：问题标题 + 牌阵类型 + 关键牌名（+ 时间）
- 支持打开续聊、重命名、软删（P9 已落地）

### 3.7 访客与登录

- 访客：**每天 1 次新占卜 + 约 5 条追问**，用完促登录
- 起卦前不强制登录
- 登录：**用户名 + 密码**（session cookie，对齐 `quadrant-todo`）
- 登录用户：**每天 10 次新占卜 + 约 100 条追问**
- 登录后：**自动合并访客历史**到账号

### 3.8 文案语气

- **按场景切换**：感情更柔、事业更稳、日常抉择更短平快；学业/人际/身心各定一档
- **统一底线**：不用绝对预言句（如「必将/一定会」）；神秘靠意象与象征

### 3.9 文案资产

- 示例问题、场景语气、启动/空状态微文案、子牌阵/剧场软提示/信物按钮态见同目录 `COPY.md`（v1.7）

### 3.10 牌面素材

- MVP：**简化示意**起步；P8 升级为插画风（花色配色、中文花色名、正逆位角标、双层边框角饰、仪式牌背）
- P17：**混合桥接**——可选 `public/cards/{id}.webp` 叠在现有烛光框下；`src/data/card-art.ts` 的 `CARD_ART` 仅登记已有文件；无图回退 glyph
- **冻结**：不要求外购整副牌面；渐进扩展 `CARD_ART`（大阿卡纳 + 四花色已齐，78 张）

### 3.11 P6 动画（已定）

- CSS / Tailwind / `tw-animate-css` 优先，不加 framer-motion
- 仪式阶段：静心呼吸光晕、洗牌微动、问牌描边脉动、翻开时按速度逐张翻牌
- 尊重 `prefers-reduced-motion`
- 仍不可跳过；慢/常/快时长不变（1600 / 900 / 400ms 步进）

### 3.12 P7 流式 UI（已定）

- 协议：NDJSON 行事件 `delta` / `done` / `error`
- deepseek：`streamText`；mock：分片模拟；`instant=1` 或 reduced-motion 时瞬时吐出
- 落库仍在流结束后写入完整助手消息；客户端以 `done.messages` 为准

### 3.13 P8 插画牌面（已定）

- `TarotCardFace`：花色配色渐变、中文花色/大阿尔卡纳副标、正逆位角标、双层边框 + 角饰、关键词摘要
- `TarotCardBack`：斜纹烛光牌背，用于仪式翻牌背面
- compact 模式保留给历史等紧凑场景；信息不以动画 alone 传达
- 写实位图 / 外购牌面仍不在本阶段

### 3.14 P9 历史管理（已定）

- 历史卡片：打开续聊 + 场景徽章 + 重命名（PATCH，标题 ≤40）+ 软删（DELETE，`deleted_at`）
- 删除前确认；重命名就地编辑，Enter 保存 / Esc 取消
- 列表仍过滤 `deleted_at IS NULL`

### 3.15 P10 无障碍与 UX 抛光（已定）

- 布局跳过链接到主内容；仪式阶段 `aria-live` / 进度；牌面 `aria-label`；装饰层 `aria-hidden`
- 历史重命名/删除：可见标签、就地确认、焦点回到触发按钮
- 错误与空状态：烛光语气，避免开发者口吻；仪式速度徽章用中文「慢/常/快」
- 继续尊重 `prefers-reduced-motion`（不改时长与跳过策略）

### 3.16 P11 分享牌阵 + 设置抛光（已定）

- 解读页在仪式完成后提供「分享牌阵」：优先 Web Share API，否则复制纯文本摘要到剪贴板
- 摘要含问题、场景、牌阵、各位牌名（正/逆位）与娱乐免责；不含账号、内部 id、AI 配置
- 设置页：账号 / 默认选项 / 今日额度 / 关于 Candle Taro 分区更清晰；说明主题切换时可建议「新占卜」

### 3.17 P12 社交分享精修图（已定）

- 解读页增加「保存分享图」：客户端 canvas 绘制 1080×1350 烛光竖图 PNG（无重依赖）
- 图含产品名、问题、场景/牌阵、各位示意牌面（花色点缀 + 正/逆位）、免责；不含账号与内部 id
- 优先：Web Share 带文件（`canShare({ files })`）；否则触发下载
- 文字「分享牌阵」路径保留；写实位图牌面仍不在本阶段

### 3.18 P13 DeepSeek 提供商（已定）

- `AI_PROVIDER=mock`（默认）| `deepseek`；legacy `gateway` 映射到 deepseek
- 使用 `@ai-sdk/openai` `createOpenAI` 指向 DeepSeek OpenAI 兼容接口（与 stock-dashboard 同款 env）
- Env：`DEEPSEEK_API_KEY`（必填才启用）、`DEEPSEEK_API_URL`（默认官方 chat/completions）、`DEEPSEEK_MODEL`（默认 `deepseek-v4-flash`）
- 解读/追问仍走 `generateText` / `streamText`；失败回退 mock；不再依赖 Vercel AI Gateway / `AI_GATEWAY_*`

### 3.19 P14 额度感知 + 软提示重抽（已定）

- 新占卜页与解读追问区展示今日额度（`usage/quota`），近耗尽与用尽用烛光语气；访客用尽/将近用尽时引导登录
- 429 响应带 `code: "quota"` 与 `usage`/`quota`；前端禁用提交并保留登录 CTA
- 解读页：顾问文案提到「新占卜/再起一卦」或用户追问 ≥2 次后，展示可关闭的软提示 chip（不强制）
- 写实位图牌面仍不在本阶段

### 3.20 P15 DeepSeek thinking.disabled（已定）

- DeepSeek 请求默认附带 `thinking.disabled`（对齐 stock-dashboard），避免模型返回空 `content`
- 不改变 mock / deepseek 切换与失败回退策略

### 3.21 P16 牌义图鉴（已定）

- 主导航增加「牌义」；路由 `/cards`（列表）与 `/cards/[id]`（详情），id 来自 `src/data/deck.ts`
- 列表：筛选 chips「全部 / 大阿尔卡纳 / 权杖 / 圣杯 / 宝剑 / 星币」；客户端按中英文牌名搜索；网格展示 compact `TarotCardFace` + 名称
- 详情：大号 `TarotCardFace`、正/逆位切换、关键词与正逆位牌义（复用牌库字段）、烛光微文案（禁止绝对预言）、软 CTA「去占卜」
- a11y：标签、焦点、尊重 reduced-motion；深色烛光主题；可复用 P17 混合位图（有则显 webp）

### 3.22 P17 混合卡面桥接（已定）

- `TarotCardFace`：若 `getCardArtSrc(card.id)` 有值，中心叠 `public/cards/{id}.webp`，保留烛光框/角饰/正逆位角标；无图则 glyph 示意不变
- `CARD_ART`（`src/data/card-art.ts`）**只列已有文件**；大阿尔卡纳 `major_00`–`major_21` 已齐；小阿卡纳渐进补表
- 分享 PNG（`share-reading-image.ts`）同桥：有位图则画入，否则花色示意
- **冻结**：不要求外购整副；后续按需渐进补位图即可

### 3.23 P18 牌库加厚 + 今日一牌（已定）

- `src/data/deck.ts`：78 张 keywords / upright / reversed 改为可用的烛光语气短义（禁绝对预言）；id / 中英文名不变
- 首页「今日一牌」：按 `user:` / `anon:` + Asia/Shanghai 日历日 sha256 确定性抽一张（含正逆）；**不创建 reading、不计额度**
- UI：展示 `TarotCardFace` + 关键词 + 当日方位牌义；链到 `/cards/[id]` 与「开始占卜」
- 写实位图仍渐进；今日一牌可复用已有 hybrid art

### 3.24 P19 大阿尔卡纳全套混合位图（已定）

- `public/cards/major_00.webp`–`major_21.webp`（写实烛光幻想，AI 生成，768×1024）
- `CARD_ART` 登记全部 22 张；`TarotCardFace` / 分享 PNG / 今日一牌 / 牌义图鉴自动吃到
- 小阿尔卡纳：圣杯+权杖+宝剑+星币花色已齐

### 3.25 P20 圣杯 ace–seven 混合位图（已定）

- `public/cards/cups_ace.webp`–`cups_seven.webp`（同烛光写实风）
- `CARD_ART` 增补这 7 张

### 3.26 P21 圣杯八–十与宫廷收官（已定）

- `public/cards/cups_eight.webp`–`cups_ten.webp` 与 `cups_page` / `cups_knight` / `cups_queen` / `cups_king` webp
- `CARD_ART` 登记圣杯花色全套；权杖见 P22

### 3.27 P22 权杖花色混合位图（已定）

- `public/cards/wands_ace.webp`–`wands_ten.webp` 与 `wands_page` / `wands_knight` / `wands_queen` / `wands_king`（同烛光写实风）
- `CARD_ART` 登记权杖花色全套；宝剑见 P23

### 3.28 P23 宝剑花色混合位图（已定）

- `public/cards/swords_ace.webp`–`swords_ten.webp` 与 `swords_page` / `swords_knight` / `swords_queen` / `swords_king`（同烛光写实风）
- `CARD_ART` 登记宝剑花色全套；牌义「仅看已配图」曾为渐进筛选（P27 已下线）；星币见 P24

### 3.29 P24 星币 ace–seven 混合位图（已定）

- `public/cards/pentacles_ace.webp`–`pentacles_seven.webp`（同烛光写实风，768×1024）
- `CARD_ART` 增补这 7 张；八–十与宫廷见下一批

### 3.30 P25 星币八–十与宫廷收官（已定）

- `public/cards/pentacles_eight.webp`–`pentacles_ten.webp` 与 `pentacles_page` / `pentacles_knight` / `pentacles_queen` / `pentacles_king` webp
- `CARD_ART` 登记星币花色全套；78 张混合位图齐

### 3.31 P28 追问子牌阵（已定）

- 解读页追问区次要按钮「抽一张象征牌」（子牌阵）：服务端抽 **单张** 象征牌
- 整次动作计 **1 条追问额度**（与普通追问相同）；可选附带追问文字，空文仍可发送（默认提示句）
- 用户气泡展示 compact 牌面 + 方位/正逆 + 可见文案；原始编码头不对用户展示
- 顾问提示：以主牌阵为根基，将【象征】子牌作本轮追问的象征锚；勿当作新起卦
- 编码：`⟦SUBCARD⟧{cardId}|{0|1}|象征\n{text}` 存入 `tarot_messages.content`（无 migration）
- 文案禁「塔罗」，用占卜/牌阵/解读/新占卜/象征牌

### 3.32 P29 牌阵剧场（已定）

- 三个叙事三牌阵，与既有 `single` / `three_card` / `five_cross` 并列可选
- `relation_dual` 关系双人：我方 / 对方 / 关系纽带
- `choice_fork` 抉择分叉：路径甲 / 路径乙 / 关键建议
- `moon_triad` 月相三问：隐流 / 显象 / 应时之举
- 起卦表单附一行剧场提示；仪式复用三牌网格并显示阵名；历史徽章与分享文/图用 `spreadLabel` + 各位 `positionLabel`
- AI `describeSpread` 已按 `positionLabel` 注入，无需改协议
- 不含凯尔特十字；对外文案禁「塔罗」

### 3.33 P30 烛火信物（已定）

- 与「分享牌阵」同门：须已有助手解读
- 控件「烛火信物」：请求短签 → 客户端 canvas 竖版（9:16）壁纸，焦点为首张/focus 牌，叠 CARD_ART 牌面、短签、Candle Taro 烛光品牌
- API：`POST /api/readings/[id]/token` → `{ verse, cardId, reversed, positionLabel? }`；mock / deepseek 均可；短签 1–2 行中文，忌绝对预言
- 保存下载；可用时 `navigator.share` 分享文件
- 无 DB migration


### 3.34 P31 牌阵剧场软提示（已定）

- 不改各场景 `defaultSpread`（主流程仍三牌；日常抉择仍单牌）
- 感情 / 人际：未选 `relation_dual` 时轻声提示并可「改用关系双人」
- 日常抉择：未选 `choice_fork` 时提示并可「改用抉择分叉」
- 身心状态：未选 `moon_triad` 时提示并可「改用月相三问」
- COPY.md → v1.7；设置「关于」补「保存分享图」与「烛火信物」


## 4. MVP 范围

含：场景起卦、文本仪式（三速）、简要/详细解读、自由追问（含追问子牌阵）、新占卜按钮与软提示、历史卡片（重命名/软删）、访客/登录额度、用户名密码登录、深色烛光 UI、插画风牌面示意 + 大阿尔卡纳混合位图全套 + 圣杯/权杖花色混合位图、AI mock + deepseek 接线、流式解读/追问 UI、基础无障碍与空状态抛光、分享牌阵纯文本摘要、烛光分享 PNG、烛火信物竖版壁纸、额度感知 UX、牌义图鉴、加厚牌库释义、首页今日一牌、牌阵剧场三阵（关系双人/抉择分叉/月相三问）、场景剧场软提示。

不含（付费等仍后置）：付费、OAuth/手机号、凯尔特十字等更复杂牌阵（情境五牌与牌阵剧场三阵已落地）；混合位图已齐（不强制外购整副）。

## 5. 分阶段（实现时）

| 阶段 | 交付 | 状态 |
|------|------|------|
| P0 | 脚手架 + 表 + 牌库 | 已完成 |
| P1 | 起卦 + 文本仪式（三速）+ 牌面展示 | 已完成 |
| P2 | 解读（简要/详细） | 已完成 |
| P3 | 追问 + 新局提示 | 已完成 |
| P4 | 历史卡片 | 已完成 |
| P5 | 访客额度 + 用户名密码登录 | 已完成 |
| P6 | 动画增强（仪式烛光/洗牌/逐张翻牌 + 示意卡面） | 已完成 |
| P7 | 流式解读 / 追问 UI（NDJSON + streamText） | 已完成 |
| P8 | 插画风牌面 + 仪式牌背（CSS/SVG） | 已完成 |
| P9 | 历史重命名 + 软删 UI | 已完成 |
| P10 | 无障碍基础 + UX 微文案抛光 | 已完成 |
| P11 | 分享牌阵摘要 + 设置关于抛光 | 已完成 |
| P12 | 烛光分享 PNG（canvas 下载 / Web Share 文件） | 已完成 |
| P13 | DeepSeek 提供商（替换 Vercel AI Gateway） | 已完成 |
| P14 | 额度感知 UX + 解读页软提示重抽 | 已完成 |
| P15 | DeepSeek `thinking.disabled`（避免空回复） | 已完成 |
| P16 | 牌义图鉴（列表筛选/搜索 + 正逆位详情） | 已完成 |
| P17 | 混合卡面桥接（webp 样例 + glyph 回退 + 渐进 CARD_ART） | 已完成 |
| P18 | 牌库释义加厚 + 首页今日一牌（不计额度） | 已完成 |
| P19 | 大阿尔卡纳 22 张混合位图全套 | 已完成 |
| P20 | 圣杯 ace–seven 混合位图 | 已完成 |
| P21 | 圣杯八–十与宫廷混合位图（花色收官） | 已完成 |
| P22 | 权杖花色混合位图全套（ace–king） | 已完成 |
| P23 | 宝剑花色混合位图全套（ace–king）+ 牌义「仅看已配图」（渐进期） | 已完成 |
| P24 | 星币 ace–seven 混合位图 | 已完成 |
| P25 | 星币八–十与宫廷混合位图（花色收官） | 已完成 |
| P26 | 情境五牌（五牌十字）`five_cross` | 已完成 |
| P27 | 牌义图鉴下线「仅看已配图」与渐进补齐提示（78 张齐） | 已完成 |
| P28 | 追问子牌阵（单张象征牌，计 1 追问额度，可选文字） | 已完成 |
| P29 | 牌阵剧场（关系双人 / 抉择分叉 / 月相三问） | 已完成 |
| P30 | 一卦一物 · 烛火信物（竖版壁纸 + 短签 API） | 已完成 |
| P31 | 牌阵剧场场景软提示 + COPY/设置文案同步 | 已完成 |

## 6. 详细设计

见 `DEV.md`。未冻结项见 DEV「待续讨论」。
