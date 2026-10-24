import { describe, expect, it } from "vitest";
import type { Recall } from "../../db/schema";
import type { ExtractedItem } from "./extract";
import { panelSummary, productTitle } from "./panel";
import { panelSummaryFr } from "./panel-fr";

const hamax = {
  id: "rc:23843",
  source: "rappelconso",
  sourceRef: "2026-10-0171",
  url: "https://rappel.conso.gouv.fr/fiche-rappel/23843/interne",
  publishedAt: "2026-10-19",
  brand: "hamax",
  brandNorm: "hamax",
  productName: "porte-bébé hamax buddy",
  models: ["buddy"],
  refs: ["4091054", "8591602"],
  gtins: ["70297755203498"],
  batches: [],
  sampleBatches: [],
  productionFrom: "2022-01-01",
  productionTo: "2026-08-06",
  modelRanges: [],
  risk: "étouffement",
  whatToDo: "contacter le point de vente",
  raw: { identification_produits: ["70297755203498", "non concerné"] },
} as unknown as Recall;

const bebeConfort = {
  ...hamax,
  id: "rc:22017",
  productName: "siège auto bébé des sunlite duo, breeze trio et brume trio",
  refs: ["1146077210", "1146153210", "1982085210", "1982153210"],
  gtins: ["3220660344840"],
  batches: ["inférieur ou égal à 1038653"],
  productionFrom: null,
  productionTo: null,
  risk: "blessures",
  whatToDo: "ne plus utiliser le produit\ncontacter le service consommateur",
  raw: { identification_produits: ["3220660344840", "numéro de lot (visible sur l’emballage et sur le produit) inférieur ou égal à 1038653"] },
} as unknown as Recall;

function extracted(overrides: Partial<ExtractedItem>): ExtractedItem {
  return {
    category: null, brand: null, model: null, modelVariant: null, references: [], gtin: null, batch: null,
    productionDate: null, labelTextSeen: null, confidence: 0.9, quotes: [], sources: {}, ...overrides,
  };
}

const searched = { total: 14433, sources: ["rappelconso", "safetygate"] };
const buddy = extracted({ brand: "HAMAX", model: "BUDDY", category: "Child bike seat" });

describe("productTitle", () => {
  it("cases the brand and model as read and adds the product type", () => {
    expect(productTitle(buddy, hamax, "Siège enfant HAMAX BUDDY")).toBe("Hamax Buddy child bike seat");
    expect(productTitle(extracted({ brand: "britax römer", model: "smile iii" }), null, "x")).toBe("Britax Römer Smile III");
  });

  it("falls back to the recall's name, then to the listing title", () => {
    expect(productTitle(extracted({}), hamax, "Siège")).toBe("Porte-bébé hamax buddy");
    expect(productTitle(extracted({}), null, "Chaise haute")).toBe("Chaise haute");
  });
});

describe("panelSummary", () => {
  it("check_label: the recalled dates and codes, the risk, the source and the seller message", () => {
    const panel = panelSummary({ verdict: "check_label", recall: hamax, extracted: buddy, listingTitle: "Siège enfant HAMAX BUDDY", searched });
    expect(panel).toMatchObject({
      title: "Hamax Buddy child bike seat",
      risk: "Risk: choking",
      source: { label: "RappelConso · 19 Oct 2026", url: hamax.url },
      lookFor: ["Recalled if made between 01/2022 and 08/2026", "Codes 4091054 / 8591602"],
      whatToDo: [],
    });
    expect(panel.sellerMessage).toBe(
      "Hello, I'm interested in your Hamax Buddy. Some production dates of this model are recalled. Could you send me a photo of the label showing the production date? Thanks!",
    );
  });

  it("quotes where the notice says the number is, and shortens long code lists", () => {
    const panel = panelSummary({ verdict: "check_label", recall: bebeConfort, extracted: extracted({ brand: "Bébé Confort", model: "Breeze" }), listingTitle: "Cosy", searched });
    expect(panel.lookFor).toEqual([
      "Batches: up to 1038653",
      "Codes 1146077210 / 1146153210 / 1982085210 and 1 more",
      'The notice says the number is "visible sur l’emballage et sur le produit"',
    ]);
  });

  it("recalled: what the notice tells owners to do, and no seller message", () => {
    const panel = panelSummary({ verdict: "recalled", recall: bebeConfort, extracted: extracted({ brand: "Bébé Confort", model: "Breeze" }), listingTitle: "Cosy", searched });
    expect(panel.whatToDo).toEqual(["Stop using the product", "Contact customer service"]);
    expect(panel.risk).toBe("Risk: injury");
    expect(panel.sellerMessage).toBeNull();
  });

  it("clear next to a close recall: says why it isn't a match and links the notice", () => {
    const panel = panelSummary({
      verdict: "clear",
      recall: bebeConfort,
      evidence: [
        { fact: "Not this recall: the recall is for a car seat, this is a stroller", matched: false, source: "listing_text" },
        { fact: "Brand Bébé Confort matches the recall", matched: true, source: "listing_text" },
      ],
      extracted: extracted({ brand: "Bébé Confort", model: "Breeze", category: "stroller" }),
      listingTitle: "Poussette Breeze",
      searched,
    });
    expect(panel.line).toBe(
      "A recall for Siège auto bébé des sunlite duo, breeze trio et brume trio came close. The recall is for a car seat, this is a stroller.",
    );
    expect(panel.source?.url).toBe(bebeConfort.url);
    expect(panel.lookFor).toEqual([]);
  });

  it("clear: one line saying what was searched, never that it's safe", () => {
    const panel = panelSummary({ verdict: "clear", recall: null, extracted: extracted({ brand: "Safety 1st", category: "high chair" }), listingTitle: "Chaise haute", searched });
    expect(panel).toMatchObject({ title: "Safety 1st high chair", risk: null, source: null, lookFor: [], sellerMessage: null });
    expect(panel.line).toBe("Vetted searched 14,433 French and EU recalls for Safety 1st and found no match. That doesn't prove it's safe.");
    const unbranded = panelSummary({ verdict: "clear", recall: null, extracted: extracted({ category: "High chair" }), listingTitle: "Chaise haute", searched });
    expect(unbranded.line).toContain("recalls for this high chair and found no match");
  });

  it("says when the recall is for another part of the named model", () => {
    const panel = panelSummary({
      verdict: "clear",
      recall: { ...bebeConfort, productName: "Siège auto bébé des sunlite duo" },
      evidence: [
        { fact: "Not this recall: the recall is for a car seat, this is a stroller", matched: false, source: "listing_text" },
        { fact: "The recall covers the car seat of the Sunlite; if this stroller comes with one, check that car seat's label", matched: false, source: "official_data" },
      ],
      extracted: extracted({ brand: "Bébé Confort", model: "Sunlite" }),
      listingTitle: "Poussette Sunlite",
      searched,
    });
    expect(panel.line).toBe(
      "A recall for Siège auto bébé des sunlite duo came close. The recall covers the car seat of the Sunlite; if this stroller comes with one, check that car seat's label.",
    );
  });
});

describe("panelSummaryFr", () => {
  it("check_label in French, with the French seller message", () => {
    const panel = panelSummaryFr({ verdict: "check_label", recall: hamax, extracted: buddy, listingTitle: "Siège enfant HAMAX BUDDY", searched });
    expect(panel).toMatchObject({
      title: "Hamax Buddy",
      line: "Seules certaines unités de ce modèle sont rappelées. Vérifiez l'étiquette avant d'acheter.",
      lookFor: ["Rappelé si fabriqué entre 01/2022 et 08/2026", "Codes 4091054 / 8591602"],
    });
    expect(panel.source?.label).toMatch(/^RappelConso · 19 oct\.? 2026$/);
    expect(panel.sellerMessage).toContain("Bonjour, votre Hamax Buddy m'intéresse.");
  });

  it("clear in French says what was searched", () => {
    const panel = panelSummaryFr({ verdict: "clear", recall: null, extracted: extracted({ brand: "Safety 1st" }), listingTitle: "Chaise haute", searched });
    expect(panel.line.replace(/\s/g, " ")).toBe(
      "Vetted a cherché « Safety 1st » parmi 14 433 rappels français et européens sans trouver de correspondance. Cela ne prouve pas que le produit est sûr.",
    );
  });
});
