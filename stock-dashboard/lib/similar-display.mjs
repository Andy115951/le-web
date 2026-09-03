const COMPONENTS = [
  { key: "momentum", label: "动量", fields: ["momentum_score", "momentumScore"] },
  { key: "risk", label: "风险", fields: ["risk_score", "riskScore"] },
  { key: "participation", label: "成交活跃度", fields: ["participation_score", "participationScore"] },
  { key: "event", label: "当时已知事件", fields: ["event_score", "eventScore"] }
];

function finiteScore(entry, fields) {
  const value = fields.map(function (field) { return entry?.[field]; }).find(function (item) {
    return item !== null && item !== undefined && item !== "";
  });
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

export function getSimilarMatchComponents(match) {
  return COMPONENTS.map(function (component) {
    const score = finiteScore(match, component.fields);
    return score === null ? null : { key: component.key, label: component.label, score };
  }).filter(Boolean);
}
