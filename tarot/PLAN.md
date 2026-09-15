# Tarot Plan（冻结 v2.29 · P50 公开分享页 · 2026-09-15）

> 实现状态：P0–P50 已落地（大阿尔卡纳全套 + 圣杯 + 权杖 + 宝剑 + 星币花色混合位图齐；78 张 `CARD_ART`；追问子牌阵 + 象征牌链；牌阵剧场三阵；烛火信物；场景剧场软提示；同题回看对照；凯尔特十字十位；GitHub/Google OAuth；静默模式；易用性：折叠高级选项 / 快速起卦 / 骨架屏 / 仪式略加速；解读 Markdown 渲染；场景微剧本开场/落烛；分享/信物预览保存与系统分享拆分；克制多局记忆：同题旧卦轻提 + 近几日相关主题轻提；PWA 主屏安装 + 弱网壳缓存）。AI 默认 mock；`AI_PROVIDER=deepseek`（legacy `gateway`）对齐 stock-dashboard OpenAI 兼容接口，不再用 Vercel AI Gateway。生产需 `DEEPSEEK_API_KEY`。Vercel↔GitHub 自动部署已接通。混合位图渐进已收官（不强制外购整副）。**P43 真机浸泡清单已落地**（`SOAK.md` + 小刺修复）；**P44 首次来访引导已落地**；**P45 访客→登录转化已落地**；**P46 历史好找已落地**；**P47 解读语气再校准已落地**（场景口吻更分明 + 解读固定总览→牌意→综合）；**P48 局内时间线已落地**（揭晓→解读→追问→信物，可回看、移动端可折叠）；**P49 多局记忆加一层已落地**（近几日相关主题轻提，仍克制）；**P50 公开分享页已落地**（只读短链，可关）；**P51 体验队列已冻结方向、待实现**（见 §3.53 / §5）。产品决策仍按下表冻结。

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
- **P26 情境五牌**：可选 `five_cross`（现状 / 挑战 / 过去影响 / 近期走向 / 建议）
- **P33 凯尔特十字**：可选 `celtic_cross`（十位：现状 / 挑战 / 根基 / 近况 / 可能显化 / 近前 / 自我 / 环境 / 希冀与隐忧 / 综合走向）；仪式 sm+ 十字+竖杖布局，移动端双列；分享图自适应高度
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
- **P35 象征牌链**：同区可「抽象征牌链」一次抽 **恰好 3 张** 象征牌；计入 **3 次追问额度**（剩余 <3 则中文拦截）；文字可选；气泡展示三张 compact 牌面（象征一/二/三）；编码 `⟦SUBCHAIN⟧`；顾问视为短象征链锚定本轮追问，仍以主阵为根基，勿当作新起卦；链内与主阵去重
- **P36 静默模式**：揭晓后不自动解读；CTA「请烛火开口」；prefs/起卦覆盖；DB `silent_reveal`

### 3.6 历史

- 卡片式：问题标题 + 牌阵类型 + 关键牌名（+ 时间）
- 支持打开续聊、重命名、软删（P9 已落地）
- **P32**：同题再起时可在解读页对照上一卦；历史卡可显「可对照」

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

- 示例问题、场景语气、启动/空状态微文案、子牌阵/剧场软提示/信物按钮态、快速起卦见同目录 `COPY.md`（v1.19）

### 3.10 牌面素材

- MVP：**简化示意**起步；P8 升级为插画风（花色配色、中文花色名、正逆位角标、双层边框角饰、仪式牌背）
- P17：**混合桥接**——可选 `public/cards/{id}.webp` 叠在现有烛光框下；`src/data/card-art.ts` 的 `CARD_ART` 仅登记已有文件；无图回退 glyph
- **冻结**：不要求外购整副牌面；渐进扩展 `CARD_ART`（大阿卡纳 + 四花色已齐，78 张）

### 3.11 P6 动画（已定）

- CSS / Tailwind / `tw-animate-css` 优先，不加 framer-motion
- 仪式阶段：静心呼吸光晕、洗牌微动、问牌描边脉动、翻开时按速度逐张翻牌
- 尊重 `prefers-reduced-motion`
- 仍不可跳过；慢/常/快时长（P37：1200 / 650 / 280ms 步进；翻牌子延迟按比例收紧）

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
- `CARD_ART`（`src/data/card-art.ts`）**只列已有文件**；大阿尔卡纳 `major_00`–`major_21` 已齐；小阿卡纳四花色已齐（78 张）
- 分享 PNG（`share-reading-image.ts`）同桥：有位图则画入，否则花色示意
- **冻结**：不要求外购整副；78 张已收官，后续仅按需重修个别牌面

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

### 3.31b P35 象征牌链（已定）

- 解读页追问区次要按钮「抽象征牌链」：服务端一次抽 **恰好 3 张** 象征牌（`drawSingleCards(3)`）
- 整次动作计 **3 条追问额度**；剩余消息额度 < 3 时拦截，返回明确中文错误
- 可选附带追问文字，空文仍可发送（默认链提示句）；用户气泡展示三张 compact 牌面 + 象征一/二/三 + 可见文案
- 顾问提示：三条为短象征链，锚定本轮追问，仍以主牌阵为根基；勿当作新完整起卦
- 编码：`⟦SUBCHAIN⟧{cardId}|{0|1}|{label};…\n{text}`（与单张 `⟦SUBCARD⟧` 并存，无 migration）
- 排除：主阵 cardIds + 本链已抽牌（链内无重复）
- 文案禁「塔罗」

### 3.32 P29 牌阵剧场（已定）

- 三个叙事三牌阵，与既有 `single` / `three_card` / `five_cross` 并列可选
- `relation_dual` 关系双人：我方 / 对方 / 关系纽带
- `choice_fork` 抉择分叉：路径甲 / 路径乙 / 关键建议
- `moon_triad` 月相三问：隐流 / 显象 / 应时之举
- 起卦表单附一行剧场提示；仪式复用三牌网格并显示阵名；历史徽章与分享文/图用 `spreadLabel` + 各位 `positionLabel`
- AI `describeSpread` 已按 `positionLabel` 注入，无需改协议
- 凯尔特十字见 P33；对外文案禁「塔罗」（「凯尔特十字」作牌阵名可用）

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

### 3.35 P32 回看对照（已定）

- 解读页：若同一 owner（`userId` 或访客 `anonymousId`）存在**同题**（`trim` + 折叠空白）且已抽牌的更早一卦，仪式揭晓后展示「与上一卦轻轻对照」：并排 **上一卦 / 本卦** 关键牌（位标 + `TarotCardFace` + 正逆）
- 牌阵相同按位对齐；不同则两列各自完整展示（不硬对齐）
- 无先验匹配时不展示任何空状态
- 无需 AI、无 DB migration；`findPriorReadingByQuestion` 查现有表
- 历史卡可选「可对照」chip（有先验时）
- 文案禁「塔罗」


### 3.36 P33 凯尔特十字（已定）

- `SpreadType` 增 `celtic_cross`；显示名 **凯尔特十字**（十位）
- 位序：现状 / 挑战 / 根基 / 近况 / 可能显化 / 近前 / 自我 / 环境 / 希冀与隐忧 / 综合走向（ids：`present`/`cross`/`foundation`/`recent_past`/`crown`/`near_future`/`self`/`environment`/`hopes_fears`/`outcome`）
- 起卦可选；hint「十字十位 · 全景深入」；API allowlist；`draw.ts` 抽 10 张不重复
- 仪式：sm+ 十字 + 右侧竖杖可读布局；移动端双列；逐张翻开动画覆盖全部 10 张
- 历史 / 分享文 / 分享 PNG：走既有 `spreadLabel` + `positionLabel`；分享图对 10 牌缩小瓦片并抬高画布
- AI：`describeSpread` 已按位标注入；详细档可更长，无需新协议
- 回看对照（P32）：经 `spreadResult.cards` 自然工作
- 「凯尔特十字」作牌阵产品名可用；其余对外文案仍禁「塔罗」
- 下一批曾指向 P34；**P34 已完成**（见 §3.37）


### 3.37 P34 账号系统补全（已定）

- 保留既有用户名/密码 + httpOnly `ct_session`
- 登录页可选 **GitHub / Google** OAuth（环境变量齐全才显示按钮；缺省不崩溃）
- 自定义 OAuth（非整站改写为 Supabase Auth）：`GET /api/auth/oauth/github|google` → 授权；共用 `GET /api/auth/oauth/callback`（state 编码 provider + HMAC CSRF）
- 首登：写入 `tarot_users`（`password_hash` 可空）、建会话、`mergeAnonymousReadings`；回访按 `(auth_provider, provider_user_id)` 查找
- 显示名取 OAuth profile；用户名 `gh_<login|id>` / `go_<sub>`（OAuth 放宽至 48 位）
- Migration：`20260911170000_oauth_users.sql`（`auth_provider` / `provider_user_id` / `avatar_url` / `email` + 部分唯一索引）
- Env：`OAUTH_BASE_URL`（或 `VERCEL_URL` / request origin）、`GITHUB_OAUTH_CLIENT_ID/SECRET`、`GOOGLE_OAUTH_CLIENT_ID/SECRET`；复用 `SESSION_SECRET` 签 state
- Redirect URI：`{OAUTH_BASE_URL}/api/auth/oauth/callback`（生产必配；本地可另加 localhost）
- 设置页展示登录身份 + 登录方式提示；文案禁「塔罗」
- 手机号登录仍后置

### 3.38 P36 静默模式（已定）

- **静默揭晓**：仪式牌面全部揭晓后，若尚无消息，**不**自动调用 interpret
- CTA：**「请烛火开口」**；短提示：先静静看牌，准备好再请烛火开口
- 点击后走既有 interpret 流式流程（与今日自动解读相同）
- 静默关闭（默认）：保持 `ritualDone && messages.length === 0` 时自动 interpret
- 设置默认：`user-prefs.silentReveal`（localStorage），默认 `false`
- 起卦表单可本局覆盖（同 detail/speed）；落库 `silent_reveal boolean not null default false`
- 解读页静默时可选徽章「静默」；文案禁「塔罗」


### 3.39 P37 易用性 / 流程缩短 / 跳转体感（已定）

- **起卦表单**：常显场景 + 问题 +「确认起卦」；牌阵 / 解读档 / 仪式速度 / 静默揭晓默认收进「牌阵与仪式（可选）」；收起时 prefs 与场景 defaultSpread 仍预填生效；剧场软提示在展开区内
- **首页快速起卦**：场景卡保留点进表单编辑；卡上「快速起卦」一键用示例问题 + `defaultSpread` + prefs，`POST /api/readings` 后进解读；尊重额度、暖色错误；自定义卡无示例题故无快速按钮；英雄区可对「日常抉择」一键
- **感知导航**：`loading.tsx` 骨架（新占卜 / 解读 / 历史）；主导航与首页 CTA `Link` prefetch；起卦成功后 `router.prefetch` 再 `push`
- **仪式**：SPEEDS slow/normal/fast → 1200 / 650 / 280；翻牌子延迟下限略降；**仍无跳过**
- 文案禁「塔罗」

### 3.40 P38 解读 Markdown 渲染（已定）

- 顾问（assistant）气泡与流式解读/追问用轻量 Markdown 渲染（`react-markdown` + `AdvisorMarkdown`）
- 用户气泡（含追问子牌阵 / 象征牌链）仍为纯文本
- 烛光主题自定义样式：软标题、可读列表、**强调**偏 primary/琥珀；气泡内 `text-sm` 紧凑间距
- `OUTPUT_RULES`：允许短 `##` / `**强调**` / `-` 列表；禁代码围栏、表格、HTML、过深标题；小节标题优先 总览 / 牌意 / 综合
- mock AI 输出含样例 Markdown，便于 mock 模式验收
- 文案禁「塔罗」

### 3.41 P39 场景微剧本（已定）

- 六场景 + 自定义各有「开场旁白」与「落烛」短句（`scenes.ts` `opening` / `settle`）
- 仪式面板：揭晓前显示开场；牌落定后显示落烛；氛围向，不改变抽牌/解读逻辑
- COPY.md 同步清单；文案禁「塔罗」


### 3.42 P40 分享/信物再打磨（已定）

- 「保存分享图」与「烛火信物」：生成 PNG 后不再自动 Web Share 再静默下载
- 一次生成 → 底部 Sheet 预览：`保存图片` / `系统分享`（`canShare` 文件）/ 关闭；`AbortError` 静默
- 分享文案朋友圈向加温（`share-reading.ts` + COPY）；不含 id/cookie/AI 内部
- 信物版式：间距、短签可读性、品牌脚注、牌面框；仍 1080×1920，CARD_ART 可用时叠入；无新依赖 / 无 migration



### 3.43 P41 克制多局记忆（已定）

- 同 owner、同 `normalizeQuestion` 的更早一卦（复用 P32 `findPriorReadingByQuestion`）时，解读顾问在开篇轻提一句（如「你上次问过类似的问题…」），随后仍以本局牌面为主
- 仅注入牌阵/牌面摘要（`priorHint`），**不**注入旧 AI 全文；**不**把追问做成跨局长记忆；无 migration
- mock / DeepSeek 提示词均走同一 `InterpretInput.priorHint`；无旧卦时行为不变

### 3.44 P42 PWA（主屏安装 + 弱网壳缓存）（已定）

- Web App Manifest（`display: standalone`）+ 192/512 图标 + apple-touch-icon；viewport `themeColor` 烛夜深色
- Service Worker（`public/sw.js`）：预缓存首页壳与图标；导航 network-first（失败回壳）；`/_next/static`、`/cards`、`/icons` cache-first；**不**缓存 `/api/`
- 生产注册 SW（开发跳过）；设置「关于」提示可添加主屏幕；不是桌面小组件；无 migration / 无新 npm 依赖


### 3.45 P43 真机浸泡清单（已完成）

- 整条真机路径走通：起卦 → 仪式 → 解读 → 追问 → 分享 → 主屏安装
- 专修卡顿、文案硌、按钮藏太深等小刺；**不新开大功能**
- 可勾选清单：`tarot/SOAK.md`；本切片小刺：解读失败/停滞可再试；分享与信物独立成条；「分享图」与「象征牌」文案对齐

### 3.46 P44 首次来访引导（已完成）

- 第一次进站：用 **1～2 句**烛光旁白讲清「怎么起一卦」（首页主 CTA 旁，软提示非遮罩）
- **不做**教程墙、多步 wizard、强制遮罩
- 看过一次后不再打扰（`localStorage` key `candle-taro:first-visit-guide-seen`；点「知道了」后不再显示）
- 实现：`src/components/home/first-visit-guide.tsx`、`src/lib/first-visit.ts`；文案见 `COPY.md`

### 3.47 P45 访客→登录转化（已完成）

- 额度将近用尽 / 用尽时：文案更温柔、路径更短（少跳转、登录 CTA 就近）
- 就近「轻轻登录」按钮 + 可选 GitHub 一键；`?next=` 登录/OAuth 后回原页
- GitHub OAuth 已有；**Google OAuth 仍可选**（缺 env 不阻塞；不强制 Google secrets）
- 不改额度数字本身
- 触及：`QuotaHint` / `GuestLoginCta`、新占卜页、追问区、快速起卦、首页用尽 nudge、登录页 OAuth 置顶

### 3.48 P46 历史好找（已完成）

- 历史列表：按 **场景 / 时间**筛选
- **同题成组**（`normalizeQuestion` 对齐 P32/P41；可展开/收起）
- **软收藏**（星标；本机 `localStorage` 按 reading id；登录与访客同一设备均可用；非复杂标签）
- 目标：历史一长仍能快速找回
- 无 DB migration；文案禁「塔罗」

### 3.49 P47 解读语气再校准（已完成）

- 六场景口吻更分明（感情更柔、事业更稳、日常抉择更短平等，对齐 COPY「场景语气」；`scenes.ts` `tonePrompt` + prompts 权重「必须可辨认」）
- Markdown 结构更稳：解读强制 **## 总览 → ## 牌意 → ## 综合**（简要压缩；详细可加 ## 建议）；减少飘移小节
- mock 总览开场按场景区分；仍禁绝对预言；对外文案禁「塔罗」

### 3.50 P48 局内时间线（已落地）

- 本卦轻量时间轴：揭晓 → 解读 → 追问/象征牌 → 信物
- 偏回看导航，不打断仪式；移动端可折叠；桌面默认展开
- 无强制新 DB；由 `ritualDone` / messages / 本机信物标记推导（`reading-timeline.ts`）
- UI：`ReadingTimeline` 粘性条 + 锚点回看；禁「塔罗」

### 3.51 P49 多局记忆加一层（仍克制）（已落地）

- 在 P41 同题轻提之上：若近几日（约 7 天）问过**相关主题**（非必须同句），开篇可轻提 **一句**
- 相关判定：同非自定义场景，或问题软 token 重叠（`related-theme.ts`）；复用 store `findRelatedThemeReading`；注入 `relatedThemeHint`（场景/问题摘要/牌阵/牌面正逆，无旧 AI 文）
- **仍不**注入旧 AI 全文；**不**做成跨局长聊天 / 通用 agent 记忆；无相关旧卦时行为不变；追问不变；无 migration
- 默认克制：仅解读开篇；**至多一句记忆轻提**——有同题 `priorHint`（P41）时优先同题、不叠相关主题；无同题才用相关主题

### 3.52 P50 公开分享页（已落地）

- 可选只读短链 `/s/[token]`：朋友打开可见牌阵摘要（问题 / 场景·牌阵 / 各位牌面正逆）+ 固定短句 + 娱乐免责（比纯图片更完整）
- 用户可开 / 关：开启写入不透明 `public_share_token` 并复制绝对 URL；关闭置空即失效（再开会换新 token）
- 不含账号、cookie、内部 id、AI 原文全文（默认不展示解读/追问）；文案禁「塔罗」
- 安全选型：不透明 slug（nanoid）存库，URL 不暴露 reading UUID；最小 migration `20260915100000_public_share_token.sql`（signed URL 无法真正失效已发链接，故需此列）

### 3.53 P51 今日一牌习惯（已定方向 · 待做）

- 依托已有 PWA：设置里可选 **每日轻提醒**，和/或主屏打开默认落到 **今日一牌**
- 不是桌面小组件；提醒须可关；尊重系统通知权限（若做 push 则另评估，本项可先做站内/打开落点）

## 4. MVP 范围

含：场景起卦、文本仪式（三速）、简要/详细解读、自由追问（含追问子牌阵与象征牌链）、新占卜按钮与软提示、历史卡片（重命名/软删）、访客/登录额度、用户名密码登录 + GitHub/Google OAuth、深色烛光 UI、插画风牌面示意 + 78 张混合位图（大阿尔卡纳 + 圣杯/权杖/宝剑/星币花色全套）、AI mock + deepseek 接线、流式解读/追问 UI、解读 Markdown 渲染、基础无障碍与空状态抛光、分享牌阵纯文本摘要、烛光分享 PNG、烛火信物竖版壁纸、额度感知 UX、牌义图鉴、加厚牌库释义、首页今日一牌、牌阵剧场三阵（关系双人/抉择分叉/月相三问）、场景剧场软提示、同题回看对照（上一卦/本卦）、凯尔特十字十位、静默模式（揭晓后手动请烛火开口）、易用性缩短起卦与跳转体感（折叠选项 / 快速起卦 / 骨架屏 / 仪式略加速）、场景微剧本（开场旁白 / 落烛）、分享/信物预览保存与系统分享拆分、克制多局记忆（同题旧卦轻提 + 近几日相关主题轻提，仅解读）、PWA（主屏安装 + 弱网壳缓存）、真机浸泡清单与小刺修复（P43）；公开分享只读短链可关（P50）。

不含（付费等仍后置）：付费、手机号登录；混合位图已齐（不强制外购整副）。OAuth（GitHub/Google）已在 P34 落地。

体验抛光队列（见 §5）：**P43–P50 已完成**；**P51 中段顾问感**（今日一牌习惯）待做。

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
| P32 | 回看对照（同题上一卦 / 本卦关键牌并排） | 已完成 |
| P33 | 凯尔特十字十位 `celtic_cross` | 已完成 |
| P34 | 账号系统补全（OAuth 等） | 已完成 |
| P35 | 象征牌链（一次抽 3 张，计 3 追问额度） | 已完成 |
| P36 | 静默模式（揭晓后 CTA 再解读） | 已完成 |
| P37 | 易用性：缩短起卦与跳转体感（折叠高级选项 / 快速起卦 / 骨架屏 / 仪式略加速） | 已完成 |
| P38 | 解读 Markdown 渲染（顾问气泡 + 流式；用户仍纯文本） | 已完成 |
| P39 | 场景微剧本（开场旁白 + 落烛） | 已完成 |
| P40 | 分享/信物再打磨（预览保存/系统分享 + 文案与版式） | 已完成 |
| P41 | 克制多局记忆（同题旧卦轻提，仅解读） | 已完成 |
| P42 | PWA（主屏安装 + 弱网壳缓存） | 已完成 |
| P43 | 真机浸泡清单（小刺修复，不大开功能） | 已完成 |
| P44 | 首次来访引导（1～2 句旁白） | 已完成 |
| P45 | 访客→登录转化（更温柔短路径） | 已完成 |
| P46 | 历史好找（场景/时间筛选、同题成组、软收藏） | 已完成 |
| P47 | 解读语气再校准（场景口吻 + Markdown 结构） | 已完成 |
| P48 | 局内时间线（揭晓→解读→追问→信物） | 已完成 |
| P49 | 多局记忆加一层（近几日相关主题轻提，仍克制） | 已完成 |
| P50 | 公开分享页（只读短链，可关） | 已完成 |
| P51 | 今日一牌习惯（轻提醒 / 主屏默认落点） | 待做 |

## 6. 详细设计

见 `DEV.md`。P43–P50 已完成；P51 方向已定、实现待做；付费/手机号等仍见 DEV「待续讨论」。
