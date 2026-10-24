import { and, count, desc, eq, gte, inArray, max, sql, type SQL } from "drizzle-orm";
import { recalls, type NewRecall, type Recall } from "../../db/schema";
import { normalizeText } from "../text";
import { db } from "./client";

const UPSERT_CHUNK = 500;

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

type ListOptions = { q?: string; category?: string; page?: number; pageSize?: number };

export async function listRecalls({ q, category, page = 1, pageSize = 24 }: ListOptions = {}) {
  const filters: SQL[] = [];
  if (category) filters.push(eq(recalls.category, category));
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

export function recallsPublishedSince(since: string, limit = 8) {
  return db()
    .select()
    .from(recalls)
    .where(gte(recalls.publishedAt, since))
    .orderBy(desc(recalls.publishedAt), recalls.id)
    .limit(limit);
}

export async function countRecalls(category?: string) {
  const [{ total }] = await db()
    .select({ total: count() })
    .from(recalls)
    .where(category ? eq(recalls.category, category) : undefined);
  return total;
}

// What a check searches: how many recalls, from which sources, and when the data was last refreshed.
export async function recallStats() {
  const rows = await db()
    .select({ source: recalls.source, total: count(), updatedAt: max(recalls.updatedAt) })
    .from(recalls)
    .groupBy(recalls.source);
  return {
    total: rows.reduce((sum, row) => sum + row.total, 0),
    sources: rows.map((row) => row.source as "rappelconso" | "safetygate"),
    updatedAt: rows.reduce<Date | null>((latest, row) => (row.updatedAt && (!latest || row.updatedAt > latest) ? row.updatedAt : latest), null),
  };
}
