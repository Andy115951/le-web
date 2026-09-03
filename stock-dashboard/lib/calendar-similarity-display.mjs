const NON_TRADING_NOTICES = {
  weekend: "周末没有 QQQ 常规交易状态，因此不会请求历史相似日。",
  "market-holiday": "NYSE 已公布全天休市，没有 QQQ 收盘状态可用于相似日匹配。",
  upcoming: "未来日期尚未形成 QQQ 收盘状态，历史相似日会在实际归档交易日后才可研究。",
  "closed-or-missing": "该工作日尚无确认的 QQQ 行情，系统不会用缺失数据构造相似日。"
};

export function canLoadSimilarDays(day) {
  return day?.status === "trading" && Boolean(day?.qqq);
}

export function getSimilarDaysUnavailableMessage(day) {
  return NON_TRADING_NOTICES[day?.status]
    || "该日期没有可确认的 QQQ 交易状态，系统不会构造历史相似日。";
}
