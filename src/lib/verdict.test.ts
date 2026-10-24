import { describe, expect, it } from "vitest";
import {
  decideBest,
  decideVerdict,
  isInRange,
  namesRecallModel,
  normalizeModel,
  type Candidate,
  type CandidateRecall,
  type ItemFacts,
  type PhotoComparison,
} from "./verdict";

const britax22625: CandidateRecall = {
  id: "rc:22625",
  source: "rappelconso",
  brand: "britax römer",
  brandNorm: "britax romer",
  productName: "châssis de poussette smile iii, smile 4 et smile 5z",
  models: ["smile iii", "smile 4", "smile 5z"],
  refs: ["4000984-204346"],
  gtins: [],
  batches: [],
  sampleBatches: [],
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
  source: "rappelconso",
  brand: "hamax",
  brandNorm: "hamax",
  productName: "porte-bébé hamax buddy",
  models: ["buddy"],
  refs: ["4091054", "8591602"],
  gtins: ["70297755203498"],
  batches: [],
  sampleBatches: [],
  productionFrom: "2022-01-01",
  productionTo: null,
  modelRanges: [],
};

const boonPivot: CandidateRecall = {
  id: "rc:boon",
  source: "rappelconso",
  brand: "boon",
  brandNorm: "boon",
  productName: "pivot",
  models: ["pivot"],
  refs: ["b11437", "b11578"],
  gtins: [],
  batches: [],
  sampleBatches: [],
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

  it("matches a reference whose numeral is written the other way", () => {
    const result = decideVerdict({
      item: item({ brand: "Britax", brandNorm: "britax romer", model: "King", references: ["King 2"] }),
      candidate: candidate({ ...britax22625, models: ["king ii"], refs: ["KING II"], modelRanges: [], productionFrom: null, productionTo: null }, 0.2),
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

  it("photo comparison 'no' can't clear a listing that names the recalled model: the label decides", () => {
    const result = decideVerdict({
      item: { ...smileIII, productionDate: "2020-03" },
      candidate: candidate(britax22625),
      photo: { sameProduct: "no" },
    });
    expect(result.verdict).toBe("check_label");
    expect(result.recall).toEqual({ id: "rc:22625", relation: "match" });
    expect(result.evidence).toContainEqual({
      fact: "Photos look different from the official photo, but the listing names the recalled model",
      matched: false,
      source: "listing_photo",
    });
  });

  it("photo comparison 'no' clears a match on the title alone, and says why first", () => {
    const result = decideVerdict({
      item: item({ brand: "Hamax", brandNorm: "hamax", title: "Siège vélo Hamax enfant" }),
      candidate: candidate(hamaxBuddy, 0.7),
      photo: { sameProduct: "no" },
    });
    expect(result.verdict).toBe("clear");
    expect(result.recall).toEqual({ id: "rc:23843", relation: "not_a_match" });
    expect(result.evidence[0]).toEqual({
      fact: "Not this recall: photos show a different product from the official photo",
      matched: false,
      source: "listing_photo",
    });
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

  it("a high title similarity counts as a model match when the recall names no model", () => {
    const result = decideVerdict({
      item: { ...buddy, model: "Siège enfant", productionDate: "2024-02" },
      candidate: candidate({ ...hamaxBuddy, models: [] }, 0.62),
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
    expect(result.evidence[0]).toEqual({ fact: "Not this recall: model Caress is not named in the recall", matched: false, source: "listing_text" });
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

describe("decideVerdict · batch list with dates (the batch decides)", () => {
  const cathy: CandidateRecall = {
    ...boonPivot,
    id: "rc:926",
    brand: "oli&carol",
    brandNorm: "oli carol",
    productName: "jouet de dentition cathy la carotte",
    models: ["cathy la carotte"],
    refs: [],
    batches: ["oc15"],
    productionFrom: "2017-01-01",
    productionTo: "2017-12-31",
  };
  const carrot = item({ brand: "Oli&Carol", brandNorm: "oli carol", model: "Cathy la carotte", productionDate: "2017-06" });

  it("a listed batch is recalled", () => {
    const result = decideVerdict({ item: { ...carrot, batch: "OC15" }, candidate: candidate(cathy), photo: noPhoto });
    expect(result.verdict).toBe("recalled");
  });

  it("a known batch that is not listed is clear, even inside the dates", () => {
    const result = decideVerdict({ item: { ...carrot, batch: "OC16" }, candidate: candidate(cathy), photo: noPhoto });
    expect(result.verdict).toBe("clear");
    expect(result.recall).toEqual({ id: "rc:926", relation: "other_dates" });
  });

  it("an unknown batch needs the label, even inside the dates", () => {
    const result = decideVerdict({ item: carrot, candidate: candidate(cathy), photo: noPhoto });
    expect(result.verdict).toBe("check_label");
    expect(result.evidence).toContainEqual({
      fact: "Batch number unknown; the recall covers some batches only",
      matched: false,
      source: "official_data",
    });
  });
});

describe("decideBest", () => {
  it("keeps the most serious outcome across candidates", () => {
    const result = decideBest({
      item: { ...buddy, productionDate: "2023-05" },
      candidates: [candidate(britax22625, 0.5), candidate(hamaxBuddy, 0.4)],
      photos: new Map(),
    });
    expect(result.verdict).toBe("recalled");
    expect(result.recall?.id).toBe("rc:23843");
  });

  it("lets a photo 'no' on the top candidate fall through to the next", () => {
    const second = { ...hamaxBuddy, id: "rc:buddy-2" };
    const result = decideBest({
      item: buddy,
      candidates: [candidate(hamaxBuddy), candidate(second)],
      photos: new Map([["rc:23843", { sameProduct: "no" as const }]]),
    });
    expect(result.verdict).toBe("check_label");
    expect(result.recall?.id).toBe("rc:buddy-2");
  });

  it("prefers 'other dates' over 'not a match' for a clear verdict, and the first on ties", () => {
    const result = decideBest({
      item: { ...smileIII, productionDate: "2021-07" },
      candidates: [candidate(hamaxBuddy, 0.3), candidate(britax22625, 0.3)],
      photos: new Map(),
    });
    expect(result.recall).toEqual({ id: "rc:22625", relation: "other_dates" });
  });

  it("names the nearest miss as the closest recall: the one that names the model, even with a photo 'no'", () => {
    const genericSeat: CandidateRecall = {
      ...bebeConfortSeat,
      id: "sg:OR/00070/26",
      source: "safetygate",
      productName: "Siège de voiture",
      models: [],
      refs: [],
      gtins: [],
      batches: [],
      modelRanges: [],
    };
    const result = decideBest({
      item: { ...bebeConfort, model: "Sunlite", category: "stroller", title: "Poussette Bébé Confort Sunlite" },
      candidates: [candidate(genericSeat, 0.3), candidate(bebeConfortSeat, 0.2)],
      photos: new Map([[bebeConfortSeat.id, { sameProduct: "no" as const }]]),
    });
    expect(result.verdict).toBe("clear");
    expect(result.recall).toEqual({ id: bebeConfortSeat.id, relation: "not_a_match" });
  });

  it("is clear with no recall when there are no candidates", () => {
    expect(decideBest({ item: buddy, candidates: [], photos: new Map() })).toMatchObject({ verdict: "clear", recall: null });
  });
});

describe("decideVerdict · unbranded recalls", () => {
  const teddy: CandidateRecall = {
    ...boonPivot,
    id: "sg:SR/01234/25",
    source: "safetygate",
    brand: null,
    brandNorm: null,
    productName: "peluche ours",
    models: [],
    refs: ["HX810"],
    gtins: ["5055944706841"],
    sampleBatches: ["C2024322"],
  };
  const plush = item({ model: "ours" });
  const yes: PhotoComparison = { sameProduct: "yes" };

  it("never matches on a similar title alone, even a very close one", () => {
    const result = decideVerdict({ item: plush, candidate: candidate(teddy, 0.9), photo: noPhoto });
    expect(result.verdict).toBe("clear");
    expect(result.recall?.relation).toBe("not_a_match");
  });

  it("doesn't match on a photo 'yes' without a shared code", () => {
    expect(decideVerdict({ item: plush, candidate: candidate(teddy, 0.9), photo: yes }).verdict).toBe("clear");
  });

  it("doesn't match on a shared code without a photo 'yes'", () => {
    const coded = item({ references: ["HX-810"] });
    expect(decideVerdict({ item: coded, candidate: candidate(teddy), photo: noPhoto }).verdict).toBe("clear");
    expect(decideVerdict({ item: coded, candidate: candidate(teddy), photo: { sameProduct: "unsure" } }).verdict).toBe("clear");
  });

  it("matches on a shared code and a photo 'yes'", () => {
    const coded = item({ model: "HX810" });
    expect(decideVerdict({ item: coded, candidate: candidate(teddy), photo: yes }).verdict).toBe("recalled");
  });

  it("matches on the barcode alone", () => {
    const scanned = item({ gtin: "5055944706841" });
    expect(decideVerdict({ item: scanned, candidate: candidate(teddy, 0.1), photo: noPhoto }).verdict).toBe("recalled");
  });

  it("doesn't let a placeholder brand on both sides count as a brand match", () => {
    const sansMarque = item({ brand: "Sans marque", brandNorm: null, model: "ours" });
    expect(decideVerdict({ item: sansMarque, candidate: candidate(teddy, 0.9), photo: noPhoto }).verdict).toBe("clear");
  });
});

describe("decideVerdict · Safety Gate sample batches", () => {
  const charger: CandidateRecall = {
    ...boonPivot,
    id: "sg:SR/00042/26",
    source: "safetygate",
    brand: "x-start",
    brandNorm: "x start",
    productName: "chargeur usb",
    models: [],
    refs: ["XS-20W"],
    sampleBatches: ["0371-27939196"],
  };
  const xstart = item({ brand: "X-Start", brandNorm: "x start", references: ["XS-20W"] });

  it("never limits the recall: another batch of the same model is still recalled", () => {
    const result = decideVerdict({ item: { ...xstart, batch: "9999" }, candidate: candidate(charger), photo: noPhoto });
    expect(result.verdict).toBe("recalled");
  });

  it("counts the sample batch as a match", () => {
    const result = decideVerdict({
      item: item({ brand: "X-Start", brandNorm: "x start", batch: "0371-27939196" }),
      candidate: candidate(charger, 0.1),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("recalled");
    expect(result.evidence).toContainEqual(expect.objectContaining({ fact: "Batch 0371-27939196 is the batch named in the alert" }));
  });
});

describe("decideBest · both sources", () => {
  const euBuddy: CandidateRecall = { ...hamaxBuddy, id: "sg:SR/00777/25", source: "safetygate", productionFrom: null };

  it("shows the RappelConso notice first and the EU alert as a second notice", () => {
    const result = decideBest({
      item: { ...buddy, productionDate: "2023-05" },
      candidates: [candidate(euBuddy, 0.6), candidate(hamaxBuddy, 0.4)],
      photos: new Map(),
    });
    expect(result.recall?.id).toBe("rc:23843");
    expect(result.alsoMatched).toEqual(["sg:SR/00777/25"]);
  });

  it("has no second notice when only one source matches", () => {
    const result = decideBest({ item: { ...buddy, productionDate: "2023-05" }, candidates: [candidate(hamaxBuddy)], photos: new Map() });
    expect(result.alsoMatched).toEqual([]);
  });
});

const bebeConfortBatch = ["inférieur ou égal à 1038653"];
const bebeConfortSeat: CandidateRecall = {
  id: "rc:22017",
  source: "rappelconso",
  brand: "bébé confort",
  brandNorm: "bebe confort",
  productName: "siège auto bébé des sunlite duo, breeze trio et brume trio",
  models: ["sunlite duo tinted grey", "sunlite duo mineral graphite", "breeze trio mineral grey", "brumetrio mineral graphite"],
  refs: ["1146077210", "1146153210", "1982085210", "1982153210"],
  gtins: ["3220660344840", "3220660344833", "3220660011391", "3220660011384"],
  batches: bebeConfortBatch,
  sampleBatches: [],
  productionFrom: null,
  productionTo: null,
  modelRanges: [
    { model: "sunlite duo tinted grey", from: null, to: null, refs: ["1146077210"], batches: bebeConfortBatch },
    { model: "breeze trio mineral grey", from: null, to: null, refs: ["1982085210"], batches: bebeConfortBatch },
  ],
};
const bebeConfort = item({ brand: "Bébé Confort", brandNorm: "bebe confort", model: "Breeze" });

describe("namesRecallModel", () => {
  const listing = (model: string | null, title: string | null = null) => ({ model, modelVariant: null, title });

  it("ignores pack and colour words in the recall's model", () => {
    expect(namesRecallModel("breeze trio mineral grey", "bebe confort", listing("Breeze"))).toBe(true);
    expect(namesRecallModel("sunlite duo tinted grey", "bebe confort", listing("Sunlite"))).toBe(true);
  });

  it("needs every distinctive word, so a bare or other model doesn't match", () => {
    expect(namesRecallModel("smile iii", "britax romer", listing("Smile"))).toBe(false);
    expect(namesRecallModel("smile iii", "britax romer", listing("Smile 2"))).toBe(false);
    expect(namesRecallModel("smile iii", "britax romer", listing("Smile 3"))).toBe(true);
    expect(namesRecallModel("familyfix slide pro base", "maxi cosi", listing("FamilyFix 360 Pro", "Base FamilyFix 360 Pro"))).toBe(false);
  });

  it("only goes from the recall to the listing", () => {
    expect(namesRecallModel("breeze", "bebe confort", listing("Breeze Trio Mineral Grey"))).toBe(true);
    expect(namesRecallModel("breeze trio duo", "bebe confort", listing("Trio"))).toBe(false);
  });

  it("finds words in the title, but numbers only in the model", () => {
    expect(namesRecallModel("buddy", "hamax", listing(null, "Porte bébé vélo Hamax Buddy"))).toBe(true);
    expect(namesRecallModel("smile iii", "britax romer", listing("Smile", "Poussette Britax Smile 3 roues"))).toBe(false);
  });

  it("leaves out the recall's brand and never matches on filler alone", () => {
    expect(namesRecallModel("porte-bébé hamax buddy", "hamax", listing("Porte-bébé Buddy"))).toBe(true);
    expect(namesRecallModel("trio mineral grey", "bebe confort", listing("Trio Mineral Grey"))).toBe(false);
  });
});

describe("decideVerdict · Bébé Confort car seat in Breeze and Sunlite packs (product types)", () => {
  it("the Breeze trio's car seat needs the label: the batch limit applies", () => {
    const result = decideVerdict({
      item: { ...bebeConfort, category: "car seat", title: "Cosy seul du trio Breeze Bébé Confort" },
      candidate: candidate(bebeConfortSeat),
      photo: { sameProduct: "yes" },
    });
    expect(result.verdict).toBe("check_label");
    expect(result.recall).toEqual({ id: "rc:22017", relation: "match" });
  });

  it("a Breeze stroller sold without the car seat is clear", () => {
    const result = decideVerdict({
      item: { ...bebeConfort, category: "stroller", title: "Poussette Breeze" },
      candidate: candidate(bebeConfortSeat, 0.7),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("clear");
    expect(result.evidence[0]).toEqual({ fact: "Not this recall: the recall is for a car seat, this is a stroller", matched: false, source: "listing_text" });
  });

  it("a Sunlite stroller is clear too", () => {
    const result = decideVerdict({
      item: { ...bebeConfort, model: "Sunlite", category: "stroller" },
      candidate: candidate(bebeConfortSeat),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("clear");
  });

  it("an unknown type on either side doesn't block the match", () => {
    const result = decideVerdict({
      item: { ...bebeConfort, category: "travel system" },
      candidate: candidate(bebeConfortSeat),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("check_label");
  });

  it("a barcode still identifies the product whatever the listing's type", () => {
    const result = decideVerdict({
      item: { ...bebeConfort, category: "stroller", gtin: "3220660011391" },
      candidate: candidate(bebeConfortSeat),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("check_label");
  });
});

describe("decideVerdict · Britax Smile models that aren't the Smile III", () => {
  it("a bare Smile is clear, even with a close title", () => {
    const result = decideVerdict({
      item: { ...smileIII, model: "Smile", category: "stroller" },
      candidate: candidate(britax22625, 0.7),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("clear");
  });

  it("a Smile 2 is clear", () => {
    const result = decideVerdict({
      item: { ...smileIII, model: "Smile 2", category: "stroller" },
      candidate: candidate(britax22625, 0.7),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("clear");
  });

  it("a Smile 3 stroller without a date needs the label", () => {
    const result = decideVerdict({
      item: { ...smileIII, model: "Smile 3", category: "stroller" },
      candidate: candidate(britax22625),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("check_label");
  });

  it("a Smile III car seat and base is not the recalled stroller frame", () => {
    const result = decideVerdict({
      item: { ...smileIII, category: "car seat" },
      candidate: candidate(britax22625),
      photo: noPhoto,
    });
    expect(result.verdict).toBe("clear");
  });
});

describe("decideVerdict · Ouxi V8 fatbike (Safety Gate, vehicle types)", () => {
  const ouxiV8: CandidateRecall = {
    id: "sg:A12/02611/24",
    source: "safetygate",
    brand: "Ouxi",
    brandNorm: "ouxi",
    productName: "Vélo électrique",
    models: [],
    refs: ["V8"],
    gtins: [],
    batches: [],
    sampleBatches: [],
    productionFrom: null,
    productionTo: null,
    modelRanges: [],
  };
  const listing = item({
    brand: "Ouxi",
    brandNorm: "ouxi",
    model: "V8",
    modelVariant: "Ultra Max",
    category: "electric bicycle",
    title: "Fatbike Ouxi V8 Ultra Max vélo électrique neuf",
  });

  it("an e-bike, a fatbike and a motor vehicle are one type", () => {
    const result = decideVerdict({ item: { ...listing, modelVariant: null }, candidate: candidate(ouxiV8, 0.67), photo: noPhoto });
    expect(result.verdict).toBe("recalled");
    expect(result.evidence).toContainEqual({ fact: "Model V8 is named in the recall", matched: true, source: "listing_text" });
  });

  it("a variant the alert doesn't name is check_label, even when the photos differ", () => {
    for (const photo of [noPhoto, { sameProduct: "no" as const }]) {
      const result = decideVerdict({ item: listing, candidate: candidate(ouxiV8, 0.67), photo });
      expect(result.verdict).toBe("check_label");
      expect(result.recall).toEqual({ id: "sg:A12/02611/24", relation: "match" });
      expect(result.evidence).toContainEqual({
        fact: "The recall names the V8; it doesn't say whether the V8 Ultra Max is included",
        matched: false,
        source: "official_data",
      });
      expect(result.evidence).toContainEqual({ fact: "Model V8 is named in the recall", matched: true, source: "listing_text" });
    }
  });

  it("a clear verdict never stands on matching evidence alone", () => {
    const result = decideVerdict({
      item: { ...listing, model: "X5", modelVariant: null, title: "Vélo électrique Ouxi X5" },
      candidate: candidate(ouxiV8, 0.6),
      photo: { sameProduct: "no" },
    });
    expect(result.verdict).toBe("clear");
    expect(result.evidence[0].matched).toBe(false);
    expect(result.evidence[0].fact).toMatch(/^Not this recall: /);
  });
});

describe("decideVerdict · electronics and mobility (long product names)", () => {
  const recallBase = { gtins: [], batches: [], sampleBatches: [], productionFrom: null, productionTo: null, modelRanges: [], refs: [] };
  const belkin: CandidateRecall = {
    ...recallBase,
    id: "rc:20518",
    source: "rappelconso",
    brand: "belkin",
    brandNorm: "belkin",
    productName: "batterie externe boostcharge usb-c pd power bank 20k (bpb002)",
    models: ["batterie externe boostcharge usb-c pd power bank 20k (bpb002)"],
    gtins: ["745883797622"],
  };
  const acer: CandidateRecall = {
    ...recallBase,
    id: "rc:21110",
    source: "rappelconso",
    brand: "acer",
    brandNorm: "acer",
    productName: "trottinette électrique acer es series 5 (aes015)",
    models: ["trottinette électrique es series 5 (aes015)"],
  };
  const decathlon: CandidateRecall = {
    ...recallBase,
    id: "rc:22670",
    source: "rappelconso",
    brand: "btwin",
    brandNorm: "decathlon",
    productName: "trottinette électrique",
    models: ["sd500e", "md500e"],
    refs: ["5177606", "5244742"],
  };

  it("ignores product and spec words, and reads 20k as 20000", () => {
    const listing = item({
      brand: "Belkin",
      brandNorm: "belkin",
      model: "BoostCharge",
      category: "power bank",
      title: "Batterie externe Belkin BoostCharge 20000 mAh USB-C PD",
    });
    const result = decideVerdict({ item: listing, candidate: candidate(belkin, 0.66), photo: noPhoto });
    expect(result.verdict).toBe("recalled");
    expect(result.evidence).toContainEqual({ fact: "Model BoostCharge is named in the recall", matched: true, source: "listing_text" });
    const tenK = decideVerdict({ item: { ...listing, title: "Batterie externe Belkin BoostCharge 10000 mAh" }, candidate: candidate(belkin, 0.6), photo: noPhoto });
    expect(tenK.verdict).toBe("clear");
  });

  it("names the model before the brackets, and treats the bracketed code as a reference", () => {
    const named = item({ brand: "Acer", brandNorm: "acer", model: "ES Series 5", category: "electric scooter", title: "Trottinette électrique Acer ES Series 5" });
    expect(decideVerdict({ item: named, candidate: candidate(acer, 0.86), photo: noPhoto }).verdict).toBe("recalled");
    const coded = item({ brand: "Acer", brandNorm: "acer", references: ["AES015"], category: "electric scooter" });
    const result = decideVerdict({ item: coded, candidate: candidate(acer, 0.3), photo: noPhoto });
    expect(result.verdict).toBe("recalled");
    expect(result.evidence).toContainEqual({ fact: "Reference code is listed in the recall", matched: true, source: "listing_text" });
  });

  it("brand and product type with no model is check_label: ask the seller for the model", () => {
    const listing = item({ brand: "Btwin / Decathlon", brandNorm: "decathlon", category: "electric scooter", title: "Trottinette électrique Btwin / Decathlon" });
    const result = decideVerdict({ item: listing, candidate: candidate(decathlon, 0.38), photo: noPhoto });
    expect(result.verdict).toBe("check_label");
    expect(result.recall).toEqual({ id: "rc:22670", relation: "match" });
    expect(result.evidence).toContainEqual({
      fact: "This brand has a recalled e-scooter. Ask the seller for the exact model",
      matched: false,
      source: "official_data",
    });
  });

  it("but not for another type of the same brand, or another model, or a photo 'no'", () => {
    const bike = item({ brand: "Btwin", brandNorm: "decathlon", category: "electric bicycle", title: "Vélo électrique Btwin" });
    expect(decideVerdict({ item: bike, candidate: candidate(decathlon, 0.3), photo: noPhoto }).verdict).toBe("clear");
    const otherModel = item({ brand: "Decathlon", brandNorm: "decathlon", model: "R920E", category: "electric scooter" });
    expect(decideVerdict({ item: otherModel, candidate: candidate(decathlon, 0.4), photo: noPhoto }).verdict).toBe("clear");
    const scooter = item({ brand: "Decathlon", brandNorm: "decathlon", category: "electric scooter" });
    expect(decideVerdict({ item: scooter, candidate: candidate(decathlon, 0.4), photo: { sameProduct: "no" } }).verdict).toBe("clear");
  });
});
