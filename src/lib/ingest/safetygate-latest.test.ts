import { describe, expect, it } from "vitest";
import { isInScope, toRecall } from "./safetygate";
import { toAlert } from "./safetygate-latest";

// Trimmed from GET /public/api/notification/10119289?language=fr
const yardin = {
  id: 10119289,
  reference: "SR/03046/26",
  publicationDate: "2026-10-22T15:00:57.726Z",
  country: { name: "Germany" },
  product: {
    productCategory: { key: "product.category.childcare.articles.and.children.equipment", name: "CHILDCARE_ARTICLES" },
    professionalProduct: false,
    nameSpecific: "Auto-Close Baby Safety Gate YARDIN Treppenschutzgitter",
    brands: [{ brand: "YARDIN" }],
    modelTypes: [{ modelType: "85332025" }],
    batchNumbers: [],
    barcodes: [],
    photos: [{ id: 11238001, published: true }],
    versions: [{ language: { key: "FR" }, name: "Porte des escaliers", description: "Porte d'escalier blanche, taille 85-95, prix €35.99." }],
  },
  risk: {
    riskType: [
      { key: "riskType.entrapment", name: "ENTRAPMENT" },
      { key: "riskType.injuries", name: "INJURIES" },
    ],
    versions: [{ language: { key: "FR" }, riskDescription: "Les espaces dans la porte sont suffisamment grands." }],
  },
  measureTaken: { measures: [{ measureCategory: { key: "measure.category.recall.of.product.from.consumers", name: "PRODUCT_RECALL_FROM_CONSUMERS" } }] },
};

describe("toAlert", () => {
  it("reads an API alert like a weekly report entry", () => {
    const alert = toAlert(yardin)!;
    expect(alert).toMatchObject({
      caseNumber: "SR/03046/26",
      reference: "https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/10119289",
      category: "Articles de puériculture et équipement pour enfants",
      product: "Porte des escaliers",
      brand: "YARDIN",
      type_numberOfModel: "85332025",
      riskType: "Piégeage, Blessures",
      measures: "Rappel du produit auprès des consommateurs",
      type: "Consommateur",
      pictures: ["https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/11238001"],
      publishedAt: "2026-10-22",
      reportId: "",
    });
    expect(isInScope(alert)).toBe(true);
    expect(toRecall(alert, null, "yardin")).toMatchObject({ id: "sg:SR/03046/26", refs: ["85332025"], productName: "Porte des escaliers" });
  });

  it("names an unknown category after the product, the way the reports name 'Autres'", () => {
    const alert = toAlert({ ...yardin, product: { ...yardin.product, productCategory: { key: "product.category.other", name: "OTHER" } } })!;
    expect(alert.category).toBe("Autres - Porte des escaliers");
  });
});
