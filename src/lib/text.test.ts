import { describe, expect, it } from "vitest";
import { normalizeBrand, normalizeText } from "./text";

describe("normalizeText", () => {
  it("removes accents and lowers case", () => {
    expect(normalizeText("Britax Römer")).toBe("britax romer");
    expect(normalizeText("Bébé Confort")).toBe("bebe confort");
  });

  it("turns punctuation into single spaces", () => {
    expect(normalizeText("Maxi-Cosi")).toBe("maxi cosi");
    expect(normalizeText("B'TWIN")).toBe("b twin");
    expect(normalizeText("  Smile  III / 4000984-001 ")).toBe("smile iii 4000984 001");
  });
});

describe("normalizeBrand", () => {
  const aliases = new Map([
    ["britax", "britax romer"],
    ["britax romer", "britax romer"],
    ["maxicosi", "maxi cosi"],
    ["b twin", "decathlon"],
  ]);

  it("maps known spellings to one brand", () => {
    expect(normalizeBrand("BRITAX", aliases)).toBe("britax romer");
    expect(normalizeBrand("Britax-Römer", aliases)).toBe("britax romer");
    expect(normalizeBrand("MaxiCosi", aliases)).toBe("maxi cosi");
    expect(normalizeBrand("B'Twin", aliases)).toBe("decathlon");
  });

  it("keeps unknown brands in normalised form", () => {
    expect(normalizeBrand("Petit Béguin", aliases)).toBe("petit beguin");
  });
});
