import { sql } from "drizzle-orm";
import { boolean, check, date, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// One entry per model when a recall gives each model its own limits. Dates are YYYY-MM-DD; either end may be open.
export type ModelRange = {
  model: string;
  from: string | null;
  to: string | null;
  refs: string[];
  batches: string[];
};

export const recalls = pgTable(
  "recalls",
  {
    id: text().primaryKey(), // 'rc:22625' or 'sg:SR/03046/26'
    source: text().notNull(),
    sourceRef: text("source_ref").notNull(),
    url: text().notNull(),
    publishedAt: date("published_at", { mode: "string" }).notNull(),
    category: text(),
    subcategory: text(),
    brand: text(),
    brandNorm: text("brand_norm"),
    productName: text("product_name").notNull(),
    models: text().array().notNull().default(sql`'{}'`),
    refs: text().array().notNull().default(sql`'{}'`),
    gtins: text().array().notNull().default(sql`'{}'`),
    batches: text().array().notNull().default(sql`'{}'`),
    // Safety Gate names the batch of the sample it tested: it identifies the product, it doesn't limit the recall.
    sampleBatches: text("sample_batches").array().notNull().default(sql`'{}'`),
    productionFrom: date("production_from", { mode: "string" }),
    productionTo: date("production_to", { mode: "string" }),
    modelRanges: jsonb("model_ranges").$type<ModelRange[]>().notNull().default([]),
    soldFrom: date("sold_from", { mode: "string" }),
    soldTo: date("sold_to", { mode: "string" }),
    risk: text(),
    reason: text(),
    whatToDo: text("what_to_do"), // copied from the source, never written by us
    images: text().array().notNull().default(sql`'{}'`),
    datesQuote: text("dates_quote"),
    raw: jsonb().notNull(),
    searchText: text("search_text").notNull(),
    // Clean fields read once from the raw ones above, each backed by a quote of the source text.
    brandClean: text("brand_clean"),
    brandCleanNorm: text("brand_clean_norm"),
    productType: text("product_type"),
    modelName: text("model_name"),
    codes: text().array().notNull().default(sql`'{}'`),
    specs: text().array().notNull().default(sql`'{}'`),
    cleanHash: text("clean_hash"), // input hash of the clean fields, so unchanged recalls aren't read again
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("recalls_source_check", sql`${t.source} in ('rappelconso', 'safetygate')`),
    index("recalls_search_trgm").using("gin", t.searchText.op("gin_trgm_ops")),
    index("recalls_brand_trgm").using("gin", t.brandNorm.op("gin_trgm_ops")),
    index("recalls_gtins").using("gin", t.gtins),
    index("recalls_published").on(t.publishedAt.desc()),
  ],
);

export const brandAliases = pgTable("brand_aliases", {
  alias: text().primaryKey(),
  brandNorm: text("brand_norm").notNull(),
});

export const checks = pgTable(
  "checks",
  {
    id: uuid().primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    input: jsonb().notNull(),
    extracted: jsonb(),
    candidates: jsonb(),
    verdict: text(),
    recallId: text("recall_id").references(() => recalls.id),
    evidence: jsonb(),
    label: jsonb(),
    flagged: boolean().notNull().default(false),
    flagNote: text("flag_note"),
  },
  (t) => [check("checks_verdict_check", sql`${t.verdict} in ('recalled', 'check_label', 'clear')`)],
);

export const watches = pgTable("watches", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull(),
  brandNorm: text("brand_norm"),
  model: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const parseCache = pgTable("parse_cache", {
  inputHash: text("input_hash").primaryKey(), // sha256 of the free text sent to the model
  result: jsonb().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Recall = typeof recalls.$inferSelect;
export type NewRecall = typeof recalls.$inferInsert;
