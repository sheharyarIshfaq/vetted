import { clientIp, rateLimit, type Limit } from "@/lib/rate-limit";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// The site and the extension share one allowance per address; a batch counts as many checks.
const LIMITS = {
  check: [
    { max: 40, windowMs: MINUTE },
    { max: 400, windowMs: DAY },
  ],
  batch: [
    { max: 3, windowMs: HOUR },
    { max: 10, windowMs: DAY },
  ],
} satisfies Record<string, Limit[]>;

function waitText(seconds: number) {
  if (seconds < 90) return `${seconds} seconds`;
  if (seconds < 90 * 60) return `${Math.ceil(seconds / 60)} minutes`;
  return `${Math.ceil(seconds / 3600)} hours`;
}

// A 429 answer when this address has used its allowance, null otherwise.
export function limitReached(request: Request, kind: keyof typeof LIMITS, headers = new Headers()) {
  const wait = rateLimit(`${kind}:${clientIp(request.headers)}`, LIMITS[kind]);
  if (wait === null) return null;
  headers.set("Retry-After", String(wait));
  return Response.json({ error: `Too many checks from this connection. Try again in ${waitText(wait)}.` }, { status: 429, headers });
}
