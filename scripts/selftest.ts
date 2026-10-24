import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { asc, isNotNull } from "drizzle-orm";
import { zodTextFormat } from "openai/helpers/zod";
import sharp from "sharp";
import { recalls, type Recall } from "../src/db/schema";
import { embed } from "../src/lib/ai/embeddings";
import { SELFTEST_LISTING_PROMPT } from "../src/lib/ai/prompts";
import { syntheticListingSchema } from "../src/lib/ai/schemas";
import { compactCode, findCandidates, type RankedRecall, type Route } from "../src/lib/check/candidates";
import { compareWithRecall } from "../src/lib/check/compare";
import { extractListing } from "../src/lib/check/extract";
import { downloadImage } from "../src/lib/check/images";
import { nearestRecalls } from "../src/lib/check/semantic";
import { loadBrandAliases } from "../src/lib/db/brands";
import { db } from "../src/lib/db/client";
import { mapWithConcurrency } from "../src/lib/ingest/concurrency";
import { listingEmbeddingText, matchListing } from "../src/lib/check/run";
import { openai, openaiModel } from "../src/lib/openai";
import { isSpecificType } from "../src/lib/product-type";
import { normalizeBrand, normalizeModelText } from "../src/lib/text";
import { decideBest, type ItemFacts } from "../src/lib/verdict";

// Synthetic listings built from the recalls themselves: listings that name a recall must be flagged,
// near misses (another model of the brand, the model under another brand) must not.
// Results go to .cache/selftest/, never to the evaluation report.

const { values } = parseArgs({
  options: {
    size: { type: "string", default: "600" },
    photos: { type: "string", default: "20" },
    seed: { type: "string", default: "1" },
    full: { type: "string", default: "150" }, // listings written as sellers would and read by the model
    yes: { type: "boolean", default: false },
  },
});
const log = (message: string) => process.stdout.write(`${message}\n`);

type Kind = "model" | "code" | "barcode" | "brand_type" | "other_model" | "other_brand";
const FLAGGED: Kind[] = ["model", "code", "barcode", "brand_type"];
// A listing naming a recall must not come out clear; a near miss must.
const isWrong = (kind: Kind, verdict: string) => (FLAGGED.includes(kind) ? verdict === "clear" : verdict !== "clear");

type Case = { kind: Kind; recall: Recall; item: ItemFacts };
type Outcome = Case & {
  verdict: string;
  matchedId: string | null;
  firstFact: string | null;
  targetRank: number | null;
  targetRoutes: Route[];
  candidates: number;
  semantic: { similarity: number; rank: number } | null; // the target's place in a plain nearest-neighbour search
};

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = random(Number(values.seed));
const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)];
const shuffle = <T>(items: T[]) => items.map((item) => [rand(), item] as const).sort((a, b) => a[0] - b[0]).map(([, item]) => item);

const brandOf = (recall: Recall) => recall.brandClean ?? recall.brand;
const brandNormOf = (recall: Recall) => recall.brandCleanNorm ?? recall.brandNorm;

// Even coverage of every source and product type, with at least a few of each.
function stratify(all: Recall[], size: number) {
  const strata = new Map<string, Recall[]>();
  for (const recall of all) {
    const key = `${recall.source}/${recall.productType ?? "untyped"}`;
    strata.set(key, [...(strata.get(key) ?? []), recall]);
  }
  return [...strata.values()].flatMap((group) => shuffle(group).slice(0, Math.max(3, Math.round((group.length / all.length) * size))));
}

function listing(recall: Recall, fields: Partial<ItemFacts>, aliases: ReadonlyMap<string, string>): ItemFacts {
  const brand = fields.brand === undefined ? brandOf(recall) : fields.brand;
  const item: ItemFacts = {
    brand,
    brandNorm: brand ? normalizeBrand(brand, aliases) : null,
    model: null,
    modelVariant: null,
    references: [],
    gtin: null,
    batch: null,
    productionDate: null,
    category: recall.productType,
    productType: recall.productType,
    ...fields,
  };
  item.title = [item.brand, item.model, item.references[0], recall.productType].filter(Boolean).join(" ");
  return item;
}

// Another model name: the digits shifted ("V8" -> "V9"), or the model of a recall of the same type from another brand.
function otherModel(model: string, recall: Recall, byType: Map<string, Recall[]>, brandModels: Set<string>) {
  const shifted = model.replace(/\d+(?!.*\d)/, (digits) => String(Number(digits) + 1));
  if (shifted !== model && !brandModels.has(normalizeModelText(shifted))) return shifted;
  const others = (byType.get(recall.productType ?? "") ?? []).flatMap((other) =>
    brandNormOf(other) !== brandNormOf(recall) ? other.modelNames : [],
  );
  const candidates = others.filter((name) => !brandModels.has(normalizeModelText(name)) && normalizeModelText(name).length >= 3);
  return candidates.length ? pick(candidates) : null;
}

function buildCases(sample: Recall[], all: Recall[], aliases: ReadonlyMap<string, string>) {
  const byType = new Map<string, Recall[]>();
  const modelsByBrand = new Map<string, Set<string>>();
  for (const recall of all) {
    byType.set(recall.productType ?? "", [...(byType.get(recall.productType ?? "") ?? []), recall]);
    const brand = brandNormOf(recall);
    if (!brand) continue;
    const models = modelsByBrand.get(brand) ?? new Set<string>();
    for (const name of [...recall.modelNames, ...recall.codes, ...recall.models, ...recall.refs]) models.add(normalizeModelText(name));
    modelsByBrand.set(brand, models);
  }
  // Real brands of this type with no recall of this model.
  const brandsByType = (type: string | null, except: string, model: string) =>
    [...new Set((byType.get(type ?? "") ?? []).map(brandOf).filter((brand): brand is string => Boolean(brand)))].filter((brand) => {
      const norm = normalizeBrand(brand, aliases);
      return norm !== null && norm !== except && !modelsByBrand.get(norm)?.has(normalizeModelText(model));
    });

  const cases: Case[] = [];
  for (const recall of sample) {
    const brand = brandNormOf(recall);
    const model = recall.modelNames.length ? pick(recall.modelNames) : null;
    const code = recall.codes.length ? pick(recall.codes) : null;
    if (recall.gtins.length) cases.push({ kind: "barcode", recall, item: listing(recall, { gtin: pick(recall.gtins) }, aliases) });
    if (!brand) continue;
    if (model) cases.push({ kind: "model", recall, item: listing(recall, { model }, aliases) });
    if (code) cases.push({ kind: "code", recall, item: listing(recall, { references: [code] }, aliases) });
    if (isSpecificType(recall.productType)) cases.push({ kind: "brand_type", recall, item: listing(recall, {}, aliases) });
    if (model) {
      const other = otherModel(model, recall, byType, modelsByBrand.get(brand) ?? new Set());
      if (other) cases.push({ kind: "other_model", recall, item: listing(recall, { model: other }, aliases) });
      // Another real brand, so a flag can only come from the model name.
      const otherBrands = brandsByType(recall.productType, brand, model);
      if (otherBrands.length) cases.push({ kind: "other_brand", recall, item: listing(recall, { brand: pick(otherBrands), model }, aliases) });
    }
  }
  return cases;
}

async function run(testCase: Case): Promise<Outcome> {
  const { item, recall } = testCase;
  const embeddingText = listingEmbeddingText({ ...item, category: item.category ?? null }, item.title ?? null);
  const ranked: RankedRecall[] = await findCandidates({
    brandNorm: item.brandNorm,
    model: item.model,
    gtin: item.gtin,
    codes: item.references,
    productType: item.productType ?? null,
    searchText: item.title ?? "",
    embeddingText,
  });
  const result = decideBest({ item, candidates: ranked, photos: new Map() });
  const index = ranked.findIndex((candidate) => candidate.recall.id === recall.id);
  let semantic: Outcome["semantic"] = null;
  if (embeddingText) {
    const { vectors } = await embed([embeddingText]);
    const nearest = await nearestRecalls(vectors[0], 200);
    const at = nearest.findIndex((hit) => hit.id === recall.id);
    semantic = { similarity: at === -1 ? 0 : nearest[at].similarity, rank: at };
  }
  return {
    ...testCase,
    verdict: result.verdict,
    matchedId: result.recall?.id ?? null,
    firstFact: result.evidence[0]?.fact ?? null,
    targetRank: index === -1 ? null : index,
    targetRoutes: index === -1 ? [] : ranked[index].routes,
    candidates: ranked.length,
    semantic,
  };
}

const percent = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : "-");
const pad = (value: string | number, width: number) => String(value).padEnd(width);

function report(outcomes: Outcome[]) {
  const flagged = outcomes.filter((outcome) => FLAGGED.includes(outcome.kind));
  const near = outcomes.filter((outcome) => !FLAGGED.includes(outcome.kind));
  const missed = flagged.filter((outcome) => isWrong(outcome.kind, outcome.verdict));
  const falseFlags = near.filter((outcome) => isWrong(outcome.kind, outcome.verdict));

  log(`\n${outcomes.length} synthetic listings from ${new Set(outcomes.map((o) => o.recall.id)).size} recalls`);
  log(`Misses: ${missed.length}/${flagged.length} (${percent(missed.length, flagged.length)})`);
  log(`False flags: ${falseFlags.length}/${near.length} (${percent(falseFlags.length, near.length)})\n`);

  log(`${pad("Listing", 14)}${pad("Cases", 8)}${pad("Wrong", 8)}Rate`);
  for (const kind of [...FLAGGED, "other_model", "other_brand"] as Kind[]) {
    const all = outcomes.filter((outcome) => outcome.kind === kind);
    const wrong = all.filter((outcome) => isWrong(kind, outcome.verdict));
    log(`${pad(kind, 14)}${pad(all.length, 8)}${pad(wrong.length, 8)}${percent(wrong.length, all.length)}`);
  }

  log(`\n${pad("Product type", 22)}${pad("Flagged", 9)}${pad("Missed", 8)}${pad("Near", 7)}${pad("False", 7)}`);
  const types = [...new Set(outcomes.map((outcome) => outcome.recall.productType ?? "untyped"))].sort();
  for (const type of types) {
    const of = (list: Outcome[]) => list.filter((outcome) => (outcome.recall.productType ?? "untyped") === type);
    const [f, m, n, x] = [of(flagged), of(missed), of(near), of(falseFlags)];
    if (m.length || x.length || f.length >= 10)
      log(`${pad(type, 22)}${pad(f.length, 9)}${pad(`${m.length} ${percent(m.length, f.length)}`, 8)}${pad(n.length, 7)}${x.length} ${percent(x.length, n.length)}`);
  }

  // Which route found the right recall, and what each route alone would have missed.
  const found = flagged.filter((outcome) => outcome.targetRank !== null);
  log(`\nRight recall among the candidates: ${found.length}/${flagged.length} (${percent(found.length, flagged.length)})`);
  log(`${pad("Route", 14)}${pad("Found", 8)}Only route`);
  for (const route of ["barcode", "code", "brand_model", "brand_title", "type_model", "title", "semantic"] as Route[]) {
    const by = found.filter((outcome) => outcome.targetRoutes.includes(route));
    const only = by.filter((outcome) => outcome.targetRoutes.length === 1);
    log(`${pad(route, 14)}${pad(`${by.length} ${percent(by.length, found.length)}`, 8)}  ${only.length}`);
  }

  // Similarity of the right recall in a plain nearest-neighbour search, to set the semantic threshold.
  const similarities = flagged.flatMap((outcome) => (outcome.semantic && outcome.semantic.rank !== -1 ? [outcome.semantic.similarity] : [])).sort((a, b) => a - b);
  const at = (q: number) => similarities[Math.floor(q * (similarities.length - 1))]?.toFixed(3) ?? "-";
  const top20 = flagged.filter((outcome) => outcome.semantic && outcome.semantic.rank !== -1 && outcome.semantic.rank < 20).length;
  log(`\nSemantic: right recall in the nearest 20 for ${top20}/${flagged.length}; similarity p1 ${at(0.01)}, p5 ${at(0.05)}, p25 ${at(0.25)}, median ${at(0.5)}`);

  const patterns = new Map<string, Outcome[]>();
  for (const outcome of [...missed, ...falseFlags]) {
    const reason =
      outcome.targetRank === null && FLAGGED.includes(outcome.kind)
        ? "right recall not among the candidates"
        : (outcome.firstFact ?? "no evidence").replace(/\d[\w./-]*/g, "#").replace(/".*?"/g, '"…"').slice(0, 90);
    const key = `${outcome.kind}: ${reason}`;
    patterns.set(key, [...(patterns.get(key) ?? []), outcome]);
  }
  log("\nFailure patterns:");
  for (const [key, list] of [...patterns].sort((a, b) => b[1].length - a[1].length).slice(0, 25)) {
    const example = list[0];
    log(`  ${pad(list.length, 4)}${key}`);
    log(`        e.g. ${example.recall.id} "${example.item.title}" -> ${example.verdict}${example.matchedId && example.matchedId !== example.recall.id ? ` (${example.matchedId})` : ""}`);
  }
}

// The official photo against itself must say yes, against another recall of the same type no,
// and a thumbnail under 200px must never say no.
async function photoTests(sample: Recall[], all: Recall[], count: number) {
  if (count === 0) return [];
  const withImages = shuffle(sample.filter((recall) => recall.images.length > 0 && recall.productType && recall.productType !== "other"));
  const results: { test: string; recall: string; other: string | null; answer: string | null }[] = [];
  for (const recall of withImages) {
    if (results.length >= count * 3) break;
    const other = shuffle(all.filter((candidate) => candidate.productType === recall.productType && candidate.id !== recall.id && candidate.images.length > 0))[0];
    const own = await downloadImage(recall.images[0], { timeoutMs: 8000 });
    if (!own || !other) continue;
    const otherOnly = { ...other, images: other.images.slice(0, 1) };
    const tiny = await sharp(own).resize(150, 150, { fit: "inside" }).jpeg().toBuffer();
    const [self, different, thumbnail] = await Promise.all([
      compareWithRecall([own], { ...recall, images: recall.images.slice(0, 1) }),
      compareWithRecall([own], otherOnly),
      compareWithRecall([tiny], otherOnly),
    ]);
    if (different.sameProduct === null) continue;
    results.push(
      { test: "same photo", recall: recall.id, other: null, answer: self.sameProduct },
      { test: "other recall, same type", recall: recall.id, other: other.id, answer: different.sameProduct },
      { test: "thumbnail vs other recall", recall: recall.id, other: other.id, answer: thumbnail.sameProduct },
    );
  }
  const expected: Record<string, (answer: string | null) => boolean> = {
    "same photo": (answer) => answer === "yes",
    "other recall, same type": (answer) => answer === "no",
    "thumbnail vs other recall": (answer) => answer !== "no",
  };
  log("\nPhoto comparison:");
  for (const test of Object.keys(expected)) {
    const of = results.filter((result) => result.test === test);
    const right = of.filter((result) => expected[test](result.answer));
    const answers = Object.entries(Object.groupBy(of, (result) => result.answer ?? "none")).map(([answer, list]) => `${answer} ${list?.length}`);
    log(`  ${pad(test, 28)}${right.length}/${of.length} right (${answers.join(", ")})`);
  }
  return results;
}

// Every model call is counted, so the run reports what it really cost ($2 / $10 per million tokens in / out).
const usage = { calls: 0, input: 0, output: 0 };
const cost = () => (usage.input * 2 + usage.output * 10) / 1_000_000;
const responses = openai().responses;
const parse = responses.parse.bind(responses);
responses.parse = (async (...args: Parameters<typeof parse>) => {
  const response = await parse(...args);
  usage.calls++;
  usage.input += response.usage?.input_tokens ?? 0;
  usage.output += response.usage?.output_tokens ?? 0;
  return response;
}) as typeof parse;

// Real listings checked by hand, read and matched like any check. Each states the verdict the official notice supports.
const FIXED: { text: string; recall: string; expected: "recalled" | "check_label" | "clear" }[] = [
  { text: "Dualtron Mini Spécial", recall: "rc:14786", expected: "check_label" }, // 52V 13Ah only, units listed in an attachment
  { text: "Speedtrott XT800", recall: "rc:16725", expected: "check_label" }, // XT800 V1 and V2, serial numbers starting with given prefixes
  { text: "Kaabo Mantis", recall: "rc:2896", expected: "check_label" }, // nine named Mantis versions, not every Mantis
  { text: "VSETT 10+ 60V 28Ah", recall: "rc:13303", expected: "check_label" }, // a range of 70 serial numbers
  { text: "Smyths Toys Giro Drive SDrive 250W", recall: "rc:11386", expected: "recalled" }, // all batches
  { text: "Acer ES Series 5", recall: "rc:21110", expected: "recalled" }, // all batches
  { text: "Hoverboard Tilgreen", recall: "rc:18131", expected: "check_label" }, // leboncoin 3233036357: the recall is for the Tilboard only
  { text: "TilBoard", recall: "rc:18131", expected: "check_label" }, // leboncoin 3254725719: no brand, a model only Tilgreen uses
];

async function fixedCases(aliases: ReadonlyMap<string, string>) {
  log("\nFixed real cases:");
  const results = [];
  for (const fixed of FIXED) {
    const extracted = await extractListing(fixed.text, []);
    const { ranked, result } = await matchListing({ extracted, title: fixed.text, photos: [], aliases });
    const found = ranked.find((candidate) => candidate.recall.id === fixed.recall);
    const right = result.verdict === fixed.expected && (fixed.expected === "clear" || result.recall?.id === fixed.recall);
    log(`  ${right ? "ok  " : "FAIL"} ${pad(`"${fixed.text}"`, 38)}${pad(result.verdict, 12)}${result.recall?.id ?? "-"} (expected ${fixed.expected} ${fixed.recall})`);
    log(`       read: ${[extracted.brand, extracted.model, extracted.modelVariant, extracted.productType].filter(Boolean).join(" · ")}; routes: ${found?.routes.join(", ") ?? "not found"}`);
    for (const fact of result.evidence.slice(0, 3)) log(`       ${fact.matched ? "+" : "-"} ${fact.fact}`);
    results.push({ ...fixed, verdict: result.verdict, matchedId: result.recall?.id ?? null, right, evidence: result.evidence });
  }
  return results;
}

// How sellers write: mostly French, some German and Spanish as on Vinted, a few in English.
const LANGUAGES = [
  ["French", 0.6],
  ["German", 0.15],
  ["Spanish", 0.15],
  ["English", 0.1],
] as const;
const FULL_MIX: [Kind, number][] = [
  ["model", 0.34],
  ["code", 0.16],
  ["brand_type", 0.16],
  ["other_model", 0.17],
  ["other_brand", 0.17],
];
const LISTINGS_FILE = ".cache/selftest/listings.json";
// Measured per listing: writing it about $0.003, reading it about $0.006.
const COST_PER_WRITE = 0.003;
const COST_PER_READ = 0.006;

type Written = { language: string; typos: boolean; title: string; description: string };

function language() {
  let at = rand();
  for (const [name, share] of LANGUAGES) {
    if ((at -= share) < 0) return name;
  }
  return "French";
}

async function writeListing(testCase: Case): Promise<Written> {
  const { item, recall } = testCase;
  const facts = {
    language: language(),
    typos: rand() < 0.5,
    brand: item.brand,
    product: recall.productType && recall.productType !== "other" ? recall.productType : recall.productName,
    model: item.model,
    code: item.references[0] ?? null,
    specs: recall.specs,
  };
  const response = await openai().responses.parse({
    model: openaiModel(),
    instructions: SELFTEST_LISTING_PROMPT,
    input: JSON.stringify(facts),
    text: { format: zodTextFormat(syntheticListingSchema, "listing") },
  });
  const written = syntheticListingSchema.parse(response.output_parsed);
  return { language: facts.language, typos: facts.typos, ...written };
}

// The listing must carry the facts it was written from (typos aside), or a miss would test the writer, not the reader.
function faithful(testCase: Case, written: Written) {
  const text = compactCode(`${written.title} ${written.description}`);
  const facts = [testCase.item.brand, testCase.item.model, testCase.item.references[0]].filter((fact): fact is string => Boolean(fact));
  return facts.every((fact) => text.includes(compactCode(fact)));
}

const caseKey = (testCase: Case) =>
  [testCase.recall.id, testCase.kind, testCase.item.brand, testCase.item.model, testCase.item.references[0]].join("|");

// What reading the listing lost, compared with the facts it was written from.
function readingLoss(item: ItemFacts, read: { brandNorm: string | null; model: string | null; references: string[]; productType: string | null }) {
  const lost: string[] = [];
  if (item.brandNorm && read.brandNorm !== item.brandNorm) lost.push(`brand read as ${read.brandNorm ?? "none"}`);
  const code = (value: string | null) => compactCode(value ?? "");
  const readCodes = [read.model, ...read.references].map(code).filter(Boolean);
  if (item.model && !readCodes.some((value) => value.includes(code(item.model)) || code(item.model).includes(value)))
    lost.push(`model read as ${read.model ?? "none"}`);
  if (item.references[0] && !readCodes.some((value) => value.includes(code(item.references[0]))))
    lost.push(`code read as ${read.references.join(", ") || "none"}`);
  if (item.productType && item.productType !== "other" && read.productType !== item.productType)
    lost.push(`type read as ${read.productType ?? "none"}`);
  return lost;
}

async function fullPipeline(cases: Case[], direct: Outcome[], aliases: ReadonlyMap<string, string>, size: number) {
  if (size === 0) return [];
  // Sorted by key and drawn from its own seed, so the same listings come back while the rules change.
  const draw = random(Number(values.seed) + 1);
  const chosen = FULL_MIX.flatMap(([kind, share]) =>
    cases
      .filter((testCase) => testCase.kind === kind)
      .map((testCase) => [caseKey(testCase), testCase] as const)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, testCase]) => [draw(), key, testCase] as const)
      .sort(([a], [b]) => a - b)
      .slice(0, Math.round(share * size))
      .map(([, , testCase]) => testCase),
  );
  const saved: Record<string, Written> = JSON.parse(await readFile(LISTINGS_FILE, "utf8").catch(() => "{}"));
  const toWrite = chosen.filter((testCase) => !saved[caseKey(testCase)] || !faithful(testCase, saved[caseKey(testCase)]));
  const estimate = toWrite.length * COST_PER_WRITE + chosen.length * COST_PER_READ;
  log(`\nFull pipeline: ${chosen.length} listings (${toWrite.length} to write), about $${estimate.toFixed(2)}`);
  if (estimate > 2 && !values.yes) {
    log("Over $2: re-run with --yes to go ahead.");
    return [];
  }

  await mapWithConcurrency(toWrite, 8, async (testCase) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      saved[caseKey(testCase)] = await writeListing(testCase);
      if (faithful(testCase, saved[caseKey(testCase)])) break;
    }
  });
  const usable = chosen.filter((testCase) => faithful(testCase, saved[caseKey(testCase)]));
  log(`Left out ${chosen.length - usable.length} listings that dropped a fact they were given`);
  await mkdir(".cache/selftest", { recursive: true });
  await writeFile(LISTINGS_FILE, JSON.stringify(saved, null, 2));

  const directByCase = new Map(direct.map((outcome) => [caseKey(outcome), outcome]));
  const results = await mapWithConcurrency(usable, 8, async (testCase) => {
    const written = saved[caseKey(testCase)];
    const text = `${written.title}\n${written.description}`;
    const extracted = await extractListing(text, []);
    const { brandNorm, ranked, result } = await matchListing({ extracted, title: written.title, photos: [], aliases });
    const read = { brandNorm, model: [extracted.model, extracted.modelVariant].filter(Boolean).join(" ") || null, references: extracted.references, productType: extracted.productType ?? null };
    const wrong = isWrong(testCase.kind, result.verdict);
    const directVerdict = directByCase.get(caseKey(testCase))?.verdict;
    const directWrong = directVerdict !== undefined && isWrong(testCase.kind, directVerdict);
    const lost = readingLoss(testCase.item, read);
    const cause = !wrong ? null : directWrong ? "matching (direct run fails too)" : lost.length ? "reading" : "matching (wording)";
    return {
      recall: testCase.recall.id,
      kind: testCase.kind,
      given: { brand: testCase.item.brand, model: testCase.item.model, code: testCase.item.references[0] ?? null },
      language: written.language,
      typos: written.typos,
      text,
      read,
      verdict: result.verdict,
      matchedId: result.recall?.id ?? null,
      targetFound: ranked.some((candidate) => candidate.recall.id === testCase.recall.id),
      firstFact: result.evidence[0]?.fact ?? null,
      wrong,
      cause,
      lost,
    };
  });

  const flagged = results.filter((result) => FLAGGED.includes(result.kind));
  const near = results.filter((result) => !FLAGGED.includes(result.kind));
  const count = (list: typeof results) => list.filter((result) => result.wrong).length;
  log(`Misses: ${count(flagged)}/${flagged.length} (${percent(count(flagged), flagged.length)})`);
  log(`False flags: ${count(near)}/${near.length} (${percent(count(near), near.length)})\n`);
  log(`${pad("Listing", 14)}${pad("Cases", 8)}${pad("Wrong", 8)}Rate`);
  for (const [kind] of FULL_MIX) {
    const of = results.filter((result) => result.kind === kind);
    log(`${pad(kind, 14)}${pad(of.length, 8)}${pad(count(of), 8)}${percent(count(of), of.length)}`);
  }
  log(`\n${pad("Language", 14)}${pad("Cases", 8)}Wrong`);
  for (const [name] of LANGUAGES) {
    const of = results.filter((result) => result.language === name);
    log(`${pad(name, 14)}${pad(of.length, 8)}${count(of)}`);
  }
  log("\nCause of each wrong verdict:");
  for (const [cause, list] of Object.entries(Object.groupBy(results.filter((result) => result.wrong), (result) => result.cause!))) {
    log(`  ${pad(list!.length, 4)}${cause}`);
    for (const example of list!.slice(0, 6)) {
      log(`        ${example.kind} ${example.recall} (${example.language}) -> ${example.verdict}: ${example.lost.join("; ") || example.firstFact}`);
      log(`          "${example.text.split("\n")[0]}"`);
    }
  }
  const readingMisses = results.filter((result) => result.lost.length > 0);
  log(`\nListings where reading lost a fact: ${readingMisses.length}/${results.length} (whether or not the verdict was wrong)`);
  return results;
}

try {
  const all = await db().select().from(recalls).where(isNotNull(recalls.cleanHash)).orderBy(asc(recalls.id));
  const aliases = await loadBrandAliases();
  const sample = stratify(all, Number(values.size));
  const cases = buildCases(sample, all, aliases);
  log(`Testing ${cases.length} listings from ${sample.length} of ${all.length} cleaned recalls`);
  let done = 0;
  const outcomes = await mapWithConcurrency(cases, 8, async (testCase) => {
    const outcome = await run(testCase);
    if (++done % 250 === 0) log(`  ${done}/${cases.length}`);
    return outcome;
  });
  report(outcomes);
  const fixed = await fixedCases(aliases);
  const full = await fullPipeline(cases, outcomes, aliases, Number(values.full));
  const photos = await photoTests(sample, all, Number(values.photos));
  log(`\nModel calls: ${usage.calls}, ${usage.input} tokens in, ${usage.output} out, $${cost().toFixed(2)}`);

  await mkdir(".cache/selftest", { recursive: true });
  const slim = outcomes.map(({ recall, ...outcome }) => ({ ...outcome, recall: recall.id, productType: recall.productType }));
  await writeFile(".cache/selftest/results.json", JSON.stringify({ outcomes: slim, fixed, full, photos }, null, 2));
  log("\nDetails in .cache/selftest/results.json");
} finally {
  await db().$client.end();
}
