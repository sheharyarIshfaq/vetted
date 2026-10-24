import { describe, expect, it } from "vitest";
import { measuresTaken, parseRecallFilters, recallFiltersHref, recallHref } from "./recalls";

describe("parseRecallFilters", () => {
  it("reads known filters", () => {
    expect(parseRecallFilters({ q: " hamax ", category: "toys", source: "eu", page: "3" })).toEqual({
      q: "hamax",
      category: "toys",
      source: "eu",
      page: 3,
    });
  });

  it("falls back to no filter on unknown values", () => {
    expect(parseRecallFilters({ category: "cars", source: "us", page: "-2" })).toEqual({ q: "", category: null, source: null, page: 1 });
    expect(parseRecallFilters({ q: ["a", "b"] }).q).toBe("a");
  });
});

describe("recallFiltersHref", () => {
  const filters = { q: "smile", category: "baby" as const, source: null, page: 4 };

  it("keeps the other filters and resets the page", () => {
    expect(recallFiltersHref(filters, { source: "fr" })).toBe("/recalls?q=smile&category=baby&source=fr");
    expect(recallFiltersHref(filters, { category: null, q: "" })).toBe("/recalls");
  });

  it("links to another page", () => {
    expect(recallFiltersHref(filters, { page: 5 })).toBe("/recalls?q=smile&category=baby&page=5");
  });
});

describe("recallHref", () => {
  it("keeps a Safety Gate id in one path segment", () => {
    expect(recallHref("sg:SR/02933/26")).toBe("/recalls/sg%3ASR%2F02933%2F26");
    expect(recallHref("rc:22625")).toBe("/recalls/rc%3A22625");
  });
});

describe("measuresTaken", () => {
  it("lists each measure once, as written", () => {
    const text =
      "Type d'opérateur économique prenant la/les mesure(s) notifiée(s): DétaillantCatégorie de mesure: Rappel du produit auprès des utilisateurs finauxDate d'entrée en vigueur: Information non disponibleType d'opérateur économique prenant la/les mesure(s) notifiée(s): DétaillantCatégorie de mesure: Retrait du produit du marchéDate d'entrée en vigueur: 28/01/2022Type d'opérateur économique: ImportateurCatégorie de mesure: Retrait du produit du marchéDate d'entrée en vigueur: 28/01/2022";
    expect(measuresTaken(text)).toEqual(["Rappel du produit auprès des utilisateurs finaux", "Retrait du produit du marché"]);
  });

  it("is empty without measures", () => {
    expect(measuresTaken(null)).toEqual([]);
    expect(measuresTaken("")).toEqual([]);
  });
});
