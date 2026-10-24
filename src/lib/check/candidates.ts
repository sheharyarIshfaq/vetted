import { desc, getTableColumns, gte, or, sql, type SQL } from "drizzle-orm";
import { recalls, type Recall } from "../../db/schema";
import { db } from "../db/client";
import { normalizeText } from "../text";

export type RankedRecall = { recall: Recall; titleSimilarity: number; brandSimilarity: number };

const MAX_CANDIDATES = 5;
const MIN_TITLE_SIMILARITY = 0.25;
const MIN_BRAND_SIMILARITY = 0.6;

function select(brandNorm: string | null, query: string) {
  const titleSimilarity = sql<number>`similarity(${recalls.searchText}, ${query})`.mapWith(Number);
  const brandSimilarity = (
    brandNorm ? sql<number>`similarity(coalesce(${recalls.brandNorm}, ''), ${brandNorm})` : sql<number>`0`
  ).mapWith(Number);
  return { titleSimilarity, brandSimilarity, columns: { ...getTableColumns(recalls), titleSimilarity, brandSimilarity } };
}

function toRanked(rows: (Recall & { titleSimilarity: number; brandSimilarity: number })[]): RankedRecall[] {
  return rows.map(({ titleSimilarity, brandSimilarity, ...recall }) => ({ recall, titleSimilarity, brandSimilarity }));
}

// A barcode match comes first; otherwise recalls of the same brand ranked by trigram similarity to the listing.
export async function findCandidates({
  brandNorm,
  gtin,
  searchText,
}: {
  brandNorm: string | null;
  gtin: string | null;
  searchText: string;
}): Promise<RankedRecall[]> {
  const query = normalizeText(searchText);
  const { titleSimilarity, brandSimilarity, columns } = select(brandNorm, query);

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
  const filters: SQL[] = [gte(titleSimilarity, MIN_TITLE_SIMILARITY)];
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
