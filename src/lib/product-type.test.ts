import { describe, expect, it } from "vitest";
import { productType } from "./product-type";

describe("productType", () => {
  it("reads the type from a recall's French product name", () => {
    expect(productType("siège auto bébé des sunlite duo, breeze trio et brume trio")).toBe("car seat");
    expect(productType("Siège de voiture")).toBe("car seat");
    expect(productType("châssis de poussette smile iii, smile 4 et smile 5z")).toBe("stroller");
    expect(productType("Base pour siège auto")).toBe("car seat base");
  });

  it("reads the type from the listing's category", () => {
    expect(productType("stroller")).toBe("stroller");
    expect(productType("car seat")).toBe("car seat");
    expect(productType("child bike seat")).toBe("bike seat");
    expect(productType("car seat base")).toBe("car seat base");
  });

  it("stays unknown when nothing or several types are named", () => {
    expect(productType("porte-bébé hamax buddy")).toBeNull();
    expect(productType("toy")).toBeNull();
    expect(productType("stroller with car seat")).toBeNull();
    expect(productType(null)).toBeNull();
  });
});
