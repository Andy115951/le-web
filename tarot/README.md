# Candle Taro (`tarot/`)

烛光占卜 Web 应用 — `le-web` monorepo 子项目。

产品决策见 `PLAN.md` / `DEV.md` / `COPY.md`。

## Dev

```bash
cd tarot
npm install
npm run dev
```

Vercel：独立项目，Root Directory = `tarot`。

## Status

**P0–P42 已落地**；**P43–P51 体验队列已写入 PLAN（待做）**（见 `PLAN.md` / `DEV.md`）。含仪式起卦、流式解读/追问、78 张 `CARD_ART`、牌义图鉴、OAuth、静默模式、场景微剧本、分享/信物预览、克制多局记忆、PWA 等。生产：https://candle-taro.vercel.app

默认使用 `AI_PROVIDER=mock`。生产配置 `AI_PROVIDER=deepseek` 和 `DEEPSEEK_API_KEY` 后，解读与追问会走 DeepSeek OpenAI 兼容接口；模型请求失败时会保守回退到 mock，不会中断占卜流程。完整环境变量、部署和实现边界见 `DEV.md`。
