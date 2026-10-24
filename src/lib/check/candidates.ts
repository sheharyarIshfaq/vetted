import { and, desc, eq, getTableColumns, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import { recalls, type Recall } from "../../db/schema";
import { embed } from "../ai/embeddings";
import { db } from "../db/client";
import { normalizeModelText } from "../text";
import { nearestRecalls } from "./semantic";

export type Route = "barcode" | "code" | "brand_model" | "brand_title" | "type_model" | "title" | "semantic";

export type RankedRecall = {
  recall: Recall;
  titleSimilarity: number;
  brandSimilarity: number;
  routes: Route[]; // every route that found it, for the self-test's per-route report
};

const MAX_CANDIDATES = 20;
const PER_ROUTE = 20;
const MIN_TITLE_SIMILARITY = 0.25;
const MIN_BRAND_SIMILARITY = 0.6;
// The brand's own recalls only need a faint title overlap: "Hoverboard Blaupunkt 6.5 pouces" against
// "Scooter auto-équilibrage (hoverboard)" scores 0.24, and the rules still decide whether it matches.
const MIN_SAME_BRAND_SIMILARITY = 0.1;
const MIN_MODEL_SIMILARITY = 0.6;
// From the self-test (pnpm selftest): the right recall scored 0.57 or more for 99% of the listings naming it.
export const MIN_SEMANTIC_SIMILARITY = 0.5;
// Reciprocal rank fusion: a recall ranked high by several routes beats one ranked first by a single route.
const RRF_K = 60;

export type CandidateQuery = {
  brandNorm: string | null;
  model: string | null; // model and variant
  gtin: string | null;
  codes: string[]; // references and other code-like values from the listing
  productType: string | null;
  searchText: string; // brand, model and title
  embeddingText: string | null; // null skips the semantic route
};

// "BPB-002" and "bpb002" are one code.
export const compactCode = (value: string) => normalizeModelText(value).replaceAll(" ", "");

const codeLike = (value: string) => {
  const code = compactCode(value);
  return code.length >= 3 && /\d/.test(code);
};

async function ids(where: SQL | undefined, order: SQL[]) {
  const rows = await db().select({ id: recalls.id }).from(recalls).where(where).orderBy(...order).limit(PER_ROUTE);
  return rows.map((row) => row.id);
}

const none = Promise.resolve<string[]>([]);

// Each route returns recall ids best first; the rules see the fused top 20.
export async function findCandidates(query: CandidateQuery): Promise<RankedRecall[]> {
  const title = normalizeModelText(query.searchText);
  const model = normalizeModelText(query.model ?? "");
  const { brandNorm } = query;
  const brandSimilarity = (
    brandNorm
      ? sql<number>`greatest(similarity(coalesce(${recalls.brandCleanNorm}, ''), ${brandNorm}), similarity(coalesce(${recalls.brandNorm}, ''), ${brandNorm}))`
      : sql<number>`0`
  ).mapWith(Number);
  const sameBrand = brandNorm ? or(eq(recalls.brandCleanNorm, brandNorm), eq(recalls.brandNorm, brandNorm))! : undefined;
  const brandMatches = brandNorm ? or(sameBrand, gte(brandSimilarity, MIN_BRAND_SIMILARITY))! : undefined;
  const titleSimilarity = sql<number>`similarity(${recalls.searchText}, ${title})`.mapWith(Number);
  const modelSimilarity = sql<number>`word_similarity(${model}, array_to_string(${recalls.modelNames}, ' ') || ' ' || ${recalls.searchText})`;
  const codes = [...new Set([...query.codes, query.model ?? "", query.gtin ?? ""].filter(codeLike).map(compactCode))];

  const routes: Record<Route, Promise<string[]>> = {
    barcode: query.gtin
      ? ids(sql`exists (select 1 from unnest(${recalls.gtins}) as code where ltrim(code, '0') = ltrim(${query.gtin}, '0'))`, [desc(recalls.publishedAt)])
      : none,
    code: codes.length
      ? ids(
          sql`exists (select 1 from unnest(${recalls.refs} || ${recalls.codes} || ${recalls.models}) as code
            where regexp_replace(lower(unaccent(code)), '[^a-z0-9]', '', 'g') in (${sql.join(codes.map((code) => sql`${code}`), sql`, `)}))`,
          [desc(recalls.publishedAt)],
        )
      : none,
    brand_model: brandMatches && model ? ids(and(brandMatches, gte(modelSimilarity, MIN_MODEL_SIMILARITY)), [desc(modelSimilarity), desc(titleSimilarity)]) : none,
    brand_title:
      brandMatches && title
        ? ids(
            and(brandMatches, or(gte(titleSimilarity, MIN_TITLE_SIMILARITY), and(sameBrand, gte(titleSimilarity, MIN_SAME_BRAND_SIMILARITY)))),
            [desc(titleSimilarity), desc(recalls.publishedAt)],
          )
        : none,
    // An unbranded listing can still name the model of a recall of its type.
    type_model:
      !brandNorm && query.productType && model
        ? ids(and(eq(recalls.productType, query.productType), gte(modelSimilarity, MIN_MODEL_SIMILARITY)), [desc(modelSimilarity)])
        : none,
    title: !brandNorm && title ? ids(gte(titleSimilarity, MIN_TITLE_SIMILARITY), [desc(titleSimilarity), desc(recalls.publishedAt)]) : none,
    semantic: query.embeddingText
      ? embed([query.embeddingText]).then(async ({ vectors }) =>
          (await nearestRecalls(vectors[0], PER_ROUTE, MIN_SEMANTIC_SIMILARITY)).map((item) => item.id),
        )
      : none,
  };

  const results = await Promise.all(Object.entries(routes).map(async ([route, found]) => ({ route: route as Route, ids: await found })));
  const fused = new Map<string, { score: number; routes: Route[] }>();
  for (const { route, ids: found } of results) {
    found.forEach((id, rank) => {
      const entry = fused.get(id) ?? { score: 0, routes: [] };
      entry.score += 1 / (RRF_K + rank + 1);
      entry.routes.push(route);
      fused.set(id, entry);
    });
  }
  // A barcode match is exact, so it always goes first.
  const barcode = (entry: { routes: Route[] }) => Number(entry.routes.includes("barcode"));
  const top = [...fused].sort(([, a], [, b]) => barcode(b) - barcode(a) || b.score - a.score).slice(0, MAX_CANDIDATES);
  if (top.length === 0) return [];

  const rows = await db()
    .select({ ...getTableColumns(recalls), titleSimilarity, brandSimilarity })
    .from(recalls)
    .where(inArray(recalls.id, top.map(([id]) => id)));
  const byId = new Map(rows.map(({ titleSimilarity, brandSimilarity, ...recall }) => [recall.id, { recall, titleSimilarity, brandSimilarity }]));
  return top.flatMap(([id, entry]) => {
    const row = byId.get(id);
    return row ? [{ ...row, routes: entry.routes }] : [];
  });
}
