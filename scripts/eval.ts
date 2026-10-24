import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runCheck, type CheckResult } from "../src/lib/check/run";
import { db } from "../src/lib/db/client";
import { mapWithConcurrency } from "../src/lib/ingest/concurrency";
import { EVAL_DIR, PHOTOS_DIR, readListings, type EvalListing } from "../src/lib/eval/listings";
import { VERDICTS, mistake, reportMarkdown, score, withBaseline, type Outcome } from "../src/lib/eval/score";

const CONCURRENCY = 3;

const log = (message: string) => process.stdout.write(`${message}\n`);

async function check(listing: EvalListing) {
  const photos = await Promise.all(
    listing.photos.map(async (name) => new Uint8Array(await readFile(path.join(PHOTOS_DIR, name)))),
  );
  try {
    return await runCheck({ text: `${listing.title}\n${listing.description}`, photos });
  } catch (error) {
    log(`${listing.id}: check failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

const listings = await readListings();
const labelled = listings.filter((listing) => listing.expected !== null && !listing.excluded);
const excluded = listings.filter((listing) => listing.excluded).length;
const unlabelled = listings.length - labelled.length - excluded;
log(`Checking ${labelled.length} labelled listings (${excluded} excluded, ${unlabelled} not labelled)`);

const results = new Map<string, CheckResult | null>();
try {
  await mapWithConcurrency(labelled, CONCURRENCY, async (listing) => {
    const result = await check(listing);
    results.set(listing.id, result);
    log(`${String(results.size).padStart(3)}/${labelled.length} ${listing.id}: ${result?.verdict ?? "failed"}`);
  });
} finally {
  await db().$client.end();
}

const outcomes: Outcome[] = labelled.map((listing) => {
  const result = results.get(listing.id);
  return {
    id: listing.id,
    expected: listing.expected!,
    expectedRecallId: listing.expectedRecallId,
    verdict: result?.verdict ?? null,
    recallId: result?.recall?.id ?? null,
    alsoMatched: result?.alsoMatched ?? [],
  };
});
const result = score(outcomes);
const reportFile = path.join(EVAL_DIR, "report.md");
const previous = await readFile(reportFile, "utf8").catch(() => null);
const report = withBaseline(reportMarkdown(result, { excluded, unlabelled }, new Date().toISOString().slice(0, 10)), previous);
await writeFile(reportFile, report);
log(`\n${report}`);

// Locally only: what the pipeline read for each wrong case, to see why.
for (const outcome of result.wrong) {
  const check = results.get(outcome.id);
  if (!check) continue;
  const { brand, model, modelVariant, references, productionDate, batch } = check.extracted;
  log(`${outcome.id} (${mistake(outcome)}) · check ${check.id}`);
  log(`  read: ${[brand, model, modelVariant].filter(Boolean).join(" ") || "nothing"}${references.length ? ` · refs ${references.join(", ")}` : ""}${productionDate ? ` · made ${productionDate}` : ""}${batch ? ` · batch ${batch}` : ""}`);
  for (const item of check.evidence) log(`  ${item.matched ? "+" : "-"} ${item.fact}`);
  for (const note of check.notes) log(`  note: ${note}`);
}
log(`\nVerdicts: ${VERDICTS.map((verdict) => `${verdict} ${outcomes.filter((o) => o.verdict === verdict).length}`).join(", ")}`);
