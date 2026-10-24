import { describe, expect, it } from "vitest";
import type { ListingExtraction } from "../ai/schemas";
import { groundExtraction } from "./extract";

const empty: ListingExtraction = {
  category: null,
  brand: null,
  model: null,
  modelVariant: null,
  references: [],
  gtin: null,
  batch: null,
  productionDate: null,
  labelTextSeen: null,
  confidence: 0.5,
  quotes: [],
};

const britaxText = "Poussette Britax Römer Smile III châssis et siège\nFabriquée en mars 2020, très bon état.";

describe("groundExtraction", () => {
  it("keeps fields that appear in the listing text", () => {
    const item = groundExtraction(britaxText, {
      ...empty,
      category: "stroller",
      brand: "Britax Römer",
      model: "Smile III",
      productionDate: "2020-03",
      confidence: 0.9,
      quotes: [{ field: "productionDate", from: "text", text: "Fabriquée en mars 2020" }],
    });
    expect(item).toMatchObject({
      category: "stroller",
      brand: "Britax Römer",
      model: "Smile III",
      productionDate: "2020-03",
      sources: { productionDate: "listing_text" },
    });
  });

  it("drops values the listing does not support", () => {
    const item = groundExtraction(britaxText, {
      ...empty,
      brand: "Britax Römer",
      model: "Smile 4",
      productionDate: "2021-07",
      batch: "L2020-55",
      quotes: [{ field: "productionDate", from: "text", text: "made in July 2021" }],
    });
    expect(item.model).toBeNull();
    expect(item.productionDate).toBeNull();
    expect(item.batch).toBeNull();
    expect(item.sources).toEqual({});
  });

  it("keeps values read in a photo and marks them as such", () => {
    const item = groundExtraction("Siège vélo enfant", {
      ...empty,
      brand: "Hamax",
      model: "Buddy",
      gtin: "7029775520349",
      productionDate: "2023-05",
      references: ["4091054"],
      quotes: [
        { field: "brand", from: "photo", text: "HAMAX" },
        { field: "model", from: "photo", text: "BUDDY" },
        { field: "gtin", from: "photo", text: "7 029775 520349" },
        { field: "productionDate", from: "photo", text: "05/2023" },
        { field: "references", from: "photo", text: "Art. 4091054" },
      ],
    });
    expect(item).toMatchObject({
      brand: "Hamax",
      model: "Buddy",
      gtin: "7029775520349",
      productionDate: "2023-05",
      references: ["4091054"],
      sources: { gtin: "barcode", productionDate: "listing_photo", references: "listing_photo" },
    });
  });

  it("rejects malformed dates and barcodes", () => {
    const text = "Hamax Buddy, code barre 12345, fabriqué 2023";
    const item = groundExtraction(text, {
      ...empty,
      gtin: "12345",
      productionDate: "2023",
      quotes: [
        { field: "gtin", from: "text", text: "12345" },
        { field: "productionDate", from: "text", text: "fabriqué 2023" },
      ],
    });
    expect(item.gtin).toBeNull();
    expect(item.productionDate).toBeNull();
  });

  it("keeps only references that appear in the text", () => {
    const item = groundExtraction("Boon Pivot réf B11437", { ...empty, references: ["B11437", "B11578"] });
    expect(item.references).toEqual(["B11437"]);
    expect(item.sources.references).toBe("listing_text");
  });
});
