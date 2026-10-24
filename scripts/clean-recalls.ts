import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { db } from "../src/lib/db/client";
import { cleanRecalls, type FieldsPlan } from "../src/lib/ingest/clean-fields";

const { values } = parseArgs({
  options: {
    limit: { type: "string" },
    yes: { type: "boolean", default: false },
  },
});

const log = (message: string) => process.stdout.write(`${message}\n`);

async function confirm(plan: FieldsPlan) {
  log(`Recalls to read: ${plan.recalls} (${plan.cached} cached)\nModel calls: ${plan.calls}\nEstimated cost: about $${plan.estimatedCost.toFixed(2)}`);
  if (plan.calls === 0 || values.yes) return true;
  if (!process.stdin.isTTY) {
    log("Re-run with --yes to make these model calls.");
    return false;
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question("Continue? [y/N] ");
  prompt.close();
  return answer.trim().toLowerCase() === "y";
}

try {
  const result = await cleanRecalls({ limit: values.limit ? Number(values.limit) : undefined, confirm, log });
  if (result) {
    log(`Stored clean fields for ${result.stored} recalls (${result.failed} failed)`);
    if (result.calls) {
      log(`Tokens: ${result.inputTokens} in, ${result.outputTokens} out. Cost: $${result.cost.toFixed(2)}, $${(result.cost / result.calls).toFixed(5)} per recall`);
    }
  }
} finally {
  await db().$client.end();
}
