import { createHash } from "node:crypto";
import { eq, gte } from "drizzle-orm";
import { zodTextFormat } from "openai/helpers/zod";
import { parseCache, recalls, type Recall } from "../../db/schema";
import { UNIT_LIMIT_PROMPT, UNIT_LIMIT_PROMPT_VERSION } from "../ai/prompts";
import { unitLimitSchema, type UnitLimitOutput } from "../ai/schemas";
import { db } from "../db/client";
import { openai, openaiModel } from "../openai";
import { decodeEntities, normalizeText } from "../text";
import { mapWithConcurrency } from "./concurrency";
import { fieldsInput } from "./clean-fields";

// Only recalls that mention serial numbers or an attached list are worth a model call.
const HINT = /num[ée]ros? de s[ée]ries?|n° de s[ée]rie|serial|pi[èe]ces? jointes?|liste jointe|fichier joint|en annexe|liste (?:exhaustive )?des (?:produits|num)/i;
const PRICE_PER_CALL = 0.003;
const MAX_QUOTE = 240;
// The labels fieldsInput and unitLimitInput put before each line.
const LABEL = /^\s*(?:Identification|Informations|Modèles ou références|Description|Marque|Produit|Nom|Type ou modèle|Catégorie|Libellé) : /;

// The clean-fields input plus the identification and batch fields, where serial limits are written.
export function unitLimitInput(recall: Pick<Recall, "source" | "brand" | "productName" | "models" | "refs" | "category" | "raw">) {
  const raw = (recall.raw ?? {}) as Record<string, unknown>;
  const extra =
    recall.source === "rappelconso"
      ? [raw.identification_produits, raw.informations_complementaires, raw.conditionnements]
      : [raw.batchNumber, raw.productionDates];
  const lines = extra
    .flat()
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => `Identification : ${decodeEntities(value).replaceAll("¤", "; ")}`);
  return [fieldsInput(recall), ...lines].join("\n").slice(0, 3000);
}

const key = (text: string) => createHash("sha256").update(`unit-limit-${UNIT_LIMIT_PROMPT_VERSION}\n${openaiModel()}\n${text}`).digest("hex");

// The quote is kept only when it is in the input.
export function validateUnitLimit(text: string, output: UnitLimitOutput) {
  if (!output.limited || !output.quote) return null;
  const compact = (value: string) => normalizeText(value).replaceAll(" ", "");
  // The quote can span several input lines: keep their text, without our labels or the source's empty values.
  const lines = output.quote
    .split("\n")
    .map((line) => line.replace(LABEL, "").trim())
    .filter((line) => compact(line) !== "" && !/^non concern[ée]e?$/i.test(line) && compact(text).includes(compact(line)));
  const quote = lines.join("; ").replace(/:\s*;\s*/g, ": ");
  if (!quote) return null;
  return quote.length > MAX_QUOTE ? `${quote.slice(0, MAX_QUOTE).trimEnd()}…` : quote;
}

async function read(text: string, inputHash: string) {
  const [cached] = await db().select().from(parseCache).where(eq(parseCache.inputHash, inputHash));
  const parsed = cached && unitLimitSchema.safeParse(cached.result);
  if (parsed?.success) return parsed.data;
  const response = await openai().responses.parse({
    model: openaiModel(),
    instructions: UNIT_LIMIT_PROMPT,
    input: text,
    text: { format: zodTextFormat(unitLimitSchema, "unit_limit") },
  });
  const output = unitLimitSchema.parse(response.output_parsed);
  await db().insert(parseCache).values({ inputHash, result: output }).onConflictDoUpdate({ target: parseCache.inputHash, set: { result: output } });
  return output;
}

export type UnitLimitPlan = { recalls: number; estimatedCost: number };

// Reads the serial-number limits of recalls that mention one and changed since they were last read.
export async function readUnitLimits({
  updatedSince,
  confirm,
  log,
}: {
  updatedSince?: Date;
  confirm: (plan: UnitLimitPlan) => Promise<boolean>;
  log: (message: string) => void;
}) {
  const query = db().select().from(recalls);
  const rows = updatedSince ? await query.where(gte(recalls.updatedAt, updatedSince)) : await query;
  // A recall whose text no longer mentions a limit loses the one it had.
  const stale = rows.filter((recall) => recall.unitLimit !== null && !HINT.test(unitLimitInput(recall)));
  await mapWithConcurrency(stale, 8, (recall) => db().update(recalls).set({ unitLimit: null, unitLimitHash: null }).where(eq(recalls.id, recall.id)));
  const todo = rows.flatMap((recall) => {
    const text = unitLimitInput(recall);
    if (!HINT.test(text)) return [];
    const inputHash = key(text);
    return recall.unitLimitHash === inputHash ? [] : [{ id: recall.id, text, inputHash }];
  });
  if (!(await confirm({ recalls: todo.length, estimatedCost: todo.length * PRICE_PER_CALL }))) return null;

  let limited = 0;
  let failed = 0;
  await mapWithConcurrency(todo, 8, async ({ id, text, inputHash }) => {
    try {
      const unitLimit = validateUnitLimit(text, await read(text, inputHash));
      if (unitLimit) limited++;
      await db().update(recalls).set({ unitLimit, unitLimitHash: inputHash }).where(eq(recalls.id, id));
    } catch (error) {
      failed++;
      log(`Unit limit failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  return { read: todo.length, limited, failed };
}
