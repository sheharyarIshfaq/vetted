import { describe, expect, it } from "vitest";
import type { LabelReading } from "../ai/schemas";
import { groundLabel, mergeLabel } from "./label";
import type { StoredExtracted } from "./run";

const hamaxLabel: LabelReading = {
  labelText: "HAMAX BUDDY\nArt. no. 4091054\nLOT 23-118\nMFG 05/2023\nEN 14344",
  references: ["4091054"],
  gtin: null,
  batch: "23-118",
  productionDate: "2023-05",
  productionDateText: "MFG 05/2023",
};

const buddy: StoredExtracted = {
  category: "child bike seat",
  brand: "Hamax",
  brandNorm: "hamax",
  model: "Buddy",
  modelVariant: null,
  references: [],
  gtin: null,
  batch: null,
  productionDate: null,
  labelTextSeen: null,
  confidence: 0.9,
  quotes: [],
  sources: {},
};

describe("groundLabel", () => {
  it("keeps codes, batch and date printed on the label", () => {
    expect(groundLabel(hamaxLabel)).toEqual({
      references: ["4091054"],
      gtin: null,
      batch: "23-118",
      productionDate: "2023-05",
    });
  });

  it("accepts a two-digit year on the label", () => {
    const read = groundLabel({ ...hamaxLabel, labelText: "Date de fabrication : 05.23", productionDateText: "05.23" });
    expect(read.productionDate).toBe("2023-05");
  });

  it("drops values that are not in the text read from the label", () => {
    const read = groundLabel({ ...hamaxLabel, references: ["8591602"], batch: "L2024-1" });
    expect(read.references).toEqual([]);
    expect(read.batch).toBeNull();
  });

  it("drops a date without its source text, or with a year that doesn't match it", () => {
    expect(groundLabel({ ...hamaxLabel, productionDateText: null }).productionDate).toBeNull();
    expect(groundLabel({ ...hamaxLabel, productionDate: "2021-05" }).productionDate).toBeNull();
    expect(groundLabel({ ...hamaxLabel, productionDate: "May 2023" }).productionDate).toBeNull();
  });

  it("keeps a barcode only with a valid check digit", () => {
    expect(groundLabel({ ...hamaxLabel, gtin: "8904 0012 31895" }).gtin).toBe("8904001231895");
    expect(groundLabel({ ...hamaxLabel, gtin: "8904001231896" }).gtin).toBeNull();
  });
});

describe("mergeLabel", () => {
  it("lets the label replace the listing's values and marks them as read from the label", () => {
    const merged = mergeLabel(
      { ...buddy, references: ["4091054"], productionDate: "2021-01", sources: { productionDate: "listing_text" } },
      { references: ["4091054", "8591602"], gtin: null, batch: null, productionDate: "2023-05" },
    );
    expect(merged.references).toEqual(["4091054", "8591602"]);
    expect(merged.productionDate).toBe("2023-05");
    expect(merged.batch).toBeNull();
    expect(merged.sources).toEqual({ references: "label_photo", productionDate: "label_photo" });
  });
});
