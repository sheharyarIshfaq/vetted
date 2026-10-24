import { describe, expect, it } from "vitest";
import { productType, typesConflict } from "./product-type";

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

  it("reads e-bikes, scooters and other vehicles", () => {
    expect(productType("Fatbike Ouxi V8 Ultra Max vélo électrique neuf")).toBe("e-bike");
    expect(productType("electric bicycle")).toBe("e-bike");
    expect(productType("Vélo électrique")).toBe("e-bike");
    expect(productType("Véhicules à moteur")).toBe("motor vehicle");
    expect(productType("Trottinette électrique")).toBe("vehicle");
    expect(productType("cyclomoteur")).toBe("moped");
  });
});

describe("typesConflict", () => {
  it("separates clearly different products", () => {
    expect(typesConflict("stroller", "car seat")).toBe(true);
    expect(typesConflict("car seat base", "car seat")).toBe(true);
    expect(typesConflict("e-bike", "helmet")).toBe(true);
  });

  it("never separates a vehicle from its variants, or an unknown type", () => {
    expect(typesConflict("e-bike", "motor vehicle")).toBe(false);
    expect(typesConflict("e-scooter", "moped")).toBe(false);
    expect(typesConflict("vehicle", "e-bike")).toBe(false);
    expect(typesConflict("stroller", null)).toBe(false);
  });
});
