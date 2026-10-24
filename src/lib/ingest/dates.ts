const DAY_MS = 24 * 60 * 60 * 1000;

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// "2026-10-19T08:58:34+00:00" or "2026-10-19" -> "2026-10-19"
export function toIsoDate(value: string | null | undefined) {
  const day = value?.slice(0, 10);
  return day && isIsoDate(day) ? day : null;
}

// "7d" -> the date seven days before now
export function sinceDate(spec: string, now = new Date()) {
  const match = /^(\d+)d$/.exec(spec);
  if (!match) throw new Error(`Expected a number of days like "7d", got "${spec}"`);
  return new Date(now.getTime() - Number(match[1]) * DAY_MS).toISOString().slice(0, 10);
}
