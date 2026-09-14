export type SceneId =
  | "love"
  | "career"
  | "study"
  | "social"
  | "choice"
  | "body"
  | "custom";

export type SpreadType =
  | "three_card"
  | "single"
  | "five_cross"
  | "relation_dual"
  | "choice_fork"
  | "moon_triad"
  | "celtic_cross";
export type DetailLevel = "brief" | "detailed";
export type RitualSpeed = "slow" | "normal" | "fast";

/** P39: short ritual micro-script per scene (开场旁白 + 落烛). */
export type SceneScript = {
  opening: string;
  settle: string;
};

export const SCENES: {
  id: SceneId;
  label: string;
  exampleQuestion: string;
  defaultSpread: SpreadType;
  tonePrompt: string;
  opening: string;
  settle: string;
}[] = [
  {
    id: "love",
    label: "感情",
    exampleQuestion: "我们之间，接下来最需要看清的是什么？",
    defaultSpread: "three_card",
    tonePrompt:
      "以轻声、体贴的烛边私语回应；多看见情绪与关系张力，少下判断。",
    opening: "烛火靠得近些。把心里那句还没说清的话，轻轻放在灯芯旁。",
    settle: "牌已落定。别急着定论，先听关系里那一点细微的回响。",
  },
  {
    id: "career",
    label: "事业",
    exampleQuestion: "眼下这份工作/方向，我该如何走下一步？",
    defaultSpread: "three_card",
    tonePrompt: "语气沉稳、有边界；重路径与取舍，少煽情比喻。",
    opening: "烛火稳一点。把方向与取舍，摊开在这张安静的桌上。",
    settle: "牌已落定。看清路径的轮廓即可，不必把下一步说成必然。",
  },
  {
    id: "study",
    label: "学业",
    exampleQuestion: "最近的学习状态，哪里卡住了？",
    defaultSpread: "three_card",
    tonePrompt: "鼓励但不催促；点明卡点与可执行的一小步。",
    opening: "烛火不催。把卡住的地方放到光里，慢慢看一眼。",
    settle: "牌已落定。先认一小步可走的地方，比一次走完更重要。",
  },
  {
    id: "social",
    label: "人际",
    exampleQuestion: "这段关系里，我该调整的是什么？",
    defaultSpread: "three_card",
    tonePrompt: "中性冷静；帮助看清互动模式与自己的位置。",
    opening: "烛火中性。先看清你站在哪里，再看互动怎么绕。",
    settle: "牌已落定。模式比对错更值得留意。",
  },
  {
    id: "choice",
    label: "日常抉择",
    exampleQuestion: "面对这个选择，当下更值得听从的是什么？",
    defaultSpread: "single",
    tonePrompt: "短、清、点到为止；直接给对照，不铺长叙事。",
    opening: "烛火短亮一下。把抉择放轻，只问当下更值得听从的是什么。",
    settle: "牌已落定。对照已经在此，不必再铺长篇。",
  },
  {
    id: "body",
    label: "身心状态",
    exampleQuestion: "我的身心此刻最需要被照顾的是哪一块？",
    defaultSpread: "three_card",
    tonePrompt: "温柔、慢；强调照顾与边界，不制造恐慌。",
    opening: "烛火慢一点。把身心需要被照顾的那一块，交给这点暖光。",
    settle: "牌已落定。先照顾边界与呼吸，不制造恐慌。",
  },
];

export const CUSTOM_SCENE = {
  id: "custom" as const,
  label: "自定义",
  exampleQuestion: "",
  defaultSpread: "three_card" as SpreadType,
  tonePrompt: "保持温和、具体；以牌阵为锚，可延伸为顾问对话。",
  opening: "烛火亮着。把问题轻轻放下，让牌阵替你照见当下。",
  settle: "牌已落定。以这阵为锚，可再慢慢追问。",
};

export function sceneScript(scene: string): SceneScript {
  const s = [...SCENES, CUSTOM_SCENE].find((x) => x.id === scene);
  return {
    opening: s?.opening ?? CUSTOM_SCENE.opening,
    settle: s?.settle ?? CUSTOM_SCENE.settle,
  };
}

export const TONE_BASELINE =
  "用「可能 / 倾向 / 值得留意」；禁止「必将 / 一定会」等绝对预言。对外文案不出现「塔罗」二字。";

export const PRODUCT_NAME = "Candle Taro";
