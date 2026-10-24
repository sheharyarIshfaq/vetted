import { describe, expect, it } from "vitest";
import type { Recall } from "../../db/schema";
import { canCheckLabel, recallModels } from "./start-label";

function recall(overrides: Partial<Recall>): Recall {
  return {
    models: [],
    modelRanges: [],
    refs: [],
    gtins: [],
    batches: [],
    sampleBatches: [],
    productionFrom: null,
    productionTo: null,
    ...overrides,
  } as Recall;
}

describe("canCheckLabel", () => {
  it("is offered when dates or batches limit the recall", () => {
    expect(canCheckLabel(recall({ models: ["buddy"], productionFrom: "2022-01-01" }))).toBe(true);
    expect(canCheckLabel(recall({ batches: ["oc15"] }))).toBe(true);
  });

  it("is offered when codes tell apart a product the model doesn't name", () => {
    expect(canCheckLabel(recall({ refs: ["HX810"] }))).toBe(true);
    expect(canCheckLabel(recall({ models: ["a", "b"], gtins: ["5055944706841"] }))).toBe(true);
  });

  it("isn't offered when every unit of a single model is recalled", () => {
    expect(canCheckLabel(recall({ models: ["pivot"], refs: ["b11437"] }))).toBe(false);
    expect(canCheckLabel(recall({ models: ["pivot"] }))).toBe(false);
  });

  it("ignores sample batches, which never limit a recall", () => {
    expect(canCheckLabel(recall({ models: ["charger"], sampleBatches: ["0371"] }))).toBe(false);
  });
});

describe("recallModels", () => {
  it("lists ranged models first, once", () => {
    const ranged = recall({
      models: ["smile iii", "smile 4"],
      modelRanges: [{ model: "smile iii", from: "2019-09-01", to: "2020-05-31", refs: [], batches: [] }],
    });
    expect(recallModels(ranged)).toEqual(["smile iii", "smile 4"]);
  });
});
