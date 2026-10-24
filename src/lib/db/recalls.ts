import { and, count, desc, eq, inArray, max, or, sql, type SQL } from "drizzle-orm";
import { recalls, type NewRecall, type Recall } from "../../db/schema";
import type { CategoryGroup, RecallSource } from "../recalls";
import { normalizeText } from "../text";
import { db } from "./client";

const UPSERT_CHUNK = 500;

export async function sourceRefs(source: RecallSource) {
  const rows = await db().select({ sourceRef: recalls.sourceRef }).from(recalls).where(eq(recalls.source, source));
  return new Set(rows.map((row) => row.sourceRef));
}

export async function upsertRecalls(rows: NewRecall[]) {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    await db()
      .insert(recalls)
      .values(rows.slice(i, i + UPSERT_CHUNK))
      .onConflictDoUpdate({
        target: recalls.id,
        set: {
          source: sql`excluded.source`,
          sourceRef: sql`excluded.source_ref`,
          url: sql`excluded.url`,
          publishedAt: sql`excluded.published_at`,
          category: sql`excluded.category`,
          subcategory: sql`excluded.subcategory`,
          brand: sql`excluded.brand`,
          brandNorm: sql`excluded.brand_norm`,
          productName: sql`excluded.product_name`,
          models: sql`excluded.models`,
          refs: sql`excluded.refs`,
          gtins: sql`excluded.gtins`,
          batches: sql`excluded.batches`,
          sampleBatches: sql`excluded.sample_batches`,
          productionFrom: sql`excluded.production_from`,
          productionTo: sql`excluded.production_to`,
          modelRanges: sql`excluded.model_ranges`,
          soldFrom: sql`excluded.sold_from`,
          soldTo: sql`excluded.sold_to`,
          risk: sql`excluded.risk`,
          reason: sql`excluded.reason`,
          whatToDo: sql`excluded.what_to_do`,
          images: sql`excluded.images`,
          datesQuote: sql`excluded.dates_quote`,
          raw: sql`excluded.raw`,
          searchText: sql`excluded.search_text`,
          updatedAt: sql`now()`,
        },
      });
  }
}

export async function getRecall(id: string): Promise<Recall | undefined> {
  const [row] = await db().select().from(recalls).where(eq(recalls.id, id)).limit(1);
  return row;
}

export function getRecalls(ids: string[]): Promise<Recall[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return db().select().from(recalls).where(inArray(recalls.id, ids));
}

type ListOptions = { q?: string; group?: CategoryGroup | null; source?: RecallSource | null; page?: number; pageSize?: number };

function inGroup(group: CategoryGroup) {
  const parts: SQL[] = [];
  for (const source of ["rappelconso", "safetygate"] as const) {
    const rule: { categories?: readonly string[]; subcategories?: readonly string[] } = group[source];
    const fields: SQL[] = [];
    if (rule.categories) fields.push(inArray(recalls.category, [...rule.categories]));
    if (rule.subcategories) fields.push(inArray(recalls.subcategory, [...rule.subcategories]));
    parts.push(and(eq(recalls.source, source), or(...fields))!);
  }
  return or(...parts)!;
}

export async function listRecalls({ q, group, source, page = 1, pageSize = 24 }: ListOptions = {}) {
  const filters: SQL[] = [];
  if (group) filters.push(inGroup(group));
  if (source) filters.push(eq(recalls.source, source));
  // search_text is already lower case and unaccented; every query word must appear, allowing small typos
  for (const word of q ? normalizeText(q).split(" ").filter(Boolean) : []) {
    filters.push(sql`(${recalls.searchText} like ${`%${word}%`} or ${word} <% ${recalls.searchText})`);
  }
  const where = filters.length ? and(...filters) : undefined;

  const [items, [{ total }]] = await Promise.all([
    db()
      .select()
      .from(recalls)
      .where(where)
      .orderBy(desc(recalls.publishedAt), recalls.id)
      .limit(pageSize)
      .offset((Math.max(page, 1) - 1) * pageSize),
    db().select({ total: count() }).from(recalls).where(where),
  ]);
  return { items, total };
}

// What a check searches: how many recalls, from which sources, and when the data was last refreshed.
export async function recallStats() {
  const rows = await db()
    .select({ source: recalls.source, total: count(), updatedAt: max(recalls.updatedAt) })
    .from(recalls)
    .groupBy(recalls.source);
  return {
    total: rows.reduce((sum, row) => sum + row.total, 0),
    sources: rows.map((row) => row.source as RecallSource),
    bySource: Object.fromEntries(rows.map((row) => [row.source, row.total])) as Partial<Record<RecallSource, number>>,
    updatedAt: rows.reduce<Date | null>((latest, row) => (row.updatedAt && (!latest || row.updatedAt > latest) ? row.updatedAt : latest), null),
  };
}
