// Sliding-window limits per client, kept in memory: the app runs as one server process.
export type Limit = { max: number; windowMs: number };

const hits = new Map<string, number[]>();
let checksSinceSweep = 0;

// Records a request and returns the seconds to wait when one of the limits is reached, or null.
export function rateLimit(key: string, limits: readonly Limit[], now = Date.now()) {
  const longest = Math.max(...limits.map((limit) => limit.windowMs));
  const recent = (hits.get(key) ?? []).filter((time) => time > now - longest);
  for (const { max, windowMs } of limits) {
    const inWindow = recent.filter((time) => time > now - windowMs);
    if (inWindow.length >= max) {
      hits.set(key, recent);
      return Math.ceil((inWindow[0] + windowMs - now) / 1000);
    }
  }
  recent.push(now);
  hits.set(key, recent);
  if (++checksSinceSweep >= 1000) sweep(now, longest);
  return null;
}

function sweep(now: number, windowMs: number) {
  checksSinceSweep = 0;
  for (const [key, times] of hits) {
    if (times.every((time) => time <= now - windowMs)) hits.delete(key);
  }
}

// The client address as the proxy in front of the app saw it. A client can send its own X-Forwarded-For,
// so only the last entry, added by the proxy, is trusted.
export function clientIp(headers: Headers) {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
}
