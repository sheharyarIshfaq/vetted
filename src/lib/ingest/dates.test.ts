import { describe, expect, it } from "vitest";
import { isIsoDate, sinceDate, toIsoDate } from "./dates";

describe("isIsoDate", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2020-05-31")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2023-02-29")).toBe(false);
    expect(isIsoDate("2020-5-31")).toBe(false);
    expect(isIsoDate("31/05/2020")).toBe(false);
  });
});

describe("toIsoDate", () => {
  it("takes the day from a timestamp", () => {
    expect(toIsoDate("2026-10-19T08:58:34+00:00")).toBe("2026-10-19");
    expect(toIsoDate("2022-01-01")).toBe("2022-01-01");
  });

  it("returns null for missing or invalid values", () => {
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate("bientôt")).toBeNull();
  });
});

describe("sinceDate", () => {
  it("counts days back from now", () => {
    expect(sinceDate("7d", new Date("2026-10-24T12:00:00Z"))).toBe("2026-10-17");
  });

  it("rejects other formats", () => {
    expect(() => sinceDate("1w")).toThrow();
  });
});
