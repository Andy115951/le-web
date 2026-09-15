# leweb · tarot — 开发文档（冻结产品决策 v2.30 · 2026-09-15）

> 状态：**P0–P51 已实现**；**P43–P51 体验队列完成**（P19：22 张大阿尔卡纳；P20–P21：圣杯；P22：权杖；P23：宝剑；P24–P25：星币花色全套 `pentacles_ace`–`pentacles_king` 混合位图；78 张 `CARD_ART` 齐；P28 追问子牌阵；P35 象征牌链；P29 牌阵剧场三阵；P30 烛火信物；P31 场景剧场软提示 + COPY v1.7；P32 同题回看对照；P33 凯尔特十字十位；P34 GitHub/Google OAuth；P36 静默模式；P37 易用性：折叠高级选项 / 快速起卦 / 骨架屏 / 仪式 SPEEDS 1200/650/280；P38 解读 Markdown 渲染；P39 场景微剧本开场/落烛；P40 分享/信物预览保存与系统分享；P41 克制多局记忆：同题旧卦轻提；P42 PWA：主屏安装 + 弱网壳缓存；P43 真机浸泡清单 `SOAK.md` + 解读再试 / 分享条 / 文案小刺；P44 首次来访引导：首页 CTA 旁 1～2 句旁白 + localStorage 一次 dismiss；P45 访客→登录转化：温柔文案 + 就近 CTA + GitHub 一键 + `next` 回跳；P46 历史好找：场景/时间筛选、同题成组、本机软收藏；P47 解读语气再校准：场景口吻更分明 + 解读固定总览→牌意→综合 + COPY v1.19；P48 局内时间线：揭晓→解读→追问→信物粘性回看条 + COPY v1.20；P49 多局记忆加一层：近几日相关主题 `relatedThemeHint` + COPY v1.21；P50 公开分享页：`/s/[token]` + `public_share_token` 可关 + COPY v1.22；P51 今日一牌习惯：`openToDailyCard` / `dailyHabitNudge` + 站内轻提醒 + COPY v1.23）。AI 默认 `AI_PROVIDER=mock`；`AI_PROVIDER=deepseek`（legacy 别名 `gateway`）走 DeepSeek OpenAI 兼容接口（对齐 stock-dashboard：`DEEPSEEK_API_KEY` / `DEEPSEEK_API_URL` / `DEEPSEEK_MODEL`），失败回退 mock。P13 起不再使用 Vercel AI Gateway。P17 混合桥接；P18 牌库加厚 + 今日一牌；P19–P25 渐进 `CARD_ART` 收官。生产已可配 `DEEPSEEK_API_KEY`；Vercel↔GitHub 自动部署已接通。
> 仓库路径：`Andy115951/le-web/tarot/`

---

## 决策记录（冻结）

| 项 | 结论 |
|----|------|
| 仓库 / 目录 | `Andy115951/le-web` → `tarot/` |
| Vercel | 独立项目，Root Directory = `tarot` |
| Supabase | `le's Project`，表前缀 `tarot_` |
| 调性 | 仪式感神秘 |
| 视觉 | 深色 + 暖金烛光 + 低对比纹理 |
| 仪式 | 慢/常/快，不可跳过；默认常 |
| 场景 | 感情/事业/学业/人际/日常抉择/身心状态 + 自定义；场景带可编辑示例问题 |
| 牌阵 | 默认三牌；日常抉择默认单牌；可改：单牌/三牌/情境五牌/关系双人/抉择分叉/月相三问/凯尔特十字 |
| 解读 | 简要/详细；设置默认 + 每局可改 |
| 追问 | 自由顾问对话；P28 单张象征牌（计 1 额度）；P35 象征牌链三张（计 3 额度） |
| 新局 | 常驻按钮 + 主题切换时软提示重抽 |
| 历史 | 卡片：标题 + 牌阵 + 关键牌；P32 可对照 chip |
| 访客 | 1 卦/天 + ~5 追问 → 促登录 |
| 登录 | 用户名 + 密码；可选 GitHub / Google OAuth（P34） |
| 登录额度 | 10 卦/天 + ~100 追问 |
| 文案 | 按场景切换语气；禁止绝对预言 |
| 牌面 | P8 插画风示意 + 混合位图（`src/data/card-art.ts` → `public/cards/{id}.webp`）；22 张大阿尔卡纳已齐；圣杯+权杖+宝剑花色全套已齐；大阿尔卡纳+四花色混合位图齐（78）；无图回退示意 |
| 产品名 | Candle Taro（禁「塔罗」二字） |
| 示例问题 | 六场景已定稿，见 COPY.md |
| 语气 | 六档调性已定稿，见 COPY.md |
| 访客历史 | 登录后自动合并 |
| 前端 UI | Next.js + Tailwind + shadcn（基础控件）；仪式/牌面自定义 |
| 启动/空状态微文案 | **已定稿**，见 COPY.md「启动 / 空状态」 |
| AI | mock 默认；deepseek 已接线（`src/lib/ai/`，对齐 stock-dashboard）；非流式 JSON 仍可用作兼容 |
| P6 动画 | CSS 优先；仪式光晕/洗牌/翻牌；示意卡面；尊重 reduced-motion |
| P7 流式 | 解读/追问 NDJSON（`delta`/`done`/`error`）；deepseek 用 `streamText`；mock 分片模拟；reduced-motion 瞬时吐出 |
| P8 插画牌面 | 花色配色、正逆位角标、双层边框角饰、`TarotCardBack`；仍非写实素材 |
| P9 历史管理 | 重命名（PATCH）+ 软删（DELETE）；场景徽章；确认删除 |
| P10 a11y/UX | skip link；仪式/牌面 aria；历史焦点管理；错误与空状态烛光语气 |
| P11 分享 + 设置 | 解读页「分享牌阵」；设置关于 Candle Taro / 额度说明抛光 |
| P12 分享图 | 客户端 canvas 1080×1350 PNG；P40 起预览后再保存/系统分享；隐私同文字摘要 |
| P13 DeepSeek | `AI_PROVIDER=deepseek`（`gateway` 别名）；`@ai-sdk/openai` + DeepSeek；失败回退 mock |
| P14 额度 + 软重抽 | `useQuota` + `QuotaHint`；429 含 usage/quota；解读页可关闭的「新占卜」软提示 chip |
| P15 DeepSeek thinking | 请求体默认 `thinking.disabled`（对齐 stock-dashboard），避免空 content |
| P16 牌义图鉴 | 导航「牌义」；`/cards` 筛选+搜索；`/cards/[id]` 正逆位详情；复用牌库与 `TarotCardFace`；CTA「去占卜」 |
| P17 混合卡面 | 可选 webp 叠在烛光框下；glyph 回退；`src/data/card-art.ts` 渐进映射；分享图同桥 |
| P18 牌库 + 今日一牌 | `deck.ts` 正逆位/关键词加厚（禁绝对预言）；首页每日一牌确定性抽取，不落库、不计额度；链到牌义/起卦 |
| P19 大阿尔卡纳全套 | `public/cards/major_00.webp`–`major_21.webp` + `CARD_ART` 全登记 |
| P20 圣杯批次 | `cups_ace`–`cups_seven` webp 进 `CARD_ART` |
| P21 圣杯收官 | `cups_eight`–`cups_ten` + `cups_page`/`knight`/`queen`/`king`；圣杯花色 `CARD_ART` 齐 |
| P22 权杖花色 | `wands_ace`–`wands_king` webp 进 `CARD_ART` |
| P23 宝剑花色 | `swords_ace`–`swords_king` webp 进 `CARD_ART`；牌义「仅看已配图」曾为渐进筛选，78 张齐后已下线 |
| P24 星币批次 | `pentacles_ace`–`pentacles_seven` webp 进 `CARD_ART` |
| P25 星币收官 | `pentacles_eight`–`pentacles_ten` + `pentacles_page`/`knight`/`queen`/`king`；星币花色与 78 张 `CARD_ART` 齐 |
| P26 情境五牌 | `SpreadType` 增 `five_cross`；抽牌位：现状/挑战/过去影响/近期走向/建议；起卦可选；仪式网格与分享图适配 |
| P27 牌义筛选清理 | 78 张 `CARD_ART` 齐后，下线牌义页「仅看已配图」与「渐进补齐中」提示 |
| P28 追问子牌阵 | 追问区「抽一张象征牌」；`drawSingleCard`；content 头 `⟦SUBCARD⟧`；计 1 message 额度；文字可选；气泡展示牌面；AI 以主阵+象征牌为锚 |
| P35 象征牌链 | 追问区「抽象征牌链」；`drawSingleCards(3)`；`⟦SUBCHAIN⟧`；计 3 message 额度；剩余 <3 拦截；气泡三张 compact；AI 短象征链锚定追问 |
| P29 牌阵剧场 | `relation_dual` / `choice_fork` / `moon_triad`；`draw.ts` 三位；`spread-label` + 起卦剧场提示；仪式三牌网格；分享/历史走 label |
| P30 烛火信物 | 解读后「烛火信物」；`POST .../token` → verse+card；`token-image.ts` 1080×1920；P40 预览保存/系统分享；无 migration |
| P31 剧场软提示 | 感情/人际→关系双人、日常抉择→抉择分叉、身心→月相三问；不改 defaultSpread；COPY v1.7；设置关于同步信物/分享图 |
| P32 回看对照 | 同题（normalizeQuestion）找更早已抽牌一卦；解读页仪式后 `ComparePriorSection` 并排上一卦/本卦；历史「可对照」；无 migration / 无 AI |
| P33 凯尔特十字 | `celtic_cross` 十位；`draw.ts` + allowlist + 起卦 hint「十字十位 · 全景深入」；仪式 sm+ 十字+竖杖 / 移动双列；分享图 10 牌缩小+加高 |
| P34 账号 OAuth | 自定义 GitHub/Google OAuth + 既有 `ct_session`；migration `20260911170000_oauth_users.sql`；登录页「或使用」；缺 env 隐藏按钮；设置页身份+provider |
| P36 静默模式 | 揭晓后不自动 interpret；CTA「请烛火开口」；`user-prefs.silentReveal` 默认 false；起卦覆盖；DB `silent_reveal`；migration `20260914090000_silent_reveal.sql` |
| P37 易用性 | 起卦高级选项默认折叠「牌阵与仪式（可选）」；首页 `QuickStartButton` 一键起卦；`loading.tsx` 骨架（new/[id]/history）；Link prefetch；仪式 1200/650/280ms，无跳过 |
| P38 Markdown | 顾问气泡/`streamingText` 用 `AdvisorMarkdown`（react-markdown）；用户气泡纯文本；`OUTPUT_RULES` 轻量 MD；mock 含样例 |
| P39 场景微剧本 | 六场景 + 自定义 `opening`/`settle`；仪式揭晓前旁白、落定后落烛；COPY v1.12 |
| P40 分享/信物再打磨 | 分享图/信物一次生成 → 预览 Sheet（保存/系统分享/关闭）；文案与信物版式；无 migration |
| P41 克制多局记忆 | 同题旧卦 `priorHint` 注入解读提示词；开篇轻提一句；不注入旧 AI 全文；追问不变；复用 `findPriorReadingByQuestion`；无 migration |
| P49 多局记忆加一层 | 近 7 日相关主题 `relatedThemeHint`（同非自定义场景或问题软重叠）；开篇轻提一句；有同题 `priorHint` 时优先同题不叠主题；仍不注入旧 AI 全文；`findRelatedThemeReading` + `related-theme.ts`；无 migration |
| P50 公开分享页 | 只读 `/s/[token]`；`public_share_token` 可关；摘要不含 AI 全文；migration `20260915100000_public_share_token.sql` |
| P51 今日一牌习惯 | prefs 打开落点 + 主屏 standalone 站内轻提醒；可关；无 push / 无小组件 |
| P42 PWA | Manifest standalone + 图标；`public/sw.js` 壳/静态弱网缓存（不缓存 API）；生产注册 SW；设置关于提示添加主屏幕；无 migration / 无新依赖 |
| P43 | 真机浸泡 | `SOAK.md` 可勾选全路径；解读失败/停滞「再试一次」；分享/信物独立成条；「分享图」+「象征牌」文案；设置主屏安装一句指引 |

### 待续讨论（仍可再抠）

- 混合位图 78 张已齐；牌义「仅看已配图」已下线；后续仅按需重修个别牌面；**冻结：不要求外购整副牌面**
- 手机号登录仍后置；付费仍后置
- **OAuth 运维**：在 GitHub/Google 创建 OAuth App，Redirect URI = `{OAUTH_BASE_URL}/api/auth/oauth/callback`；Vercel 写入 `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / 可选 `OAUTH_BASE_URL`（生产建议显式设为 `https://candle-taro.vercel.app`）。未配置时密码登录仍可用。

### 体验队列 P44–P51

P43–P51 已完成（见 `SOAK.md` / PLAN §3.45–§3.53）。体验队列收官。

| 阶段 | 内容 | 备注 |
|------|------|------|
| P44 | 首次来访引导 | **已完成** · 首页 CTA 旁 1～2 句旁白；`first-visit-guide.tsx` / `first-visit.ts` |
| P45 | 访客→登录转化 | **已完成** · `GuestLoginCta` + 温柔文案 + `next` 回跳；GitHub 一键；Google 可选 |
| P46 | 历史好找 | **已完成** · 场景/时间筛选、同题成组、`localStorage` 软收藏（见下） |
| P47 | 解读语气再校准 | **已完成** · 场景 `tonePrompt` 拉开口吻；`prompts.ts` 强制总览→牌意→综合 +「场景语气必须可辨认」；`mock.ts` 总览按场景开场；COPY v1.19 |
| P48 | 局内时间线 | **已完成** · `ReadingTimeline` + `reading-timeline.ts`；粘性回看；移动端折叠；信物本机标记；无 migration |
| P49 | 多局记忆加一层 | **已完成** · `relatedThemeHint` + `findRelatedThemeReading` / `related-theme.ts`；近 7 日同场景或软重叠；有同题优先 P41；COPY v1.21 |
| P50 | 公开分享页 | **已完成** · `/s/[token]` 只读摘要；`public_share_token` 可关；见下「P50 安全选型」 |
| P51 | 今日一牌习惯 | **已完成** · `openToDailyCard` / `dailyHabitNudge`；主屏 standalone 站内轻提醒；打开滚到 `#daily-card`；无 Notification / push；COPY v1.23 |

勿与后置付费/手机号混进同一切片。

#### P46 软收藏选型（已定）

- **选用本机 `localStorage`**：键 `candle-taro:history-favorites`，值为 reading id 数组。
- **理由**：无 migration、登录与访客同一设备均可星标；与 P44 first-visit 同模式；不做跨设备同步、不做标签系统。
- **同题成组**：客户端复用 `normalizeQuestion`（抽到 `src/lib/normalize-question.ts`，store 再导出）。
- **相关文件**：`history-list.tsx` / `history-card.tsx` / `history-favorites.ts` / `normalize-question.ts`。

#### P50 公开分享页 · 安全选型（已定）

- **URL 形态**：`/s/{public_share_token}`（不透明 nanoid 21，**不**把 reading UUID 放进路径）。
- **为何要最小 migration**：纯 signed URL（HMAC + reading id）可防伪造，但**无法真正失效**已发出的链接；产品要求「可关 / 可失效」，故增加可空列 `public_share_token`（null = 关闭）。migration：`20260915100000_public_share_token.sql`。
- **开启**：owner `POST /api/readings/[id]/share` → 写入新 token（若已开启则轮换）并返回绝对 URL；须已有助手解读。
- **关闭**：owner `DELETE .../share` → 置 `null`，旧链接立即 404。
- **公开页**：只渲染问题 / 场景·牌阵 / 各位牌面正逆 + 固定短句 + 娱乐免责；**不**拉 messages、**不**露账号 / cookie / 内部 id。
- **相关文件**：`public-share.ts`、`public-share-button.tsx`、`app/s/[token]/page.tsx`、`api/readings/[id]/share`、store `enablePublicShare` / `disablePublicShare` / `getReadingByPublicShareToken`。


#### P51 今日一牌习惯 · 选型（已定）

- **本机 prefs**：扩展 `candle-taro:user-prefs` — `openToDailyCard` / `dailyHabitNudge`（默认 `false`）。
- **打开落点**：首页挂载 `DailyHabitOpenScroll`；开启后每会话一次 `scrollIntoView(#daily-card)`（`sessionStorage` 去重）。
- **轻提醒**：仅 `display-mode: standalone` 或 iOS `navigator.standalone`；旁白可「去看」/「今日不再」（`localStorage` 按 Asia/Shanghai 日）；设置可关。
- **不做**：桌面小组件、Notification API / push、改 manifest `start_url`（保持 `/`，用客户端落点）。
- **相关文件**：`user-prefs.ts`、`daily-habit.ts`、`daily-habit.tsx`、`daily-card.tsx`（`id=daily-card`）、`settings-defaults-form.tsx`、`app/page.tsx`、设置关于提示。



---


## 1. 产品一句话

选场景或自定义提问 → 仪式揭晓（服务端已抽好的牌）→ AI 简要/详细解读 → 自由追问 → 历史回看；访客少额度促登录。

## 2. 核心流程与状态机

```text
选场景/自定义 → 编辑问题 →（可选展开改牌阵/解读档/仪式速度/静默）→ 确认起卦；或首页「快速起卦」
  → 服务端抽牌落库 → 仪式阶段（慢/常/快）→ 揭示牌面
  → 仪式动画揭晓（P6）→ 解读（P7 流式）→ ready_for_followup → 追问（P7 流式）…
  → 可「新占卜」或接受「建议重抽」
```

`draft → shuffling → drawing → revealed → interpreting → ready_for_followup → archived`

## 3. 技术架构建议

```text
Next.js (App Router) + Tailwind + shadcn in le-web/tarot
  → Vercel（独立项目，root = tarot）
  → Supabase Postgres（tarot_* 表）
  → AI：DeepSeek OpenAI 兼容 + AI SDK generateText/streamText（AI_PROVIDER=deepseek）
  → Auth：username/password + GitHub/Google OAuth + httpOnly `ct_session`
  → 仪式区/牌面：自定义组件（不用 shadcn 默认皮肤硬套）
```

抽牌：服务端 `crypto.getRandomValues` + Fisher–Yates；结果写入 DB 后再返回前端。

AI 接线：`src/lib/ai/index.ts` 按 `AI_PROVIDER` 选 mock / deepseek（`gateway` 为 legacy 别名）；deepseek 读 `DEEPSEEK_API_KEY`、`DEEPSEEK_API_URL`（默认 `https://mediocre-new-api.midway.run/v1/chat/completions`）、`DEEPSEEK_MODEL`（默认 `deepseek-v4-flash`）。流式协议见 `src/lib/ai/ndjson-stream.ts`；客户端 `reading-client.tsx` 消费 NDJSON。

### 数据表草案

- `tarot_users`（含 `auth_provider` / `provider_user_id` / 可空 `password_hash`） / `tarot_sessions`
- `tarot_readings`（question, scene, spread_type, spread_result, status, detail_level, ritual_speed, silent_reveal, public_share_token, user_id/anonymous_id…）
- `tarot_messages`（reading_id, role, content）
- `tarot_usage_counters`（subject_key, day, readings_count, messages_count）

## 4. 实现阶段

见 `PLAN.md` §5。P0–P51 已落地；P43–P51 体验队列完成。关键：`src/lib/daily-habit.ts`、`daily-habit.tsx`、`user-prefs` 习惯字段；先前：`src/lib/public-share.ts`、`public-share-button.tsx`、`app/s/[token]/page.tsx`、`api/readings/[id]/share`、`public_share_token` migration；先前：`src/lib/related-theme.ts`、`findRelatedThemeReading`、`InterpretInput.relatedThemeHint`、`interpret` route / `prompts.ts` / `mock.ts`；先前：`src/components/reading/reading-timeline.tsx`、`src/lib/reading-timeline.ts`、`reading-client.tsx`、`candle-token-button.tsx`、`COPY.md`；先前：`src/lib/ai/prompts.ts`、`src/lib/ai/mock.ts`、`src/data/scenes.ts`；先前：`src/components/history/history-list.tsx`、`history-card.tsx`、`src/lib/history-favorites.ts`、`src/lib/normalize-question.ts`；先前：`src/components/quota/guest-login-cta.tsx`、`src/lib/auth/safe-next.ts`、`quota-hint` / 登录 `next` / OAuth state；先前：`src/components/home/first-visit-guide.tsx`、`src/lib/first-visit.ts`；关键：`SOAK.md`；关键：`public/manifest.webmanifest`、`public/sw.js`、`src/components/pwa/register-sw.tsx`、`public/icons/`；`src/lib/ai/types.ts`（`priorHint`）、`prompts.ts` / `mock.ts`、`api/readings/[id]/interpret`；其余：`share-image-preview.tsx`；`src/components/reading/advisor-markdown.tsx`；`src/lib/auth/oauth.ts`、`src/app/api/auth/oauth/`、`src/app/login/`；其余：`src/lib/ai/deepseek.ts`、`src/lib/ai/index.ts`；UI：`src/components/reading/ritual-stage.tsx`、`tarot-card-face.tsx`（含 `TarotCardBack` + 混合位图）、`src/data/card-art.ts`、`public/cards/`、`reading-client.tsx`、`src/lib/sub-card-message.ts`、`src/lib/draw.ts`（含 `drawSingleCard`）、`share-reading-button.tsx`、`candle-token-button.tsx`、`src/lib/share-reading.ts`、`src/lib/share-reading-image.ts`、`src/lib/token-image.ts`、`src/app/api/readings/[id]/token/`、`src/components/history/history-card.tsx`、`src/components/reading/compare-prior-section.tsx`、`findPriorReadingByQuestion`、`src/components/app-shell.tsx`（skip link）；`src/hooks/use-quota.ts`、`src/components/quota/quota-hint.tsx`；牌义图鉴：`src/app/cards/`、`src/components/cards/`；今日一牌：`src/lib/daily-card.ts`、`src/components/home/daily-card.tsx`；快速起卦：`src/components/home/quick-start-button.tsx`；骨架：`app/reading/new/loading.tsx`、`app/reading/[id]/loading.tsx`、`app/history/loading.tsx`；动画样式在 `src/app/globals.css`。

## 5. 风险

| 风险 | 对策 |
|------|------|
| AI 胡说牌义 | 注入牌库摘要；提示词以提供牌义为准 |
| 访客刷接口 | 签名 cookie + 日额度 + IP 限流 |
| 神秘文案过度承诺 | 固定免责 + 句式约束 |
| 与 monorepo 其他 app 耦合 | 独立 Vercel rootDirectory，表前缀隔离 |
| Gateway 不可用 | 失败回退 mock，解读不硬崩 |
| 流式中断 | 未 `done` 时客户端报错；已落库助手消息以 DB 为准 |
