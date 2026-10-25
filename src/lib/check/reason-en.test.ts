import { describe, expect, it } from "vitest";
import { keepsNumbers } from "./reason-en";

describe("keepsNumbers", () => {
  it("accepts a translation that only uses the official figures", () => {
    expect(keepsNumbers("concentration de plomb jusqu'à 73,8 % en poids", "Lead up to 73.8% by weight.")).toBe(true);
    expect(keepsNumbers("une vis peut se desserrer", "A screw can come loose.")).toBe(true);
  });

  it("rejects a translation with a number the French doesn't have", () => {
    expect(keepsNumbers("une vis peut se desserrer", "A screw can come loose after 2 rides.")).toBe(false);
  });
});
