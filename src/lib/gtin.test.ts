import { describe, expect, it } from "vitest";
import { isValidGtin } from "./gtin";

describe("isValidGtin", () => {
  it("accepts valid EAN-8, UPC-12, EAN-13 and GTIN-14", () => {
    expect(isValidGtin("96385074")).toBe(true);
    expect(isValidGtin("036000291452")).toBe(true);
    expect(isValidGtin("8904001231895")).toBe(true);
    expect(isValidGtin("10012345678902")).toBe(true);
  });

  it("rejects a wrong check digit, other lengths and non-digits", () => {
    expect(isValidGtin("8904001231896")).toBe(false);
    expect(isValidGtin("0612345678")).toBe(false);
    expect(isValidGtin("4091054")).toBe(false);
    expect(isValidGtin("89040012318a5")).toBe(false);
  });
});
