# leweb · tarot — 开发文档（冻结产品决策 v1.7 · 2026-09-10）

> 状态：**P0–P16 已实现**。AI 默认 `AI_PROVIDER=mock`；`AI_PROVIDER=deepseek`（legacy 别名 `gateway`）走 DeepSeek OpenAI 兼容接口（对齐 stock-dashboard：`DEEPSEEK_API_KEY` / `DEEPSEEK_API_URL` / `DEEPSEEK_MODEL`），失败回退 mock。P13 起不再使用 Vercel AI Gateway。P6：仪式烛光/洗牌/逐张翻牌动画。P7：解读与追问 NDJSON 流式 UI。P8：插画风牌面（花色配色 / 正逆位角标 / 双层边框角饰 + `TarotCardBack`）。P9：历史重命名 + 软删。P10：无障碍基础（skip link、仪式 live region、牌面 aria、历史对话框焦点）+ 空状态/错误烛光微文案。P11：分享牌阵文字摘要（clipboard / Web Share）+ 设置页关于区块抛光。P12：客户端 canvas 生成烛光分享 PNG（可下载；支持时 Web Share 文件）。P13：DeepSeek 提供商（`src/lib/ai/deepseek.ts`）。P14：额度感知 UX（新占卜/追问页今日额度提示、近耗尽/用尽烛光文案、访客登录引导）+ 解读页软提示重抽 chip。P15：DeepSeek 请求默认 `thinking.disabled`（对齐 stock，避免空 content）。P16：牌义图鉴（`/cards` 列表筛选搜索 + `/cards/[id]` 正逆位详情，复用 `TarotCardFace`）。剩余：精美写实卡面素材。生产已可配 `DEEPSEEK_API_KEY`；Vercel↔GitHub 自动部署已接通。
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
| 牌阵 | 默认三牌；日常抉择默认单牌；高级可改 |
| 解读 | 简要/详细；设置默认 + 每局可改 |
| 追问 | 自由顾问对话 |
| 新局 | 常驻按钮 + 主题切换时软提示重抽 |
| 历史 | 卡片：标题 + 牌阵 + 关键牌 |
| 访客 | 1 卦/天 + ~5 追问 → 促登录 |
| 登录 | 用户名 + 密码（先做） |
| 登录额度 | 10 卦/天 + ~100 追问 |
| 文案 | 按场景切换语气；禁止绝对预言 |
| 牌面 | P8 插画风示意（CSS/SVG）；精美写实仍后置 |
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
| P12 分享图 | 客户端 canvas 1080×1350 PNG；「保存分享图」下载 / 可分享文件；隐私同文字摘要 |
| P13 DeepSeek | `AI_PROVIDER=deepseek`（`gateway` 别名）；`@ai-sdk/openai` + DeepSeek；失败回退 mock |
| P14 额度 + 软重抽 | `useQuota` + `QuotaHint`；429 含 usage/quota；解读页可关闭的「新占卜」软提示 chip |
| P15 DeepSeek thinking | 请求体默认 `thinking.disabled`（对齐 stock-dashboard），避免空 content |
| P16 牌义图鉴 | 导航「牌义」；`/cards` 筛选+搜索；`/cards/[id]` 正逆位详情；复用牌库与 `TarotCardFace`；CTA「去占卜」 |

### 待续讨论（仍可再抠）

- 精美写实卡面素材（位图/外购牌面）

---


## 1. 产品一句话

选场景或自定义提问 → 仪式揭晓（服务端已抽好的牌）→ AI 简要/详细解读 → 自由追问 → 历史回看；访客少额度促登录。

## 2. 核心流程与状态机

```text
选场景/自定义 → 编辑问题 →（可选改牌阵/解读档/仪式速度）→ 确认起卦
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
  → Auth：username/password + httpOnly session（对齐 quadrant-todo）
  → 仪式区/牌面：自定义组件（不用 shadcn 默认皮肤硬套）
```

抽牌：服务端 `crypto.getRandomValues` + Fisher–Yates；结果写入 DB 后再返回前端。

AI 接线：`src/lib/ai/index.ts` 按 `AI_PROVIDER` 选 mock / deepseek（`gateway` 为 legacy 别名）；deepseek 读 `DEEPSEEK_API_KEY`、`DEEPSEEK_API_URL`（默认 `https://mediocre-new-api.midway.run/v1/chat/completions`）、`DEEPSEEK_MODEL`（默认 `deepseek-v4-flash`）。流式协议见 `src/lib/ai/ndjson-stream.ts`；客户端 `reading-client.tsx` 消费 NDJSON。

### 数据表草案

- `tarot_users` / `tarot_sessions`（或复用统一用户表，实现时再定）
- `tarot_readings`（question, scene, spread_type, spread_result, status, detail_level, ritual_speed, user_id/anonymous_id…）
- `tarot_messages`（reading_id, role, content）
- `tarot_usage_counters`（subject_key, day, readings_count, messages_count）

## 4. 实现阶段

见 `PLAN.md` §5。P0–P16 已落地。关键：`src/lib/ai/deepseek.ts`、`src/lib/ai/index.ts`；UI：`src/components/reading/ritual-stage.tsx`、`tarot-card-face.tsx`（含 `TarotCardBack`）、`reading-client.tsx`、`share-reading-button.tsx`、`src/lib/share-reading.ts`、`src/lib/share-reading-image.ts`、`src/components/history/history-card.tsx`、`src/components/app-shell.tsx`（skip link）；`src/hooks/use-quota.ts`、`src/components/quota/quota-hint.tsx`；牌义图鉴：`src/app/cards/`、`src/components/cards/`；动画样式在 `src/app/globals.css`。

## 5. 风险

| 风险 | 对策 |
|------|------|
| AI 胡说牌义 | 注入牌库摘要；提示词以提供牌义为准 |
| 访客刷接口 | 签名 cookie + 日额度 + IP 限流 |
| 神秘文案过度承诺 | 固定免责 + 句式约束 |
| 与 monorepo 其他 app 耦合 | 独立 Vercel rootDirectory，表前缀隔离 |
| Gateway 不可用 | 失败回退 mock，解读不硬崩 |
| 流式中断 | 未 `done` 时客户端报错；已落库助手消息以 DB 为准 |
