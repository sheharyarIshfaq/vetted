import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { db } from "../src/lib/db/client";
import { ingestEnv } from "../src/lib/env";
import { sinceDate } from "../src/lib/ingest/dates";
import { cleanRecalls } from "../src/lib/ingest/clean-fields";
import { embedRecalls } from "../src/lib/ingest/embed-recalls";
import { readUnitLimits } from "../src/lib/ingest/unit-limit";
import { ingestRappelConso, type IngestPlan } from "../src/lib/ingest/rappelconso";
import { ingestSafetyGate } from "../src/lib/ingest/safetygate";

const { values } = parseArgs({
  options: {
    since: { type: "string" },
    source: { type: "string", default: "all" },
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

function report(name: string, result: { stored: number; failed: number; dropped: number; perCategory: Map<string, number> } | null) {
  if (!result) {
    log(`${name}: stopped before calling the model. Nothing was stored.`);
    return;
  }
  log(`${name}: stored ${result.stored} recalls (${result.failed} parse failures, ${result.dropped} parses dropped by validation)`);
  for (const [category, total] of [...result.perCategory].sort((a, b) => b[1] - a[1])) {
    log(`  ${total}\t${category}`);
  }
}

const sources = values.source === "all" ? ["rappelconso", "safetygate"] : [values.source];
if (!sources.every((source) => source === "rappelconso" || source === "safetygate")) {
  throw new Error("--source must be rappelconso, safetygate or all");
}

const started = new Date();

try {
  const since = values.since ? sinceDate(values.since) : undefined;
  if (sources.includes("rappelconso")) {
    report("RappelConso", await ingestRappelConso({ since, userAgent, confirm, log }));
  }
  if (sources.includes("safetygate")) {
    const result = await ingestSafetyGate({ since, userAgent, confirm, log });
    report("Safety Gate", result);
    for (const [year, total] of [...(result?.perYear ?? [])].sort()) log(`  ${year}: ${total}`);
  }
  // Recalls stored by this run get their clean fields; older ones are read by pnpm recalls:clean.
  const cleaned = await cleanRecalls({
    updatedSince: started,
    confirm: (plan) => confirm({ fetched: plan.recalls, recalls: plan.recalls, needModel: plan.recalls, cached: plan.cached, calls: plan.calls, estimatedCost: plan.estimatedCost }),
    log,
  });
  log(cleaned ? `Clean fields: ${cleaned.stored} recalls (${cleaned.failed} failed, $${cleaned.cost.toFixed(2)})` : "Clean fields: skipped");
  const limits = await readUnitLimits({
    updatedSince: started,
    confirm: (plan) => confirm({ fetched: plan.recalls, recalls: plan.recalls, needModel: plan.recalls, cached: 0, calls: plan.recalls, estimatedCost: plan.estimatedCost }),
    log,
  });
  if (limits) log(`Serial-number limits: ${limits.limited} of ${limits.read} recalls read`);
  // Embeddings cost about $0.02 per million tokens, so they run without asking.
  const embedded = await embedRecalls({ updatedSince: started, confirm: async () => true, log });
  if (embedded) log(`Embeddings: ${embedded.stored} recalls ($${embedded.cost.toFixed(3)})`);
} finally {
  await db().$client.end();
}
