import { describe, expect, it } from "vitest";
import type { RecallDetailsOutput } from "../ai/schemas";
import { expandRefShorthand, needsModel, validateDetails } from "./parse-details";

const hamaxText =
  "modele buddy code 4091054 / 8591602 avec les dates de fabrication entre le 01/01/2022 et le 06/08/2026.";

const britaxText =
  "britax smile iii retiré du marché (fabrication : septembre 2019 – mai 2020), smile 4 retiré du marché ( fabrication : juillet 2022 – mai 2023), certains smile 5z retirés du marché (fabrication : février 2023 – mars 2024)";

const empty: RecallDetailsOutput = {
  models: [],
  references: [],
  batches: [],
  productionFrom: null,
  productionTo: null,
  modelRanges: [],
  quote: null,
};

describe("needsModel", () => {
  it("sends text with dates, codes or batches", () => {
    expect(needsModel(hamaxText)).toBe(true);
    expect(needsModel(britaxText)).toBe(true);
    expect(needsModel("lot 2024-118")).toBe(true);
    expect(needsModel("référence b11437")).toBe(true);
  });

  it("skips plain descriptions", () => {
    expect(needsModel("peluche lapin rose")).toBe(false);
    expect(needsModel("peluche lapin rose / tous les lots")).toBe(false);
    expect(needsModel("")).toBe(false);
  });
});

describe("validateDetails", () => {
  const hamax: RecallDetailsOutput = {
    ...empty,
    models: ["buddy"],
    references: ["4091054", "8591602"],
    productionFrom: "2022-01-01",
    productionTo: "2026-08-06",
    quote: "dates de fabrication entre le 01/01/2022 et le 06/08/2026",
  };

  it("keeps a result whose quote and values appear in the text", () => {
    expect(validateDetails(hamaxText, hamax)).toEqual({
      models: ["buddy"],
      refs: ["4091054", "8591602"],
      batches: [],
      productionFrom: "2022-01-01",
      productionTo: "2026-08-06",
      modelRanges: [],
      quote: "dates de fabrication entre le 01/01/2022 et le 06/08/2026",
    });
  });

  it("drops the result when the quote is not an exact substring", () => {
    expect(validateDetails(hamaxText, { ...hamax, quote: "fabriqué entre 2022 et 2026" })).toBeNull();
    expect(validateDetails(hamaxText, { ...hamax, quote: null })).toBeNull();
  });

  it("drops the result when a date is malformed or the range is reversed", () => {
    expect(validateDetails(hamaxText, { ...hamax, productionTo: "2026-02-30" })).toBeNull();
    expect(validateDetails(hamaxText, { ...hamax, productionFrom: "06/08/2026" })).toBeNull();
    expect(validateDetails(hamaxText, { ...hamax, productionFrom: "2027-01-01" })).toBeNull();
  });

  it("drops single values that are not in the text", () => {
    const result = validateDetails(hamaxText, { ...hamax, references: ["4091054", "9999999"], models: ["buddy", "caress"] });
    expect(result?.refs).toEqual(["4091054"]);
    expect(result?.models).toEqual(["buddy"]);
  });

  it("allows an open-ended range", () => {
    expect(validateDetails(hamaxText, { ...hamax, productionTo: null })?.productionTo).toBeNull();
  });

  it("keeps per-model ranges for 22625", () => {
    const result = validateDetails(britaxText, {
      ...empty,
      models: ["smile iii", "smile 4", "smile 5z"],
      modelRanges: [
        { model: "smile iii", from: "2019-09-01", to: "2020-05-31", refs: [], batches: [] },
        { model: "smile 4", from: "2022-07-01", to: "2023-05-31", refs: [], batches: [] },
        { model: "smile 5z", from: "2023-02-01", to: "2024-03-31", refs: [], batches: [] },
      ],
      quote: "britax smile iii retiré du marché (fabrication : septembre 2019 – mai 2020)",
    });
    expect(result?.modelRanges.map((range) => range.model)).toEqual(["smile iii", "smile 4", "smile 5z"]);
    expect(result?.productionFrom).toBeNull();
  });

  it("needs no quote when there are no dates", () => {
    expect(validateDetails("référence b11437", { ...empty, references: ["b11437"] })?.refs).toEqual(["b11437"]);
  });
});

describe("expandRefShorthand", () => {
  it("gives a shortened reference the prefix of the one before", () => {
    expect(expandRefShorthand(["4000984-204346", "-204377", "-8148", "b11437"])).toEqual([
      "4000984-204346",
      "4000984-204377",
      "4000984-8148",
      "b11437",
    ]);
  });

  it("leaves a shortened reference alone when there is no prefix to take", () => {
    expect(expandRefShorthand(["-204377"])).toEqual(["-204377"]);
  });
});

describe("validateDetails · some models recalled for all dates", () => {
  const beertender =
    "beertender vb31 vb21 vb215830, vb2158f2, vb215700 : toutes les dates de fabrication vb310e10, vb320e10, vb310310, vb310810 : fabrications jusqu'à juillet 2018.";

  it("drops a flat date limit that would also cover the models recalled for all dates", () => {
    const details = validateDetails(beertender, {
      ...empty,
      models: ["beertender vb31 vb21"],
      references: ["vb215830", "vb310e10"],
      productionTo: "2018-07-31",
      quote: "vb310e10, vb320e10, vb310310, vb310810 : fabrications jusqu'à juillet 2018.",
    });
    expect(details).toMatchObject({ productionFrom: null, productionTo: null, quote: null, refs: ["vb215830", "vb310e10"] });
  });

  it("keeps per-model ranges, which say which models the date applies to", () => {
    const details = validateDetails(beertender, {
      ...empty,
      modelRanges: [
        { model: "vb21", from: null, to: null, refs: ["vb215830"], batches: [] },
        { model: "vb31", from: null, to: "2018-07-31", refs: ["vb310e10"], batches: [] },
      ],
      quote: "vb310e10, vb320e10, vb310310, vb310810 : fabrications jusqu'à juillet 2018.",
    });
    expect(details?.modelRanges[1].to).toBe("2018-07-31");
    expect(details?.quote).not.toBeNull();
  });
});
