import { describe, expect, it } from "vitest";
import {
  decideVerdict,
  isInRange,
  normalizeModel,
  type Candidate,
  type CandidateRecall,
  type ItemFacts,
  type PhotoComparison,
} from "./verdict";

const britax22625: CandidateRecall = {
  id: "rc:22625",
  brand: "britax römer",
  brandNorm: "britax romer",
  productName: "châssis de poussette smile iii, smile 4 et smile 5z",
  models: ["smile iii", "smile 4", "smile 5z"],
  refs: ["4000984-204346"],
  gtins: [],
  batches: [],
  productionFrom: "2019-09-01",
  productionTo: "2024-03-31",
  modelRanges: [
    { model: "smile iii", from: "2019-09-01", to: "2020-05-31", refs: [], batches: [] },
    { model: "smile 4", from: "2022-07-01", to: "2023-05-31", refs: [], batches: [] },
    { model: "smile 5z", from: "2023-02-01", to: "2024-03-31", refs: [], batches: [] },
  ],
};

const hamaxBuddy: CandidateRecall = {
  id: "rc:23843",
  brand: "hamax",
  brandNorm: "hamax",
  productName: "porte-bébé hamax buddy",
  models: ["buddy"],
  refs: ["4091054", "8591602"],
  gtins: ["70297755203498"],
  batches: [],
  productionFrom: "2022-01-01",
  productionTo: null,
  modelRanges: [],
};

const boonPivot: CandidateRecall = {
  id: "rc:boon",
  brand: "boon",
  brandNorm: "boon",
  productName: "pivot",
  models: ["pivot"],
  refs: ["b11437", "b11578"],
  gtins: [],
  batches: [],
  productionFrom: null,
  productionTo: null,
  modelRanges: [],
};

const toyWithBatches: CandidateRecall = {
  ...boonPivot,
  id: "rc:toy",
  brand: "vtech",
  brandNorm: "vtech",
  productName: "hochet musical",
  models: ["hochet musical"],
  refs: [],
  batches: ["L2024-118", "L2024-119"],
};

function item(overrides: Partial<ItemFacts>): ItemFacts {
  return {
    brandNorm: null,
    brand: null,
    model: null,
    modelVariant: null,
    references: [],
    gtin: null,
    batch: null,
    productionDate: null,
    ...overrides,
  };
}

const smileIII = item({ brand: "Britax Römer", brandNorm: "britax romer", model: "Smile III" });
const smile4 = item({ brand: "Britax", brandNorm: "britax romer", model: "Smile 4" });
const buddy = item({ brand: "Hamax", brandNorm: "hamax", model: "Buddy" });

function candidate(recall: CandidateRecall, titleSimilarity = 0.4): Candidate {
  return { recall, titleSimilarity, brandSimilarity: 1 };
}

const noPhoto: PhotoComparison = { sameProduct: null };

describe("normalizeModel", () => {
  it("handles case, spaces, accents and roman numerals", () => {
    expect(normalizeModel("Smile III")).toBe("smile3");
    expect(normalizeModel("smile-3")).toBe("smile3");
    expect(normalizeModel("SMILE  iv")).toBe("smile4");
    expect(normalizeModel("Bébé Confort Sunlite")).toBe("bebeconfortsunlite");
  });

  it("leaves single letters alone", () => {
    expect(normalizeModel("Smile V")).toBe("smilev");
  });
});

describe("isInRange", () => {
  it("compares by month and includes boundary months", () => {
    expect(isInRange("2020-03", "2019-09-01", "2020-05-31")).toBe(true);
    expect(isInRange("2019-09", "2019-09-15", "2020-05-31")).toBe(true);
    expect(isInRange("2020-06", "2019-09-01", "2020-05-31")).toBe(false);
  });

  it("supports open-ended ranges", () => {
    expect(isInRange("2030-01", "2022-01-01", null)).toBe(true);
    expect(isInRange("2021-12", "2022-01-01", null)).toBe(false);
    expect(isInRange("2010-01", null, "2020-05-31")).toBe(true);
    expect(isInRange("2020-06", null, "2020-05-31")).toBe(false);
  });
});

describe("decideVerdict · Britax Smile (22625, per-model ranges)", () => {
  it("Smile III with label 03/2020 is recalled", () => {
    const result = decideVerdict({
      item: { ...smileIII, productionDate: "2020-03", sources: { productionDate: "label_photo" } },
      candidate: candidate(britax22625),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("recalled");
    expect(result.recall).toEqual({ id: "rc:22625", relation: "match" });
    expect(result.evidence).toContainEqual({
      fact: "Made 03/2020, inside the recalled period (09/2019 to 05/2020)",
      matched: true,
      source: "label_photo",
    });
  });

  it("Smile III without a date needs the label", () => {
    const result = decideVerdict({ item: smileIII, candidate: candidate(britax22625), photo: noPhoto });
    expect(result.verdict).toBe("check_label");
    expect(result.recall?.relation).toBe("match");
  });

  it("Smile III made 07/2021 is clear, with a note about the other dates", () => {
    const result = decideVerdict({
      item: { ...smileIII, productionDate: "2021-07" },
      candidate: candidate(britax22625),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("clear");
    expect(result.recall).toEqual({ id: "rc:22625", relation: "other_dates" });
    expect(result.notes).toEqual(["This model has a recall for units made 09/2019 to 05/2020."]);
  });

  it("uses the Smile 4 range for a Smile 4, not the Smile III one", () => {
    expect(
      decideVerdict({ item: { ...smile4, productionDate: "2023-03" }, candidate: candidate(britax22625), photo: noPhoto })
        .verdict,
    ).toBe("recalled");
    expect(
      decideVerdict({ item: { ...smile4, productionDate: "2020-03" }, candidate: candidate(britax22625), photo: noPhoto })
        .verdict,
    ).toBe("clear");
  });

  it("matches the model when the listing writes the numeral as a digit", () => {
    const result = decideVerdict({
      item: { ...smileIII, model: "smile 3", productionDate: "2020-01" },
      candidate: candidate(britax22625),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("recalled");
  });
});

describe("decideVerdict · Hamax Buddy (open-ended range from 2022-01-01)", () => {
  it("unknown date needs the label", () => {
    expect(decideVerdict({ item: buddy, candidate: candidate(hamaxBuddy), photo: noPhoto }).verdict).toBe("check_label");
  });

  it("05/2023 is recalled", () => {
    const result = decideVerdict({ item: { ...buddy, productionDate: "2023-05" }, candidate: candidate(hamaxBuddy), photo: noPhoto });
    expect(result.verdict).toBe("recalled");
    expect(result.evidence).toContainEqual({
      fact: "Made 05/2023, inside the recalled period (from 01/2022)",
      matched: true,
      source: "listing_text",
    });
  });

  it("06/2021 is clear", () => {
    const result = decideVerdict({ item: { ...buddy, productionDate: "2021-06" }, candidate: candidate(hamaxBuddy), photo: noPhoto });
    expect(result.verdict).toBe("clear");
    expect(result.notes).toEqual(["This model has a recall for units made from 01/2022."]);
  });

  it("code 4091054 without a date still needs the label: codes identify the model, not the date", () => {
    const result = decideVerdict({
      item: item({ brand: "Hamax", brandNorm: "hamax", references: ["4091054"] }),
      candidate: candidate(hamaxBuddy),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("check_label");
  });
});

describe("decideVerdict · other rules", () => {
  it("a barcode match identifies the product, but a date limit still needs the label", () => {
    const result = decideVerdict({ item: item({ gtin: "0070297755203498" }), candidate: candidate(hamaxBuddy), photo: noPhoto });
    expect(result.verdict).toBe("check_label");
    expect(result.evidence[0]).toEqual({
      fact: "Barcode 0070297755203498 is listed in the recall",
      matched: true,
      source: "listing_text",
    });
    expect(
      decideVerdict({ item: item({ gtin: "70297755203498", productionDate: "2023-05" }), candidate: candidate(hamaxBuddy), photo: noPhoto })
        .verdict,
    ).toBe("recalled");
  });

  it("a barcode match on a batch-limited recall with an unknown batch needs the label", () => {
    const withBarcode = { ...toyWithBatches, gtins: ["3417761234567"] };
    const result = decideVerdict({
      item: item({ gtin: "3417761234567", sources: { gtin: "barcode" } }),
      candidate: candidate(withBarcode),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("check_label");
    expect(result.evidence).toContainEqual({ fact: "Barcode 3417761234567 is listed in the recall", matched: true, source: "barcode" });
  });

  it("a barcode match on a recall with no limit is recalled, even without brand or model", () => {
    const withBarcode = { ...boonPivot, gtins: ["0048526011437"] };
    expect(decideVerdict({ item: item({ gtin: "48526011437" }), candidate: candidate(withBarcode), photo: noPhoto }).verdict).toBe(
      "recalled",
    );
  });

  it("a reference on a recall with no date or batch limit is recalled", () => {
    const result = decideVerdict({
      item: item({ brand: "Boon", brandNorm: "boon", references: ["B11437"] }),
      candidate: candidate(boonPivot),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("recalled");
    expect(result.evidence).toContainEqual({ fact: "Every unit of this model is recalled", matched: true, source: "official_data" });
  });

  it("a listed batch is recalled, another batch is clear, no batch needs the label", () => {
    const toy = item({ brand: "VTech", brandNorm: "vtech", model: "Hochet musical" });
    expect(decideVerdict({ item: { ...toy, batch: "l2024 118" }, candidate: candidate(toyWithBatches), photo: noPhoto }).verdict).toBe(
      "recalled",
    );
    expect(decideVerdict({ item: { ...toy, batch: "L2023-001" }, candidate: candidate(toyWithBatches), photo: noPhoto }).verdict).toBe(
      "clear",
    );
    expect(decideVerdict({ item: toy, candidate: candidate(toyWithBatches), photo: noPhoto }).verdict).toBe("check_label");
  });

  it("a range with only an end date", () => {
    const upTo2020 = { ...hamaxBuddy, productionFrom: null, productionTo: "2020-05-31" };
    expect(decideVerdict({ item: { ...buddy, productionDate: "2019-01" }, candidate: candidate(upTo2020), photo: noPhoto }).verdict).toBe(
      "recalled",
    );
    expect(decideVerdict({ item: { ...buddy, productionDate: "2021-01" }, candidate: candidate(upTo2020), photo: noPhoto }).verdict).toBe(
      "clear",
    );
  });

  it("photo comparison 'no' is clear, even with a matching date", () => {
    const result = decideVerdict({
      item: { ...smileIII, productionDate: "2020-03" },
      candidate: candidate(britax22625),
      photo: { sameProduct: "no" },
    });
    expect(result.verdict).toBe("clear");
    expect(result.recall).toEqual({ id: "rc:22625", relation: "not_a_match" });
  });

  it("an unrelated brand is clear, with the closest recall shown as not a match", () => {
    const result = decideVerdict({
      item: item({ brand: "Ikea", brandNorm: "ikea", model: "Antilop" }),
      candidate: { recall: britax22625, titleSimilarity: 0.3, brandSimilarity: 0.1 },
      photo: noPhoto,
    });
    expect(result.verdict).toBe("clear");
    expect(result.recall?.relation).toBe("not_a_match");
  });

  it("no candidate at all is clear and says what was searched", () => {
    const result = decideVerdict({ item: item({ brand: "Ikea", model: "Antilop" }), candidate: null, photo: noPhoto });
    expect(result).toEqual({
      verdict: "clear",
      recall: null,
      evidence: [{ fact: "No official recall matches Ikea Antilop", matched: false, source: "official_data" }],
      notes: [],
    });
  });

  it("a high title similarity counts as a model match when the model name differs", () => {
    const result = decideVerdict({
      item: { ...buddy, model: "Buddy siège enfant", productionDate: "2024-02" },
      candidate: candidate(hamaxBuddy, 0.62),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("recalled");
  });

  it("the same brand with another model is clear", () => {
    const result = decideVerdict({
      item: item({ brand: "Hamax", brandNorm: "hamax", model: "Caress" }),
      candidate: candidate(hamaxBuddy, 0.3),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("clear");
    expect(result.evidence).toContainEqual({ fact: "Model Caress is not named in the recall", matched: false, source: "listing_text" });
  });

  it("notes an unavailable official photo without failing", () => {
    const result = decideVerdict({
      item: { ...buddy, productionDate: "2023-05" },
      candidate: candidate(hamaxBuddy),
      photo: { sameProduct: null, officialPhotoUnavailable: true },
    });
    expect(result.verdict).toBe("recalled");
    expect(result.evidence).toContainEqual({ fact: "Official photo unavailable", matched: false, source: "official_data" });
  });
});
