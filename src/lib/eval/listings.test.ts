import { describe, expect, it } from "vitest";
import { cleanUrl, collectInputSchema, nextId, sourceOf, type EvalListing } from "./listings";

function listing(id: string): EvalListing {
  return { id, source: "x", collectedOn: "2026-10-24", title: "", description: "", photos: [], expected: null, expectedRecallId: null };
}

describe("collected listings", () => {
  it("drops tracking from the URL", () => {
    expect(cleanUrl("https://www.vinted.fr/items/123-poussette?referrer=catalog#photos")).toBe("https://www.vinted.fr/items/123-poussette");
  });

  it("names the marketplace", () => {
    expect(sourceOf("https://www.leboncoin.fr/ad/equipement_bebe/123")).toBe("leboncoin");
    expect(sourceOf("https://www.vinted.co.uk/items/1")).toBe("vinted");
    expect(sourceOf("https://www.example.com/a")).toBe("example.com");
  });

  it("numbers ids per source", () => {
    const listings = [listing("ex-001"), listing("lbc-001"), listing("lbc-007"), listing("vin-002")];
    expect(nextId(listings, "leboncoin")).toBe("lbc-008");
    expect(nextId(listings, "vinted")).toBe("vin-003");
    expect(nextId([], "example.com")).toBe("web-001");
  });

  it("accepts only https pages and images", () => {
    const input = { url: "https://www.leboncoin.fr/ad/1", title: "t", ogDescription: "", description: "", images: [] };
    expect(collectInputSchema.safeParse(input).success).toBe(true);
    expect(collectInputSchema.safeParse({ ...input, url: "http://localhost:3000/x" }).success).toBe(false);
    expect(collectInputSchema.safeParse({ ...input, images: ["file:///etc/passwd"] }).success).toBe(false);
  });
});
