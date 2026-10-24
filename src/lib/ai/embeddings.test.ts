import { describe, expect, it, vi } from "vitest";

vi.mock("../openai", () => ({ openai: vi.fn(), embeddingModel: () => "test" }));

const { dot, normalize } = await import("./embeddings");

describe("embeddings", () => {
  it("normalizes to unit length, so the dot product is the cosine similarity", () => {
    const a = normalize([3, 4]);
    expect(Array.from(a)).toEqual([expect.closeTo(0.6), expect.closeTo(0.8)]);
    expect(dot(a, a)).toBeCloseTo(1);
    expect(dot(normalize([1, 0]), normalize([0, 2]))).toBeCloseTo(0);
  });

  it("leaves a zero vector at zero", () => {
    expect(Array.from(normalize([0, 0]))).toEqual([0, 0]);
  });
});
