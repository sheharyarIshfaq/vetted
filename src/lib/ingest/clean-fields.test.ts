import { describe, expect, it, vi } from "vitest";

vi.mock("../openai", () => ({ openai: () => null, openaiModel: () => "test-model" }));

const { fieldsInput, validateFields } = await import("./clean-fields");

const aliases = new Map([["belkin", "belkin"]]);
const belkin = {
  source: "rappelconso",
  brand: "belkin",
  productName: "batterie externe boostcharge usb-c pd power bank 20k (bpb002)",
  models: [],
  refs: [],
  category: null,
  raw: {
    marque_produit: "belkin",
    libelle: "batterie externe boostcharge usb-c pd power bank 20k (bpb002)",
    modeles_ou_references: "bpb002btbk¤bpb002btwh",
    categorie_produit: "appareils électriques, outils",
  },
};

describe("fieldsInput", () => {
  it("labels the identification fields, with RappelConso separators and HTML entities undone", () => {
    expect(fieldsInput(belkin)).toBe(
      [
        "Marque : belkin",
        "Libellé : batterie externe boostcharge usb-c pd power bank 20k (bpb002)",
        "Modèles ou références : bpb002btbk; bpb002btwh",
        "Catégorie : appareils électriques, outils",
      ].join("\n"),
    );
    const sg = { ...belkin, source: "safetygate", brand: "Home&amp;Marker", raw: { brand: "Home&amp;Marker", product: "Chaîne d'éclairage" } };
    expect(fieldsInput(sg)).toBe("Marque : Home&Marker\nProduit : Chaîne d'éclairage");
  });
});

describe("validateFields", () => {
  const text = fieldsInput(belkin);

  it("keeps values whose quote is in the input and contains them", () => {
    const clean = validateFields(
      text,
      {
        brand: { value: "Belkin", quote: "belkin" },
        productType: { value: "power bank", quote: "batterie externe" },
        modelNames: [{ value: "boostcharge", quote: "boostcharge usb-c pd" }],
        refs: [{ value: "bpb002", quote: "(bpb002)" }, { value: "BPB002BTBK", quote: "bpb002btbk" }],
        specs: [{ value: "20k", quote: "power bank 20k" }],
      },
      "belkin",
      aliases,
    );
    expect(clean).toEqual({
      brandClean: "belkin",
      brandCleanNorm: "belkin",
      productType: "power bank",
      modelNames: ["boostcharge"],
      codes: ["bpb002", "BPB002BTBK"],
      specs: ["20k"],
    });
  });

  it("drops values the input doesn't back, barcodes as codes, and placeholder brands", () => {
    const clean = validateFields(
      text,
      {
        brand: { value: "Anker", quote: "anker powercore" },
        productType: { value: "charger", quote: "chargeur mural" },
        modelNames: [{ value: "boostcharge pro", quote: "boostcharge usb-c" }],
        refs: [{ value: "745883797622", quote: "745883797622" }, { value: "bpb003", quote: "bpb002" }],
        specs: [],
      },
      "unspecified",
      aliases,
    );
    expect(clean).toEqual({ brandClean: null, brandCleanNorm: null, productType: null, modelNames: [], codes: [], specs: [] });
  });

  it("takes the brand from the text when the brand field is empty", () => {
    const noBrand = fieldsInput({ ...belkin, brand: null, raw: { ...belkin.raw, marque_produit: "" } });
    const clean = validateFields(
      noBrand,
      { brand: { value: "Belkin", quote: "boostcharge" }, productType: null, modelNames: [], refs: [], specs: [] },
      null,
      aliases,
    );
    expect(clean.brandClean).toBeNull();
    const named = fieldsInput({ ...belkin, brand: null, raw: { ...belkin.raw, marque_produit: "", libelle: "batterie externe belkin boostcharge" } });
    expect(validateFields(named, { brand: { value: "Belkin", quote: "belkin boostcharge" }, productType: null, modelNames: [], refs: [], specs: [] }, null, aliases).brandCleanNorm).toBe("belkin");
  });
});
