export function renderSparkline(target, points, changePercent) {
  if (!target) return;
  const values = Array.isArray(points) ? points.filter(function (value) {
    return Number.isFinite(value);
  }) : [];

  if (!values.length) {
    target.innerHTML = '<span class="sparkline-empty">--</span>';
    return;
  }

  const width = 120;
  const height = 40;
  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  const range = max - min || 1;
  const path = values.map(function (value, index) {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * (height - 6) - 3;
    return (index === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
  }).join(" ");

  const stroke = changePercent >= 0 ? "var(--ok)" : "var(--danger)";
  target.innerHTML = [
    '<svg viewBox="0 0 ' + width + ' ' + height + '" class="sparkline-svg" aria-hidden="true">',
    '<path d="' + path + '" fill="none" stroke="' + stroke + '" stroke-width="2.5" stroke-linecap="round" />',
    '</svg>'
  ].join("");
}
