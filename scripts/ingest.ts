import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { db } from "../src/lib/db/client";
import { ingestEnv } from "../src/lib/env";
import { sinceDate } from "../src/lib/ingest/dates";
import { ingestRappelConso, type IngestPlan } from "../src/lib/ingest/rappelconso";

const { values } = parseArgs({
  options: {
    since: { type: "string" },
    yes: { type: "boolean", default: false },
  },
});

const log = (message: string) => process.stdout.write(`${message}\n`);
const contact = ingestEnv().INGEST_CONTACT;
const userAgent = `tiko-recall-check/0.1${contact ? ` (${contact})` : ""}`;

async function confirm(plan: IngestPlan) {
  log(
    [
      `Rows fetched: ${plan.fetched}`,
      `Recalls: ${plan.recalls}`,
      `Need parsing: ${plan.needModel} (${plan.cached} already cached)`,
      `Model calls to make: ${plan.calls}`,
      `Estimated cost: about $${plan.estimatedCost.toFixed(2)}`,
    ].join("\n"),
  );
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
  const since = values.since ? sinceDate(values.since) : undefined;
  const result = await ingestRappelConso({ since, userAgent, confirm, log });
  if (result) {
    log(`Stored ${result.stored} recalls (${result.failed} parse failures, ${result.dropped} parses dropped by validation)`);
    for (const [category, total] of [...result.perCategory].sort((a, b) => b[1] - a[1])) {
      log(`  ${total}\t${category}`);
    }
  } else {
    log("Stopped before calling the model. Nothing was stored.");
  }
} finally {
  await db().$client.end();
}
