import { eq, sql } from "drizzle-orm";
import { dailySpend } from "../../db/schema";
import { db } from "../db/client";
import { openaiEnv } from "../env";

// $2 / $10 per million input / output tokens.
const INPUT_PRICE = 2 / 1_000_000;
const OUTPUT_PRICE = 10 / 1_000_000;

type Usage = { input_tokens?: number; output_tokens?: number } | undefined;

export function costOf(usage: Usage) {
  return (usage?.input_tokens ?? 0) * INPUT_PRICE + (usage?.output_tokens ?? 0) * OUTPUT_PRICE;
}

const today = () => new Date().toISOString().slice(0, 10);

// Adds a check's model call to today's spend.
export async function recordSpend(usage: Usage) {
  const cost = costOf(usage);
  if (cost === 0) return;
  await db()
    .insert(dailySpend)
    .values({ day: today(), costUsd: cost })
    .onConflictDoUpdate({ target: dailySpend.day, set: { costUsd: sql`${dailySpend.costUsd} + ${cost}` } });
}

// False once today's spend reaches OPENAI_DAILY_BUDGET_USD; always true without a budget.
export async function withinDailyBudget() {
  const budget = openaiEnv().OPENAI_DAILY_BUDGET_USD;
  if (budget === undefined) return true;
  const [row] = await db().select({ costUsd: dailySpend.costUsd }).from(dailySpend).where(eq(dailySpend.day, today()));
  return (row?.costUsd ?? 0) < budget;
}
