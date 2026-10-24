import { describe, expect, it, vi } from "vitest";

vi.mock("../db/client", () => ({ db: vi.fn() }));
vi.mock("../ai/embeddings", () => ({ embed: vi.fn() }));
vi.mock("./semantic", () => ({ nearestRecalls: vi.fn() }));

const { compactCode } = await import("./candidates");

describe("compactCode", () => {
  it("reads codes the same whatever their punctuation, case or numerals", () => {
    expect(compactCode("BPB-002")).toBe("bpb002");
    expect(compactCode("bpb 002")).toBe("bpb002");
    expect(compactCode("Smile III")).toBe("smile3");
  });
});
