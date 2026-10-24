import { isNotNull } from "drizzle-orm";
import { recalls } from "../../db/schema";
import { dot, normalize } from "../ai/embeddings";
import { db } from "../db/client";

// All recall vectors in memory (15k × 512 floats, about 30 MB); a full scan takes a few milliseconds.
type Index = { ids: string[]; vectors: Float32Array[]; loadedAt: number };

const RELOAD_AFTER_MS = 10 * 60 * 1000;
let index: Promise<Index> | null = null;

async function load(): Promise<Index> {
  const rows = await db().select({ id: recalls.id, embedding: recalls.embedding }).from(recalls).where(isNotNull(recalls.embedding));
  return { ids: rows.map((row) => row.id), vectors: rows.map((row) => normalize(row.embedding!)), loadedAt: Date.now() };
}

async function current() {
  const loaded = index ? await index : null;
  if (!loaded || Date.now() - loaded.loadedAt > RELOAD_AFTER_MS) index = load();
  return index!;
}

// The k recalls closest to the listing's vector, best first.
export async function nearestRecalls(vector: Float32Array, k: number, minSimilarity = 0) {
  const { ids, vectors } = await current();
  const scored: { id: string; similarity: number }[] = [];
  for (let i = 0; i < vectors.length; i++) {
    const similarity = dot(vector, vectors[i]);
    if (similarity >= minSimilarity) scored.push({ id: ids[i], similarity });
  }
  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, k);
}
