import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { runCheck } from "../src/lib/check/run";
import { db } from "../src/lib/db/client";

// Check latency on the evaluation listings that have three photos: text only, then with the photos.
// Each run is a real check (model calls included), one after another, so the times are what one user waits.

const { values } = parseArgs({ options: { runs: { type: "string", default: "12" } } });
const log = (message: string) => process.stdout.write(`${message}\n`);

type Listing = { id: string; title: string; description: string; photos: string[] };
const listings: Listing[] = JSON.parse(await readFile("content/eval/listings.json", "utf8"));
const chosen = listings.filter((listing) => listing.photos.length >= 3).slice(0, Number(values.runs));

const percentile = (times: number[], q: number) => [...times].sort((a, b) => a - b)[Math.min(times.length - 1, Math.floor(q * times.length))];

async function measure(label: string, withPhotos: boolean) {
  const times: number[] = [];
  const stages = new Map<string, number[]>();
  for (const listing of chosen) {
    const photos = withPhotos
      ? await Promise.all(listing.photos.slice(0, 3).map(async (name) => new Uint8Array(await readFile(path.join("content/eval/photos", name)))))
      : [];
    const started = performance.now();
    await runCheck({ text: `${listing.title}\n${listing.description}`, photos, cache: false }, (line) => {
      const stage = /^\[check\] (.+?)(?: \(\d+\))? (\d+)ms$/.exec(line);
      if (stage) stages.set(stage[1], [...(stages.get(stage[1]) ?? []), Number(stage[2])]);
    });
    times.push(performance.now() - started);
  }
  log(`\n${label}: ${times.length} checks, p50 ${(percentile(times, 0.5) / 1000).toFixed(1)}s, p95 ${(percentile(times, 0.95) / 1000).toFixed(1)}s`);
  for (const [stage, list] of stages) log(`  ${stage.padEnd(22)} p50 ${percentile(list, 0.5)}ms  p95 ${percentile(list, 0.95)}ms`);
}

try {
  await measure("Text only", false);
  await measure("Three photos", true);
} finally {
  await db().$client.end();
}
