import { createHash } from "node:crypto";
import { eq, gte } from "drizzle-orm";
import { recalls, type Recall } from "../../db/schema";
import { embed } from "../ai/embeddings";
import { db } from "../db/client";
import { embeddingModel } from "../openai";
import { mapWithConcurrency } from "./concurrency";

// $0.02 per million tokens for text-embedding-3-small.
const PRICE_PER_TOKEN = 0.02 / 1_000_000;

// What a recall is, from its clean fields: "Belkin | power bank | boostcharge | batterie externe boostcharge …".
export function recallEmbeddingText(recall: Pick<Recall, "brandClean" | "brand" | "productType" | "modelNames" | "productName">) {
  return [recall.brandClean ?? recall.brand, recall.productType, recall.modelNames.join(", "), recall.productName]
    .filter(Boolean)
    .join(" | ");
}

const hash = (text: string) => createHash("sha256").update(`${embeddingModel()}-512\n${text}`).digest("hex");

export type EmbedPlan = { recalls: number; tokens: number; estimatedCost: number };

// Embeds recalls whose text changed since their last embedding.
export async function embedRecalls({
  updatedSince,
  confirm,
  log,
}: {
  updatedSince?: Date;
  confirm: (plan: EmbedPlan) => Promise<boolean>;
  log: (message: string) => void;
}) {
  const query = db().select().from(recalls);
  const rows = updatedSince ? await query.where(gte(recalls.updatedAt, updatedSince)) : await query;
  const todo = rows.flatMap((recall) => {
    const text = recallEmbeddingText(recall);
    const key = hash(text);
    return recall.embeddingHash === key ? [] : [{ id: recall.id, text, key }];
  });
  const tokens = todo.reduce((sum, item) => sum + Math.ceil(item.text.length / 4), 0);
  if (!(await confirm({ recalls: todo.length, tokens, estimatedCost: tokens * PRICE_PER_TOKEN }))) return null;
  if (todo.length === 0) return { stored: 0, tokens: 0, cost: 0 };

  const { vectors, tokens: used } = await embed(todo.map((item) => item.text));
  await mapWithConcurrency(todo, 8, (item, i) =>
    db().update(recalls).set({ embedding: Array.from(vectors[i]), embeddingHash: item.key }).where(eq(recalls.id, item.id)),
  );
  log(`Embedded ${todo.length} recalls`);
  return { stored: todo.length, tokens: used, cost: used * PRICE_PER_TOKEN };
}
