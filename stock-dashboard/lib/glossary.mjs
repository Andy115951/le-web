// Beginner glossary: plain-language explanations for the jargon on the page.
// Each entry is one term -> a short, non-advice explanation a newcomer can grasp.
// Keep every definition free of buy/sell language and free of new jargon.

export const GLOSSARY = {
  QQQ: {
    title: "QQQ",
    body: "一只追踪纳斯达克100指数的基金。买它约等于一次性买入纳斯达克最大的100家公司（苹果、微软、英伟达等），常被当作“美国科技股整体表现”的温度计。"
  },
  "纳斯达克100": {
    title: "纳斯达克100 / NDX",
    body: "纳斯达克交易所里市值最大的100家非金融公司组成的指数，科技股占大头。它涨说明这批大公司整体在涨，跌则相反。"
  },
  回撤: {
    title: "回撤",
    body: "从最近的最高点跌下来的幅度。比如一只股票从100块最高涨到120，又跌回108，那从峰值算回撤就是 -10%。数字越大，说明离最风光的时候跌得越多。"
  },
  波动率: {
    title: "波动率",
    body: "价格上下晃动的剧烈程度。波动率高＝这段时间涨跌都很猛、比较刺激也比较不安稳；波动率低＝走得比较平稳。它不判断涨还是跌，只描述“晃得凶不凶”。"
  },
  相似日: {
    title: "相似日",
    body: "历史上和今天“市场状态长得像”的交易日（涨跌、波动等特征接近）。看那些日子后来怎么走，是一种找参照的方式——但历史不代表未来，只当线索，别当预言。"
  },
  归因: {
    title: "归因",
    body: "试着解释“今天为什么涨/跌”。比如把某只股票的下跌和一条公司新闻联系起来。注意：这是“可能有关”的假设，不是板上钉钉的因果。"
  },
  Brier: {
    title: "Brier 分数",
    body: "衡量“预测概率准不准”的一把尺子，越低越准。项目用它检验模型预测涨跌的能力——目前模型的分数还不如简单参照，所以我们不拿它做决策。这本身就是一课：预测很难。"
  },
  "相对强弱": {
    title: "相对强弱",
    body: "把一只股票和大盘（QQQ）比，它是更强还是更弱。大盘跌1%、它只跌0.3%，就是相对更强；大盘涨、它反而跌，就是相对更弱。用来看个股是随大流还是有自己的故事。"
  },
  基准: {
    title: "基准",
    body: "用来做对比的参照物，这里通常指 QQQ。判断一只股票表现好不好，光看它自己不够，要和基准比——跑赢基准才算真的强。"
  },
  成分股: {
    title: "成分股",
    body: "组成一个指数的那些公司。纳斯达克100的成分股就是里面那100家公司，权重越大的公司对指数影响越大。"
  },
  权重: {
    title: "权重",
    body: "一家公司在指数里的分量。权重7%意味着这家公司涨跌1%，大约能带动整个指数动0.07%。权重大的公司（如英伟达、苹果）是指数的“大腿”。"
  },
  财报: {
    title: "财报",
    body: "公司定期公布的“成绩单”（营收、利润等）。财报好坏常引发股价大幅波动，所以财报日值得留意。"
  },
  止盈: {
    title: "止盈",
    body: "在赚到一定程度时主动卖出、把利润落袋，避免又跌回去。这里的“回撤止盈规则”是帮你在从高点跌下来一定幅度时提个醒，不替你下单。"
  }
};

// Wrap any occurrence of a glossary term in `text` with a clickable help chip.
// Returns HTML. `escapeFn` must be provided so the surrounding text stays safe.
export function annotateGlossaryTerms(text, escapeFn) {
  const safeEscape = typeof escapeFn === "function" ? escapeFn : function (value) { return String(value); };
  let html = safeEscape(String(text == null ? "" : text));
  // Longest terms first so "纳斯达克100" wins over a bare "纳斯达克".
  const terms = Object.keys(GLOSSARY).sort(function (a, b) { return b.length - a.length; });
  const wrapped = new Set();
  terms.forEach(function (term) {
    if (wrapped.has(term)) return;
    const safeTerm = safeEscape(term);
    // Only annotate the first occurrence of each term to avoid clutter.
    const index = html.indexOf(safeTerm);
    if (index === -1) return;
    const chip = '<button type="button" class="glossary-term" data-glossary="' + safeEscape(term)
      + '" aria-label="' + safeTerm + ' 是什么？">' + safeTerm + '<i aria-hidden="true">?</i></button>';
    html = html.slice(0, index) + chip + html.slice(index + safeTerm.length);
    wrapped.add(term);
  });
  return html;
}

export function getGlossaryEntry(key) {
  return GLOSSARY[key] || null;
}

// Pick a "concept of the day" deterministically from the date string (YYYY-MM-DD),
// so everyone sees the same term on the same day and it rotates daily.
export function getDailyConcept(dateStr) {
  const keys = Object.keys(GLOSSARY);
  if (!keys.length) return null;
  const digits = String(dateStr || "").replace(/\D/g, "");
  let seed = 0;
  for (let i = 0; i < digits.length; i += 1) seed = (seed * 31 + Number(digits[i])) % 100000;
  const key = keys[seed % keys.length];
  return { key, ...GLOSSARY[key] };
}
