import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { zodTextFormat } from "openai/helpers/zod";
import { parseCache } from "../../db/schema";
import { REASON_TRANSLATION_PROMPT, REASON_TRANSLATION_PROMPT_VERSION } from "../ai/prompts";
import { reasonTranslationSchema } from "../ai/schemas";
import { recordSpend, withinDailyBudget } from "../ai/spend";
import { db } from "../db/client";
import { openai, openaiModel } from "../openai";

const key = (reason: string) => createHash("sha256").update(`reason-en-${REASON_TRANSLATION_PROMPT_VERSION}\n${openaiModel()}\n${reason}`).digest("hex");

// A translation adds no figures: every number in the English has to be in the French.
export function keepsNumbers(french: string, english: string) {
  const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((value) => value.replace(",", "."));
  const official = new Set(numbers(french));
  return numbers(english).every((value) => official.has(value));
}

// The official reason in plain English, translated once and cached. Null when it can't be, so the page shows the French.
export async function reasonInEnglish(reason: string) {
  const inputHash = key(reason);
  const [cached] = await db().select().from(parseCache).where(eq(parseCache.inputHash, inputHash));
  const parsed = cached && reasonTranslationSchema.safeParse(cached.result);
  if (parsed?.success) return parsed.data.english;
  if (!(await withinDailyBudget())) return null;
  try {
    const response = await openai().responses.parse({
      model: openaiModel(),
      instructions: REASON_TRANSLATION_PROMPT,
      input: reason,
      text: { format: zodTextFormat(reasonTranslationSchema, "reason_translation") },
    });
    await recordSpend(response.usage);
    const output = reasonTranslationSchema.parse(response.output_parsed);
    if (!keepsNumbers(reason, output.english)) return null;
    await db().insert(parseCache).values({ inputHash, result: output }).onConflictDoUpdate({ target: parseCache.inputHash, set: { result: output } });
    return output.english;
  } catch {
    return null;
  }
}
