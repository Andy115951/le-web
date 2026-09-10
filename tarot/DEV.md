# leweb · tarot — 开发文档（冻结产品决策 v0.6 · 2026-09-10）

> 状态：产品决策已冻结（见下「决策记录」）。实现未开始；本文供后续开发对照。
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
| 牌面 | MVP 简化示意；美化后置 |
| 产品名 | Candle Taro（禁「塔罗」二字） |
| 示例问题 | 六场景已定稿，见 COPY.md |
| 语气 | 六档调性已定稿，见 COPY.md |
| 访客历史 | 登录后自动合并 |
| 前端 UI | Next.js + Tailwind + shadcn（基础控件）；仪式/牌面自定义 |

### 待续讨论（仍可再抠）

- 精美卡面方案（P6+）
- 启动页/空状态微文案

---


## 1. 产品一句话

选场景或自定义提问 → 仪式揭晓（服务端已抽好的牌）→ AI 简要/详细解读 → 自由追问 → 历史回看；访客少额度促登录。

## 2. 核心流程与状态机

```text
选场景/自定义 → 编辑问题 →（可选改牌阵/解读档/仪式速度）→ 确认起卦
  → 服务端抽牌落库 → 仪式阶段（慢/常/快）→ 揭示牌面
  → 流式解读 → ready_for_followup → 追问…
  → 可「新占卜」或接受「建议重抽」
```

`draft → shuffling → drawing → revealed → interpreting → ready_for_followup → archived`

## 3. 技术架构建议

```text
Next.js (App Router) + Tailwind + shadcn in le-web/tarot
  → Vercel（独立项目，root = tarot）
  → Supabase Postgres（tarot_* 表）
  → AI：Vercel AI Gateway + AI SDK streamText
  → Auth：username/password + httpOnly session（对齐 quadrant-todo）
  → 仪式区/牌面：自定义组件（不用 shadcn 默认皮肤硬套）
```

抽牌：服务端 `crypto.getRandomValues` + Fisher–Yates；结果写入 DB 后再返回前端。

### 数据表草案

- `tarot_users` / `tarot_sessions`（或复用统一用户表，实现时再定）
- `tarot_readings`（question, scene, spread_type, spread_result, status, detail_level, ritual_speed, user_id/anonymous_id…）
- `tarot_messages`（reading_id, role, content）
- `tarot_usage_counters`（subject_key, day, readings_count, messages_count）

## 4. 实现阶段

见 `PLAN.md` §5。动画为 P6，不挡主链路。

## 5. 风险

| 风险 | 对策 |
|------|------|
| AI 胡说牌义 | 注入牌库摘要；提示词以提供牌义为准 |
| 访客刷接口 | 签名 cookie + 日额度 + IP 限流 |
| 神秘文案过度承诺 | 固定免责 + 句式约束 |
| 与 monorepo 其他 app 耦合 | 独立 Vercel rootDirectory，表前缀隔离 |
