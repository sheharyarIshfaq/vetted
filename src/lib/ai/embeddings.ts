import { embeddingModel, openai } from "../openai";

const BATCH = 512;
// Shortened vectors keep all recalls in memory at about 30 MB, at a small cost in quality.
const DIMENSIONS = 512;

// Unit vectors, so cosine similarity is a dot product.
export function normalize(vector: ArrayLike<number>) {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  const scale = norm > 0 ? 1 / Math.sqrt(norm) : 0;
  return Float32Array.from(vector, (value) => value * scale);
}

export async function embed(texts: string[]) {
  const vectors: Float32Array[] = [];
  let tokens = 0;
  for (let i = 0; i < texts.length; i += BATCH) {
    const response = await openai().embeddings.create({ model: embeddingModel(), dimensions: DIMENSIONS, input: texts.slice(i, i + BATCH) });
    vectors.push(...response.data.sort((a, b) => a.index - b.index).map((item) => normalize(item.embedding)));
    tokens += response.usage.total_tokens;
  }
  return { vectors, tokens };
}

export function dot(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
