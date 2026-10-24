import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import { zodTextFormat } from "openai/helpers/zod";
import { parseCache, type ModelRange } from "../../db/schema";
import { RECALL_DETAILS_PROMPT, RECALL_DETAILS_PROMPT_VERSION } from "../ai/prompts";
import { recallDetailsSchema, type RecallDetailsOutput } from "../ai/schemas";
import { db } from "../db/client";
import { openai, openaiModel } from "../openai";
import { normalizeText } from "../text";
import { isIsoDate } from "./dates";

export type RecallDetails = {
  models: string[];
  refs: string[];
  batches: string[];
  productionFrom: string | null;
  productionTo: string | null;
  modelRanges: ModelRange[];
  quote: string | null;
};

const DATE_PATTERNS = [
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/, // 01/01/2022
  /\b\d{1,2}[/.-](19|20)\d{2}\b/, // 05/2020
  /\b(19|20)\d{2}-\d{2}(-\d{2})?\b/, // 2020-05
  /\b(janv|f[ée]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[ée]c)[a-zéû]*\.?\s+(19|20)\d{2}\b/i,
  /\b(semaine|week|wk|sem\.?)\s*\d{1,2}\b/i,
];

const CODE_PATTERNS = [
  /\b(lots?|batch|r[ée]f[ée]rences?|r[ée]f|codes?|n°|num[ée]ros? de s[ée]rie|serial)\b/i,
  /\b[a-z]{0,4}\d{4,}[a-z0-9-]*\b/i, // 4091054, b11437, 4000984-204346
];

// "All batches" means no batch limit, so it doesn't count as a batch.
const ALL_BATCHES = /\btou(?:s|tes) les (?:lots|r[ée]f[ée]rences|codes)\b/gi;

// Only text that mentions a date, a batch or a code is worth a model call.
export function needsModel(text: string) {
  const relevant = text.replace(ALL_BATCHES, " ");
  return [...DATE_PATTERNS, ...CODE_PATTERNS].some((pattern) => pattern.test(relevant));
}

export function cacheKey(text: string) {
  return createHash("sha256")
    .update(`${RECALL_DETAILS_PROMPT_VERSION}\n${openaiModel()}\n${text}`)
    .digest("hex");
}

// A value counts as written in the text if its normalised form appears there, with or without spaces.
function appearsIn(value: string, normalizedText: string, compactText: string) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return normalizedText.includes(normalized) || compactText.includes(normalized.replaceAll(" ", ""));
}

// "4000984-204346, -204377" gives the second reference as "-204377"; it takes the prefix of the one before.
export function expandRefShorthand(refs: string[]) {
  let prefix: string | null = null;
  const expanded = refs.map((ref) => {
    if (/^-[^-\s]+$/.test(ref)) return prefix ? prefix + ref.slice(1) : ref;
    prefix = /^(.+-)[^-]+$/.exec(ref)?.[1] ?? null;
    return ref;
  });
  return [...new Set(expanded)];
}

// "All production dates" for some models next to a date limit for others needs per-model ranges.
const ALL_DATES = /\btoutes (?:les )?dates\b/i;

function validRange(from: string | null, to: string | null) {
  if (from !== null && !isIsoDate(from)) return false;
  if (to !== null && !isIsoDate(to)) return false;
  return from === null || to === null || from <= to;
}

// Drops the whole result when a date is malformed or the quote is not an exact substring of the input,
// and drops single values that don't appear in the input.
export function validateDetails(text: string, output: RecallDetailsOutput): RecallDetails | null {
  const normalizedText = normalizeText(text);
  const compactText = normalizedText.replaceAll(" ", "");
  const keep = (values: string[]) =>
    [...new Set(values.map((value) => value.trim()))].filter((value) => appearsIn(value, normalizedText, compactText));

  const ranges = [{ from: output.productionFrom, to: output.productionTo }, ...output.modelRanges];
  if (!ranges.every((range) => validRange(range.from, range.to))) return null;

  const hasDates = ranges.some((range) => range.from !== null || range.to !== null);
  const quote = output.quote?.trim() || null;
  if (hasDates && (quote === null || !text.includes(quote))) return null;

  // Without per-model ranges, one flat limit would wrongly cover the models recalled for all dates; drop it.
  const flatDatesWrong = output.modelRanges.length === 0 && ALL_DATES.test(text);
  const productionFrom = flatDatesWrong ? null : output.productionFrom;
  const productionTo = flatDatesWrong ? null : output.productionTo;
  const modelRanges = output.modelRanges
    .filter((range) => appearsIn(range.model, normalizedText, compactText))
    .map((range) => ({
      ...range,
      model: range.model.trim(),
      refs: expandRefShorthand(keep(range.refs)),
      batches: keep(range.batches),
    }));
  const keptDates = productionFrom !== null || productionTo !== null || modelRanges.some((range) => range.from || range.to);

  return {
    models: keep(output.models),
    refs: expandRefShorthand(keep(output.references)),
    batches: keep(output.batches),
    productionFrom,
    productionTo,
    modelRanges,
    quote: keptDates ? quote : null,
  };
}

export async function readCachedDetails(keys: string[]) {
  const cached = new Map<string, RecallDetailsOutput>();
  for (let i = 0; i < keys.length; i += 1000) {
    const rows = await db()
      .select()
      .from(parseCache)
      .where(inArray(parseCache.inputHash, keys.slice(i, i + 1000)));
    for (const row of rows) {
      const parsed = recallDetailsSchema.safeParse(row.result);
      if (parsed.success) cached.set(row.inputHash, parsed.data);
    }
  }
  return cached;
}

export async function parseDetailsWithModel(text: string, key: string) {
  const response = await openai().responses.parse({
    model: openaiModel(),
    instructions: RECALL_DETAILS_PROMPT,
    input: text,
    text: { format: zodTextFormat(recallDetailsSchema, "recall_details") },
  });
  const output = recallDetailsSchema.parse(response.output_parsed);
  await db()
    .insert(parseCache)
    .values({ inputHash: key, result: output })
    .onConflictDoUpdate({ target: parseCache.inputHash, set: { result: output } });
  return { output, usage: response.usage };
}
