function getPath(values, width, height, padding) {
  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  const range = max - min || 1;
  const innerHeight = height - padding.top - padding.bottom;

  return values.map(function (value, index) {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - (((value - min) / range) * innerHeight + padding.bottom);
    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2))
    };
  });
}

function renderLine(target, points, changePercent, options) {
  if (!target) return;
  const values = Array.isArray(points) ? points.filter(function (value) {
    return Number.isFinite(value);
  }) : [];

  if (!values.length) {
    target.innerHTML = '<span class="sparkline-empty">--</span>';
    return;
  }

  const width = Number(options?.width) || 120;
  const height = Number(options?.height) || 40;
  const strokeWidth = Number(options?.strokeWidth) || 2.5;
  const showFill = options?.showFill === true;
  const showLastDot = options?.showLastDot === true;
  const chartClass = options?.chartClass || "sparkline-svg";
  const padding = options?.padding || { top: 3, right: 0, bottom: 3, left: 0 };
  const pointsOnPath = getPath(values, width, height, padding);
  const path = pointsOnPath.map(function (point, index) {
    return (index === 0 ? "M" : "L") + point.x + " " + point.y;
  }).join(" ");
  const areaPath = showFill
    ? path + " L " + width + " " + (height - 2) + " L 0 " + (height - 2) + " Z"
    : "";
  const lastPoint = pointsOnPath[pointsOnPath.length - 1];
  const positive = changePercent >= 0;
  const stroke = positive ? "var(--ok)" : "var(--danger)";
  const fill = positive ? "rgba(33, 193, 107, 0.16)" : "rgba(240, 90, 107, 0.16)";

  target.innerHTML = [
    '<svg viewBox="0 0 ' + width + ' ' + height + '" class="' + chartClass + '" aria-hidden="true">',
    showFill ? '<path d="' + areaPath + '" fill="' + fill + '" stroke="none" />' : "",
    '<path d="' + path + '" fill="none" stroke="' + stroke + '" stroke-width="' + strokeWidth + '" stroke-linecap="round" stroke-linejoin="round" />',
    showLastDot ? '<circle cx="' + lastPoint.x + '" cy="' + lastPoint.y + '" r="3.5" fill="' + stroke + '" />' : "",
    '</svg>'
  ].join("");
}

export function renderSparkline(target, points, changePercent) {
  renderLine(target, points, changePercent, {
    width: 120,
    height: 40,
    strokeWidth: 2.5,
    showFill: false,
    showLastDot: false,
    chartClass: "sparkline-svg",
    padding: { top: 3, right: 0, bottom: 3, left: 0 }
  });
}

export function renderTrendChart(target, points, changePercent, options = {}) {
  renderLine(target, points, changePercent, {
    width: 260,
    height: 88,
    strokeWidth: 3,
    showFill: true,
    showLastDot: true,
    chartClass: "trend-chart-svg",
    padding: { top: 8, right: 0, bottom: 10, left: 0 },
    ...options
  });
}
