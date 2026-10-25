import { describe, expect, it } from "vitest";
import { batchInEnglish, remediesPhrase, remedyInEnglish, riskTerms, risksInEnglish } from "./official-text";

describe("official text in English", () => {
  it("translates the fixed RappelConso steps and leaves others as published", () => {
    expect(remedyInEnglish("ne plus utiliser le produit")).toBe("Stop using the product");
    expect(remedyInEnglish("Contacter le service consommateur")).toBe("Contact customer service");
    expect(remedyInEnglish("détruire le produit")).toBe("Destroy the product");
    expect(remedyInEnglish("Renvoyer le siège au fabricant")).toBe("Renvoyer le siège au fabricant");
  });

  it("translates batch limits and ranges", () => {
    expect(batchInEnglish("inférieur ou égal à 1038653")).toBe("up to 1038653");
    expect(batchInEnglish("inférieur ou égal  au 2105")).toBe("up to 2105");
    expect(batchInEnglish("de 180700001à 180700030")).toBe("180700001 to 180700030");
    expect(batchInEnglish("de 190700001 -190200036")).toBe("190700001 to 190200036");
    expect(batchInEnglish("tous les lots")).toBe("all batches");
    expect(batchInEnglish("L2020-55")).toBe("L2020-55");
  });

  it("joins the steps into one phrase only when every step is known", () => {
    expect(remediesPhrase("ne plus utiliser le produit\ncontacter le service consommateur")).toBe("stop using the product and contact customer service");
    expect(remediesPhrase("ne plus utiliser le produit\ncontacter le point de vente\ndétruire le produit")).toBe(
      "stop using the product, contact the shop and destroy the product",
    );
    expect(remediesPhrase("ne plus utiliser le produit\nRenvoyer le siège au fabricant")).toBeNull();
    expect(remediesPhrase(null)).toBeNull();
  });
});

describe("risks", () => {
  it("splits both sources' lists, but not a comma inside one risk", () => {
    expect(riskTerms("Risque chimique, Environnement")).toEqual(["risque chimique", "environnement"]);
    expect(riskTerms("étouffement|risque chimique")).toEqual(["étouffement", "risque chimique"]);
    expect(riskTerms("eléments traces métalliques (métaux lourds : plomb, mercure, cadmium...)")).toHaveLength(1);
  });

  it("labels every risk in English and keeps an unknown one as published", () => {
    expect(risksInEnglish("Environnement")).toEqual(["environmental"]);
    expect(risksInEnglish("Brûlures, Choc électrique, Incendie")).toEqual(["burn", "electric shock", "fire"]);
    expect(risksInEnglish("risque environnemental|environnement")).toEqual(["environmental"]);
    expect(risksInEnglish("Pseudomonas")).toEqual(["pseudomonas"]);
  });
});
