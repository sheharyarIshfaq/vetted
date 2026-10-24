import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { NewRecall } from "../../db/schema";
import { loadBrandAliases } from "../db/brands";
import { upsertRecalls } from "../db/recalls";
import { isValidGtin } from "../gtin";
import { normalizeBrand, normalizeText } from "../text";
import {
  cacheKey,
  estimateCost,
  needsModel,
  parsePending,
  pendingTexts,
  readCachedDetails,
  validateDetails,
  type RecallDetails,
} from "./parse-details";
import type { IngestPlan } from "./rappelconso";

const REPORTS_URL = "https://ec.europa.eu/safety-gate-alerts/api/download/weeklyReport";
const CACHE_DIR = path.join(process.cwd(), ".cache", "safety-gate");

// The source asks for at most 2 requests per second.
const MIN_REQUEST_GAP_MS = 600;

// The French reports translate categories, product types and risks, which matches French listings better.
const LANGUAGE = "fr";

// Every category is kept except these, which aren't resold second-hand; motor vehicles only for bikes and scooters.
const SKIPPED_CATEGORIES = [
  /^produits cosm[ée]tiques/i,
  /^(produits|substances) chimiques/i,
  /^accessoires de cuisine/i,
  /^machines/i,
  /^articles pyrotechniques/i,
  /atmosph[èe]res explosives/i,
  /pression/i,
  /^appareils de mesure/i,
  /^produits de construction/i,
  /^briquets/i,
];
const DISPOSABLE_VAPES = /cigarettes? [ée]lectroniques? jetables?|disposable e-?cig|vapes? jetables?/i;
const MOTOR_VEHICLES = /^v[ée]hicules [àa] moteur/i;
const BIKE_KEYWORDS = /v[ée]lo|bicycl|bike|trottinette|scooter|gyropode|hoverboard|monoroue|draisienne|skate/i;
const NOT_BIKES = /moto|cyclomoteur|quadricycle|voiture/i;

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

const reportEntrySchema = z.looseObject({
  reference: z.string(),
  publicationDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  year: z.coerce.number(),
  URL: z.url(),
});

export type ReportEntry = { id: string; reference: string; year: number; publishedAt: string };

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === "notifications" || name === "weeklyReport" || name === "picture",
});

const RETRY_DELAYS_MS = [5_000, 20_000, 60_000];

let lastRequest = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function politeFetch(url: string, userAgent: string) {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequest + MIN_REQUEST_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    const response = await fetch(url, { headers: { "User-Agent": userAgent } }).catch((error: unknown) => error);
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

// "23/10/2026" -> "2026-10-23"
function frenchDate(value: string) {
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

export async function fetchReportList(userAgent: string): Promise<ReportEntry[]> {
  const xml = await politeFetch(`${REPORTS_URL}/list/xml/${LANGUAGE}`, userAgent);
  const reports = z.array(reportEntrySchema).parse(parser.parse(xml)["Safety-Gate"]?.weeklyReport ?? []);
  return reports.map((report) => ({
    id: /\/detail\/xml\/(\d+)/.exec(report.URL)?.[1] ?? "",
    reference: report.reference,
    year: report.year,
    publishedAt: frenchDate(report.publicationDate),
  }));
}

// A published weekly report doesn't change, so each one is downloaded once.
export async function fetchReport(report: ReportEntry, userAgent: string) {
  const file = path.join(CACHE_DIR, `${report.id}-${LANGUAGE}.xml`);
  const cached = await readFile(file, "utf8").catch(() => null);
  if (cached !== null) return { xml: cached, fromCache: true };
  const url = `${REPORTS_URL}/detail/xml/${report.id}?language=${LANGUAGE}&search=WEB_REPORT%7C:%7C${report.id},`;
  const xml = await politeFetch(url, userAgent);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, xml);
  return { xml, fromCache: false };
}

export function parseReport(xml: string, report: ReportEntry) {
  const items: unknown[] = parser.parse(xml)["Safety-Gate"]?.notifications ?? [];
  const alerts: SafetyGateAlert[] = [];
  let invalid = 0;
  for (const item of items) {
    const parsed = alertSchema.safeParse(item);
    if (parsed.success) alerts.push({ ...parsed.data, reportId: report.id, publishedAt: report.publishedAt });
    else invalid++;
  }
  return { alerts, invalid };
}

export function isConsumerProduct(alert: SafetyGateAlert) {
  return /^consom/i.test(alert.type) || /^consumer/i.test(alert.type);
}

export function isInScope(alert: SafetyGateAlert) {
  if (SKIPPED_CATEGORIES.some((pattern) => pattern.test(alert.category))) return false;
  if (DISPOSABLE_VAPES.test(`${alert.category} ${alert.product}`)) return false;
  if (MOTOR_VEHICLES.test(alert.category)) {
    const product = `${alert.product} ${alert.name}`;
    return BIKE_KEYWORDS.test(product) && !NOT_BIKES.test(product);
  }
  return true;
}

// An alert can appear again in a later report after an update; the latest report wins.
export function latestByCase(alerts: readonly SafetyGateAlert[]) {
  const byCase = new Map<string, SafetyGateAlert>();
  for (const alert of alerts) {
    const current = byCase.get(alert.caseNumber);
    if (!current || alert.publishedAt >= current.publishedAt) byCase.set(alert.caseNumber, alert);
  }
  return [...byCase.values()];
}

// Fields say "Inconnu", "Unknown" or "-" when the authority didn't know the value.
const UNKNOWN_VALUE = /^(?:inconnue?s?|unknown|non (?:connue?s?|disponibles?|sp[ée]cifi[ée]e?s?)|not (?:known|specified|available)|n\/?a|aucune?|none|-+|\/)\.?$/i;

// "LH02, cn108; 816937989081" -> ["LH02", "cn108", "816937989081"]
export function splitValues(value: string) {
  return value
    .split(/[,;\n]|\s\/\s/)
    .map((part) => part.trim())
    .filter((part) => part && !UNKNOWN_VALUE.test(part));
}

// Barcodes come as published when the whole value is digits; inside other text only with a valid check digit.
export function barcodesIn(values: readonly string[]) {
  const gtins: string[] = [];
  for (const value of values) {
    const digits = value.replace(/\s/g, "");
    if (/^\d{8,14}$/.test(digits)) gtins.push(digits);
    else gtins.push(...(value.match(/(?<!\d)\d{8,14}(?!\d)/g) ?? []).filter(isValidGtin));
  }
  return [...new Set(gtins)];
}

// Only the production dates are free text; models, codes and batches have their own fields.
export function datesText(alert: SafetyGateAlert) {
  if (!alert.productionDates || UNKNOWN_VALUE.test(alert.productionDates)) return null;
  return [`Modèle : ${alert.type_numberOfModel}`, `Dates de production : ${alert.productionDates}`].join("\n");
}

export function toRecall(alert: SafetyGateAlert, details: RecallDetails | null, brandNorm: string | null): NewRecall {
  const types = splitValues(alert.type_numberOfModel);
  const models = types.filter((type) => !/\d/.test(type));
  const refs = types.filter((type) => /\d/.test(type));
  const brand = alert.brand && !UNKNOWN_VALUE.test(alert.brand) ? alert.brand : null;
  const productName = alert.product || alert.name || alert.caseNumber;
  return {
    id: `sg:${alert.caseNumber}`,
    source: "safetygate",
    sourceRef: alert.caseNumber,
    url: alert.reference,
    publishedAt: alert.publishedAt,
    category: alert.category || null,
    subcategory: null,
    brand,
    brandNorm,
    productName,
    models,
    refs,
    gtins: barcodesIn([...splitValues(alert.barcode), ...refs]),
    batches: [],
    sampleBatches: splitValues(alert.batchNumber),
    productionFrom: details?.productionFrom ?? null,
    productionTo: details?.productionTo ?? null,
    // Per-model batches would act as limits, and Safety Gate batches never limit a recall.
    modelRanges: (details?.modelRanges ?? []).map((range) => ({ ...range, batches: [] })),
    soldFrom: null,
    soldTo: null,
    risk: alert.riskType || null,
    reason: alert.danger || null,
    whatToDo: null,
    images: alert.pictures.filter((url) => url.startsWith("https://")),
    datesQuote: details?.quote ?? null,
    raw: alert,
    searchText: normalizeText([brand, productName, alert.name, ...models, ...refs].filter(Boolean).join(" ")),
  };
}

const FIRST_YEAR = 2020;

type Log = (message: string) => void;

export async function ingestSafetyGate({
  since,
  userAgent,
  confirm,
  log,
}: {
  since?: string;
  userAgent: string;
  confirm: (plan: IngestPlan) => Promise<boolean>;
  log: Log;
}) {
  const reports = (await fetchReportList(userAgent)).filter((report) =>
    since ? report.publishedAt >= since : report.year >= FIRST_YEAR,
  );
  log(`Reading ${reports.length} Safety Gate weekly reports${since ? ` published since ${since}` : ` from ${FIRST_YEAR}`}`);
  const all: SafetyGateAlert[] = [];
  let downloaded = 0;
  let invalid = 0;
  for (const report of reports) {
    const { xml, fromCache } = await fetchReport(report, userAgent);
    if (!fromCache) downloaded++;
    const parsed = parseReport(xml, report);
    all.push(...parsed.alerts);
    invalid += parsed.invalid;
  }
  log(`Downloaded ${downloaded} reports, ${reports.length - downloaded} from cache`);
  if (invalid) log(`Skipped ${invalid} alerts that did not match the expected fields`);

  const alerts = latestByCase(all).filter((alert) => isConsumerProduct(alert) && isInScope(alert));
  const texts = alerts.map(datesText);
  const keys = texts.map((text) => (text && needsModel(text) ? cacheKey(text) : null));
  const cached = await readCachedDetails(keys.filter((key): key is string => key !== null));
  const pending = pendingTexts(keys, texts.map((text) => text ?? ""), cached);
  const plan: IngestPlan = {
    fetched: all.length,
    recalls: alerts.length,
    needModel: keys.filter(Boolean).length,
    cached: cached.size,
    calls: pending.size,
    estimatedCost: estimateCost([...pending.values()]),
  };
  if (!(await confirm(plan))) return null;
  const failed = await parsePending(pending, cached, log);

  const aliases = await loadBrandAliases();
  let dropped = 0;
  const recalls = alerts.map((alert, i) => {
    const key = keys[i];
    const output = key ? cached.get(key) : undefined;
    const details = output ? validateDetails(texts[i]!, output) : null;
    if (output && !details) dropped++;
    const brandNorm = alert.brand ? normalizeBrand(alert.brand, aliases) : null;
    return toRecall(alert, details, brandNorm);
  });
  await upsertRecalls(recalls);

  const perCategory = new Map<string, number>();
  const perYear = new Map<string, number>();
  for (const recall of recalls) {
    // "Autres - Hamac", "Autres - Barbecue"… are one category with a free-text detail.
    const category = recall.category?.replace(/^autres\b.*/i, "Autres") ?? "unknown";
    perCategory.set(category, (perCategory.get(category) ?? 0) + 1);
    perYear.set(recall.publishedAt.slice(0, 4), (perYear.get(recall.publishedAt.slice(0, 4)) ?? 0) + 1);
  }
  return { stored: recalls.length, failed, dropped, perCategory, perYear };
}
