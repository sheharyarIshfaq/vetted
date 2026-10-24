import { describe, expect, it } from "vitest";
import {
  detailsText,
  fallbackModels,
  groupByFiche,
  splitIdentification,
  splitImages,
  toRecall,
} from "./rappelconso";
import { britaxSmileRow, hamaxBuddyRow } from "./rappelconso.fixtures";

describe("splitIdentification", () => {
  it("separates barcodes from other identifiers and drops 'non concerné'", () => {
    expect(splitIdentification(hamaxBuddyRow.identification_produits)).toEqual({
      gtins: ["70297755203498"],
      identifiers: [],
    });
    expect(splitIdentification(britaxSmileRow.identification_produits)).toEqual({
      gtins: [],
      identifiers: ["4000984-204346, -204377, -204384"],
    });
  });

  it("reads several products separated by '|'", () => {
    expect(
      splitIdentification(["5027148039315", "batch n°10154", "non concerné", "|8053634016260", "coussi carotte", "non concerné"]),
    ).toEqual({ gtins: ["5027148039315", "8053634016260"], identifiers: ["batch n°10154", "coussi carotte"] });
  });

  it("does not treat over-long numbers as barcodes", () => {
    expect(splitIdentification(["78077001761000000"]).gtins).toEqual([]);
  });
});

describe("splitIdentification · barcodes inside text", () => {
  it("keeps a barcode with a valid check digit and the text for parsing", () => {
    expect(splitIdentification(["r23189 mascot car turquoise 8904001231895", "non concerné"])).toEqual({
      gtins: ["8904001231895"],
      identifiers: ["r23189 mascot car turquoise 8904001231895"],
    });
  });

  it("ignores numbers that fail the check digit, such as phone numbers or references", () => {
    expect(splitIdentification(["service client 0612345678, référence 8904001231896"]).gtins).toEqual([]);
  });
});

describe("splitImages", () => {
  it("splits on pipes and spaces", () => {
    expect(splitImages("https://a.jpg|https://b.jpg https://c.jpg")).toEqual(["https://a.jpg", "https://b.jpg", "https://c.jpg"]);
    expect(splitImages(null)).toEqual([]);
  });
});

describe("groupByFiche", () => {
  it("keeps the latest version and merges barcodes and images", () => {
    const update = {
      ...hamaxBuddyRow,
      id: 23900,
      numero_version: 2,
      identification_produits: ["7029775520351", "non concerné"],
      liens_vers_les_images: "https://rappel.conso.gouv.fr/image/new.jpg",
    };
    const groups = groupByFiche([hamaxBuddyRow, update, britaxSmileRow]);
    expect(groups).toHaveLength(2);
    const hamax = groups.find((group) => group.row.numero_fiche === "2026-10-0171")!;
    expect(hamax.row.id).toBe(23900);
    expect(hamax.gtins).toEqual(["70297755203498", "7029775520351"]);
    expect(hamax.images).toHaveLength(3);
    expect(hamax.rows).toHaveLength(2);
  });
});

describe("detailsText", () => {
  it("joins the free-text fields and turns '¤' into line breaks", () => {
    const [group] = groupByFiche([hamaxBuddyRow]);
    expect(detailsText(group)).toBe(
      "modele buddy code 4091054 / 8591602 avec les dates de fabrication entre le 01/01/2022 et le 06/08/2026.",
    );
  });

  it("includes identifiers that are not barcodes", () => {
    const [group] = groupByFiche([britaxSmileRow]);
    expect(detailsText(group)).toContain("4000984-204346");
  });
});

describe("fallbackModels", () => {
  it("uses the product name without the brand", () => {
    expect(fallbackModels(hamaxBuddyRow)).toEqual(["porte-bébé buddy"]);
  });
});

describe("toRecall", () => {
  it("maps a parsed recall to the recalls table", () => {
    const [group] = groupByFiche([hamaxBuddyRow]);
    const recall = toRecall(
      group,
      {
        models: ["buddy"],
        refs: ["4091054", "8591602"],
        batches: [],
        productionFrom: "2022-01-01",
        productionTo: "2026-08-06",
        modelRanges: [],
        quote: "dates de fabrication entre le 01/01/2022 et le 06/08/2026",
      },
      "hamax",
    );
    expect(recall).toMatchObject({
      id: "rc:23843",
      source: "rappelconso",
      sourceRef: "2026-10-0171",
      url: "https://rappel.conso.gouv.fr/fiche-rappel/23843/interne",
      publishedAt: "2026-10-19",
      brandNorm: "hamax",
      productName: "porte-bébé hamax buddy",
      models: ["buddy"],
      refs: ["4091054", "8591602"],
      gtins: ["70297755203498"],
      productionFrom: "2022-01-01",
      productionTo: "2026-08-06",
      soldFrom: "2022-01-01",
      soldTo: "2026-08-06",
      risk: "étouffement",
      whatToDo: "contacter le point de vente",
      searchText: "hamax porte bebe hamax buddy buddy 4091054 8591602",
    });
    expect(recall.images).toHaveLength(2);
  });

  it("falls back to the product name and no range without parsed details", () => {
    const [group] = groupByFiche([britaxSmileRow]);
    const recall = toRecall(group, null, "britax romer");
    expect(recall.id).toBe("rc:22625");
    expect(recall.models).toEqual(["châssis de poussette smile iii, smile 4 et smile 5z"]);
    expect(recall.productionFrom).toBeNull();
    expect(recall.modelRanges).toEqual([]);
    expect(recall.whatToDo).toBe("ne plus utiliser le produit\ncontacter le service consommateur");
  });
});
