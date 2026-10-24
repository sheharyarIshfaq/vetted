import { describe, expect, it } from "vitest";
import { batchInEnglish, remedyInEnglish } from "./official-text";

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
});
