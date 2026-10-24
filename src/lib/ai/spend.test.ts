import { describe, expect, it, vi } from "vitest";

const spent = { value: 0 };
const budget = { value: undefined as number | undefined };
vi.mock("../db/client", () => ({
  db: () => ({ select: () => ({ from: () => ({ where: async () => (spent.value ? [{ costUsd: spent.value }] : []) }) }) }),
}));
vi.mock("../env", () => ({ openaiEnv: () => ({ OPENAI_DAILY_BUDGET_USD: budget.value }) }));

const { costOf, withinDailyBudget } = await import("./spend");

describe("spend", () => {
  it("prices a call from its tokens", () => {
    expect(costOf({ input_tokens: 1_000_000, output_tokens: 100_000 })).toBeCloseTo(3);
    expect(costOf(undefined)).toBe(0);
  });

  it("has no cap without a budget", async () => {
    budget.value = undefined;
    spent.value = 1000;
    expect(await withinDailyBudget()).toBe(true);
  });

  it("stops at the budget", async () => {
    budget.value = 20;
    spent.value = 19.9;
    expect(await withinDailyBudget()).toBe(true);
    spent.value = 20;
    expect(await withinDailyBudget()).toBe(false);
  });
});
