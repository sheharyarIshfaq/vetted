import { desc, getTableColumns, gte, or, sql, type SQL } from "drizzle-orm";
import { recalls, type Recall } from "../../db/schema";
import { db } from "../db/client";
import { normalizeModelText } from "../text";

export type RankedRecall = { recall: Recall; titleSimilarity: number; brandSimilarity: number };

const MAX_CANDIDATES = 5;
const MIN_TITLE_SIMILARITY = 0.25;
const MIN_BRAND_SIMILARITY = 0.6;
// Within the same brand, a recall also qualifies when the model name appears in it,
// so extra listing words ("siège vélo enfant" vs "porte-bébé") don't hide it.
const MIN_MODEL_SIMILARITY = 0.8;

function select(brandNorm: string | null, query: string, model: string) {
  const titleSimilarity = sql<number>`similarity(${recalls.searchText}, ${query})`.mapWith(Number);
  const modelSimilarity = sql<number>`word_similarity(${model}, ${recalls.searchText})`;
  const brandSimilarity = (
    brandNorm ? sql<number>`similarity(coalesce(${recalls.brandNorm}, ''), ${brandNorm})` : sql<number>`0`
  ).mapWith(Number);
  return { titleSimilarity, brandSimilarity, modelSimilarity, columns: { ...getTableColumns(recalls), titleSimilarity, brandSimilarity } };
}

function toRanked(rows: (Recall & { titleSimilarity: number; brandSimilarity: number })[]): RankedRecall[] {
  return rows.map(({ titleSimilarity, brandSimilarity, ...recall }) => ({ recall, titleSimilarity, brandSimilarity }));
}

// A barcode match comes first; otherwise recalls of the same brand ranked by trigram similarity to the listing.
export async function findCandidates({
  brandNorm,
  model,
  gtin,
  searchText,
}: {
  brandNorm: string | null;
  model: string | null;
  gtin: string | null;
  searchText: string;
}): Promise<RankedRecall[]> {
  const query = normalizeModelText(searchText);
  const modelQuery = normalizeModelText(model ?? "");
  const { titleSimilarity, brandSimilarity, modelSimilarity, columns } = select(brandNorm, query, modelQuery);

  if (gtin) {
    const rows = await db()
      .select(columns)
      .from(recalls)
      .where(sql`exists (select 1 from unnest(${recalls.gtins}) as code where ltrim(code, '0') = ltrim(${gtin}, '0'))`)
      .orderBy(desc(recalls.publishedAt))
      .limit(MAX_CANDIDATES);
    if (rows.length) return toRanked(rows);
  }

  if (!query) return [];
  const titleOrModel =
    brandNorm && modelQuery
      ? or(gte(titleSimilarity, MIN_TITLE_SIMILARITY), gte(modelSimilarity, MIN_MODEL_SIMILARITY))!
      : gte(titleSimilarity, MIN_TITLE_SIMILARITY);
  const filters: SQL[] = [titleOrModel];
  if (brandNorm) {
    filters.push(or(sql`${recalls.brandNorm} = ${brandNorm}`, gte(brandSimilarity, MIN_BRAND_SIMILARITY))!);
  }
  const rows = await db()
    .select(columns)
    .from(recalls)
    .where(sql.join(filters, sql` and `))
    .orderBy(desc(titleSimilarity), desc(recalls.publishedAt))
    .limit(MAX_CANDIDATES);
  return toRanked(rows);
}
