import { describe, expect, it, vi } from "vitest";

vi.mock("../openai", () => ({ openai: vi.fn(), openaiModel: () => "test" }));
vi.mock("../db/client", () => ({ db: vi.fn() }));

const { unitLimitInput, validateUnitLimit } = await import("./unit-limit");

const vsett = {
  source: "rappelconso",
  brand: "vsett",
  productName: "trottinette marque vsett",
  models: [],
  refs: [],
  category: null,
  raw: {
    marque_produit: "vsett",
    libelle: "trottinette marque vsett",
    identification_produits: ["3701107955343", "numéros de série : v10p60v332208401 ? v10p60v332208470", "non concerné"],
  },
};

describe("unit limits", () => {
  it("reads the identification fields, where serial numbers are written", () => {
    expect(unitLimitInput(vsett)).toContain("Identification : numéros de série : v10p60v332208401 ? v10p60v332208470");
  });

  it("keeps a quote only when it is in the text and the recall is limited", () => {
    const text = unitLimitInput(vsett);
    expect(validateUnitLimit(text, { limited: true, quote: "numéros de série : v10p60v332208401 ? v10p60v332208470" })).toBe(
      "numéros de série : v10p60v332208401 ? v10p60v332208470",
    );
    expect(validateUnitLimit(text, { limited: true, quote: "numéros de série 1 à 9" })).toBeNull();
    expect(validateUnitLimit(text, { limited: false, quote: null })).toBeNull();
    expect(
      validateUnitLimit(text, { limited: true, quote: "Identification : numéros de série : v10p60v332208401 ? v10p60v332208470\nIdentification : non concerné\n|" }),
    ).toBe("numéros de série : v10p60v332208401 ? v10p60v332208470");
  });
});
