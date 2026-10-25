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
    expect(productType("Trottinette électrique")).toBe("e-scooter");
    expect(productType("Trottinette enfant")).toBe("scooter");
    expect(productType("Scooter auto-équilibrage (hoverboard)")).toBe("hoverboard");
    expect(productType("Hoverboard Blaupunkt 6.5 pouces")).toBe("hoverboard");
    expect(productType("Fatbike, cyclomoteur")).toBe("vehicle");
    expect(productType("cyclomoteur")).toBe("moped");
  });
});

describe("typesConflict", () => {
  it("separates clearly different products", () => {
    expect(typesConflict("stroller", "car seat")).toBe(true);
    expect(typesConflict("car seat base", "car seat")).toBe(true);
    expect(typesConflict("e-bike", "helmet")).toBe(true);
  });

  it("separates different electrical products and baby gear", () => {
    expect(typesConflict("power bank", "charger")).toBe(true);
    expect(typesConflict("stroller", "high chair")).toBe(true);
  });

  it("never separates a family, or a vague type from its kind", () => {
    expect(typesConflict("soft toy", "toy")).toBe(false);
    expect(typesConflict("lamp", "lighting chain")).toBe(false);
    expect(typesConflict("other electrical", "power bank")).toBe(false);
    expect(typesConflict("other", "stroller")).toBe(false);
    expect(typesConflict("bicycle", "e-bike")).toBe(false);
    expect(typesConflict("other electrical", "stroller")).toBe(true);
  });

  it("lets a plain toy be an electrical product, but not a soft toy", () => {
    expect(typesConflict("toy", "other electrical")).toBe(false);
    expect(typesConflict("other electrical", "ride-on toy")).toBe(false);
    expect(typesConflict("soft toy", "other electrical")).toBe(true);
  });

  it("never separates a vehicle from its variants, or an unknown type", () => {
    expect(typesConflict("e-bike", "motor vehicle")).toBe(false);
    expect(typesConflict("e-scooter", "moped")).toBe(false);
    expect(typesConflict("vehicle", "e-bike")).toBe(false);
    expect(typesConflict("stroller", null)).toBe(false);
  });
});
