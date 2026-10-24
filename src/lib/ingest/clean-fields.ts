import { createHash } from "node:crypto";
import { eq, gte, inArray } from "drizzle-orm";
import { zodTextFormat } from "openai/helpers/zod";
import { parseCache, recalls, type Recall } from "../../db/schema";
import { RECALL_FIELDS_PROMPT, RECALL_FIELDS_PROMPT_VERSION } from "../ai/prompts";
import { recallFieldsSchema, type RecallFieldsOutput } from "../ai/schemas";
import { loadBrandAliases } from "../db/brands";
import { db } from "../db/client";
import { openai, openaiModel } from "../openai";
import { decodeEntities, normalizeBrand, normalizeText } from "../text";
import { mapWithConcurrency } from "./concurrency";

export type CleanFields = {
  brandClean: string | null;
  brandCleanNorm: string | null;
  productType: string | null;
  modelName: string | null;
  codes: string[];
  specs: string[];
};

type Raw = Record<string, unknown>;
const field = (raw: Raw, key: string) => (typeof raw[key] === "string" ? decodeEntities(raw[key]).trim() : "");

const MAX_INPUT = 1500;

// The identification fields of a recall as labelled lines; the same recall always gives the same text.
export function fieldsInput(recall: Pick<Recall, "source" | "brand" | "productName" | "models" | "refs" | "category" | "raw">) {
  const raw = (recall.raw ?? {}) as Raw;
  const lines =
    recall.source === "rappelconso"
      ? [
          ["Marque", field(raw, "marque_produit") || recall.brand],
          ["Libellé", field(raw, "libelle") || recall.productName],
          ["Modèles ou références", field(raw, "modeles_ou_references").replaceAll("¤", "; ")],
          ["Catégorie", [field(raw, "categorie_produit"), field(raw, "sous_categorie_produit")].filter(Boolean).join(" / ")],
          ["Informations", field(raw, "informations_complementaires_publiques") || field(raw, "informations_complementaires")],
        ]
      : [
          ["Marque", field(raw, "brand") || recall.brand],
          ["Produit", field(raw, "product") || recall.productName],
          ["Nom", field(raw, "name")],
          ["Type ou modèle", field(raw, "type_numberOfModel")],
          ["Catégorie", field(raw, "category") || recall.category],
          ["Description", field(raw, "description")],
        ];
  return lines
    .filter(([, value]) => value)
    .map(([label, value]) => `${label} : ${decodeEntities(String(value))}`)
    .join("\n")
    .slice(0, MAX_INPUT);
}

export function fieldsKey(text: string) {
  return createHash("sha256").update(`fields-${RECALL_FIELDS_PROMPT_VERSION}\n${openaiModel()}\n${text}`).digest("hex");
}

const compact = (value: string) => normalizeText(value).replaceAll(" ", "");

// A value is kept only when its quote is in the input and the value is in its quote.
function backed(text: string, entry: { value: string; quote: string } | null, valueInQuote = true) {
  if (!entry?.value.trim() || !entry.quote.trim()) return null;
  const quote = compact(entry.quote);
  if (!quote || !compact(text).includes(quote)) return null;
  if (valueInQuote && !quote.includes(compact(entry.value))) return null;
  return entry.value.trim();
}

const GTIN = /^\d{8,14}$/;

export function validateFields(
  text: string,
  output: RecallFieldsOutput,
  sourceBrand: string | null,
  aliases: ReadonlyMap<string, string>,
): CleanFields {
  // The brand field wins when it holds a real brand; the model only fills a missing one.
  const fieldBrand = sourceBrand && normalizeBrand(decodeEntities(sourceBrand), aliases) ? decodeEntities(sourceBrand).trim() : null;
  const readBrand = backed(text, output.brand);
  const brandClean = fieldBrand ?? (readBrand && normalizeBrand(readBrand, aliases) ? readBrand : null);
  const unique = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))];
  return {
    brandClean,
    brandCleanNorm: brandClean ? normalizeBrand(brandClean, aliases) : null,
    productType: backed(text, output.productType, false) ? output.productType!.value : null,
    modelName: backed(text, output.modelName),
    codes: unique(output.refs.map((ref) => backed(text, ref))).filter((code) => /\d/.test(code) && !GTIN.test(code.replace(/\s/g, ""))),
    specs: unique(output.specs.map((spec) => backed(text, spec))),
  };
}

// $2 / $10 per million input / output tokens; the prompt is about 450 tokens and an answer about 120.
const INPUT_PRICE = 2 / 1_000_000;
const OUTPUT_PRICE = 10 / 1_000_000;

export function estimateFieldsCost(texts: string[]) {
  return texts.reduce((sum, text) => sum + (450 + Math.ceil(text.length / 4)) * INPUT_PRICE + 120 * OUTPUT_PRICE, 0);
}

async function readCache(keys: string[]) {
  const cached = new Map<string, RecallFieldsOutput>();
  for (let i = 0; i < keys.length; i += 1000) {
    const rows = await db().select().from(parseCache).where(inArray(parseCache.inputHash, keys.slice(i, i + 1000)));
    for (const row of rows) {
      const parsed = recallFieldsSchema.safeParse(row.result);
      if (parsed.success) cached.set(row.inputHash, parsed.data);
    }
  }
  return cached;
}

async function readWithModel(text: string, key: string) {
  const response = await openai().responses.parse({
    model: openaiModel(),
    instructions: RECALL_FIELDS_PROMPT,
    input: text,
    text: { format: zodTextFormat(recallFieldsSchema, "recall_fields") },
  });
  const output = recallFieldsSchema.parse(response.output_parsed);
  await db()
    .insert(parseCache)
    .values({ inputHash: key, result: output })
    .onConflictDoUpdate({ target: parseCache.inputHash, set: { result: output } });
  return { output, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
}

export type FieldsPlan = { recalls: number; cached: number; calls: number; estimatedCost: number };

const CONCURRENCY = 8;

// Reads the clean fields of recalls whose input changed; cached answers cost nothing.
export async function cleanRecalls({
  updatedSince,
  limit,
  confirm,
  log,
}: {
  updatedSince?: Date; // only recalls stored or updated since then, as an ingestion run does
  limit?: number;
  confirm: (plan: FieldsPlan) => Promise<boolean>;
  log: (message: string) => void;
}) {
  const query = db().select().from(recalls);
  const rows = updatedSince ? await query.where(gte(recalls.updatedAt, updatedSince)) : await query.orderBy(recalls.id);
  const inputs = rows.map((recall) => {
    const text = fieldsInput(recall);
    return { recall, text, key: fieldsKey(text) };
  });
  const stale = inputs.filter((input) => input.recall.cleanHash !== input.key);
  const todo = limit ? sample(stale, limit) : stale;
  const cached = await readCache(todo.map((input) => input.key));
  const pending = todo.filter((input) => !cached.has(input.key));
  const plan = { recalls: todo.length, cached: todo.length - pending.length, calls: pending.length, estimatedCost: estimateFieldsCost(pending.map((input) => input.text)) };
  if (!(await confirm(plan))) return null;

  let inputTokens = 0;
  let outputTokens = 0;
  let failed = 0;
  let done = 0;
  await mapWithConcurrency(pending, CONCURRENCY, async ({ text, key }) => {
    try {
      const result = await readWithModel(text, key);
      cached.set(key, result.output);
      inputTokens += result.inputTokens;
      outputTokens += result.outputTokens;
    } catch (error) {
      failed++;
      log(`Read failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (++done % 100 === 0) log(`Read ${done}/${pending.length}`);
  });

  const aliases = await loadBrandAliases();
  const fields = todo.flatMap(({ recall, text, key }) => {
    const output = cached.get(key);
    return output ? [{ id: recall.id, key, ...validateFields(text, output, recall.brand, aliases) }] : [];
  });
  await mapWithConcurrency(fields, CONCURRENCY, ({ id, key, ...clean }) =>
    db().update(recalls).set({ ...clean, cleanHash: key }).where(eq(recalls.id, id)),
  );
  const cost = inputTokens * INPUT_PRICE + outputTokens * OUTPUT_PRICE;
  return { stored: fields.length, failed, calls: pending.length, inputTokens, outputTokens, cost };
}

// An even spread over the list, so a sample covers both sources and every period.
function sample<T>(items: T[], size: number) {
  if (items.length <= size) return items;
  const step = items.length / size;
  return Array.from({ length: size }, (_, i) => items[Math.floor(i * step)]);
}
