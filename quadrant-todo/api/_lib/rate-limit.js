const { getClientIp, json, setHeader } = require("./http");

const buckets = new Map();

function prune(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function checkRateLimit(req, res, options) {
  const now = Date.now();
  prune(now);

  const windowMs = options.windowMs;
  const max = options.max;
  const route = options.route;
  const ip = getClientIp(req) || "unknown";
  const key = `${route}:${ip}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return true;
  }

  if (bucket.count >= max) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    setHeader(res, "Retry-After", String(retryAfter));
    json(res, 429, {
      error: "Too many requests. Please try again later."
    });
    return false;
  }

  bucket.count += 1;
  return true;
}

module.exports = {
  checkRateLimit
};
