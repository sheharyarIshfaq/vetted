import { z } from "zod";

// The source asks for at most 2 requests per second.
const MIN_REQUEST_GAP_MS = 600;

const RETRY_DELAYS_MS = [5_000, 20_000, 60_000];

let lastRequest = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function politeFetch(url: string, userAgent: string, init: RequestInit = {}) {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequest + MIN_REQUEST_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    const response = await fetch(url, { ...init, headers: { ...init.headers, "User-Agent": userAgent } }).catch((error: unknown) => error);
    const retryable = !(response instanceof Response) || response.status === 429 || response.status >= 500;
    if (retryable && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    if (!(response instanceof Response)) throw response;
    if (!response.ok) throw new Error(`Safety Gate ${url}: HTTP ${response.status}`);
    return response.text();
  }
}

const text = z.preprocess((value) => (typeof value === "string" || typeof value === "number" ? String(value).trim() : ""), z.string());

const pictures = z.preprocess((value) => {
  if (typeof value === "string") return value.split(/\s+/);
  if (value && typeof value === "object" && "picture" in value) return [value.picture].flat();
  return [];
}, z.array(z.string()));

export const alertSchema = z.looseObject({
  caseNumber: z.string().min(1),
  reference: z.url(),
  category: text,
  product: text,
  brand: text,
  name: text,
  type_numberOfModel: text,
  batchNumber: text,
  barcode: text,
  riskType: text,
  danger: text,
  measures: text,
  description: text,
  notifyingCountry: text,
  type: text,
  level: text,
  pictures,
  companyRecallCode: text,
  productionDates: text,
});

export type SafetyGateAlert = z.infer<typeof alertSchema> & { reportId: string; publishedAt: string };
