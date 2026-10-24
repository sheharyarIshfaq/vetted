import { describe, expect, it } from "vitest";
import { normalizeBrand, normalizeModelText, normalizeText } from "./text";

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

describe("normalizeModelText", () => {
  it("writes Roman numerals as digits", () => {
    expect(normalizeModelText("Smile III")).toBe("smile 3");
    expect(normalizeModelText("KING II / Smile IV")).toBe("king 2 smile 4");
    expect(normalizeModelText("chassis de poussette smile iii, smile 4")).toBe("chassis de poussette smile 3 smile 4");
  });

  it("leaves single letters and words containing numerals alone", () => {
    expect(normalizeModelText("Smile V, Pack X")).toBe("smile v pack x");
    expect(normalizeModelText("Vivid Mix")).toBe("vivid mix");
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

  it("turns placeholder brands into no brand", () => {
    for (const raw of ["Inconnu", "SANS MARQUE", "Unknown", "no brand", "N/A", "Generic", "Générique", "pas de marque", "Not specified", "aucune", ""]) {
      expect(normalizeBrand(raw, aliases), raw).toBeNull();
    }
    expect(normalizeBrand("Brandt", aliases)).toBe("brandt");
    expect(normalizeBrand("Sansonite", aliases)).toBe("sansonite");
  });
});
