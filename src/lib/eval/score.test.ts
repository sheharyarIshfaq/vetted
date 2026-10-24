import { describe, expect, it } from "vitest";
import { isCorrect, mistake, reportMarkdown, score, type Outcome } from "./score";

const outcome = (overrides: Partial<Outcome>): Outcome => ({
  id: "lbc-001",
  expected: "check_label",
  expectedRecallId: "rc:23843",
  verdict: "check_label",
  recallId: "rc:23843",
  alsoMatched: [],
  ...overrides,
});

describe("isCorrect", () => {
  it("needs the verdict and, for a flag, the expected recall", () => {
    expect(isCorrect(outcome({}))).toBe(true);
    expect(isCorrect(outcome({ recallId: "rc:1" }))).toBe(false);
    expect(isCorrect(outcome({ verdict: "recalled" }))).toBe(false);
  });

  it("accepts the same recall from the second source", () => {
    expect(isCorrect(outcome({ expectedRecallId: "sg:OR/00070/26", recallId: "rc:22017", alsoMatched: ["sg:OR/00070/26"] }))).toBe(true);
  });

  it("ignores the recall on a clear verdict", () => {
    expect(isCorrect(outcome({ expected: "clear", expectedRecallId: null, verdict: "clear", recallId: "rc:22625" }))).toBe(true);
  });
});

describe("mistake", () => {
  it("names the kind of error", () => {
    expect(mistake(outcome({ verdict: "clear", recallId: null }))).toBe("missed recall");
    expect(mistake(outcome({ expected: "clear", expectedRecallId: null }))).toBe("false flag");
    expect(mistake(outcome({ recallId: "rc:1" }))).toBe("wrong recall");
    expect(mistake(outcome({ verdict: "recalled" }))).toBe("wrong verdict");
    expect(mistake(outcome({ verdict: null, recallId: null }))).toBe("check failed");
  });
});

describe("score", () => {
  const outcomes = [
    outcome({ id: "a" }),
    outcome({ id: "b", verdict: "recalled" }),
    outcome({ id: "c", verdict: "clear", recallId: null }),
    outcome({ id: "d", expected: "clear", expectedRecallId: null, verdict: "check_label", recallId: "rc:9" }),
    outcome({ id: "e", expected: "clear", expectedRecallId: null, verdict: "clear", recallId: null }),
    outcome({ id: "f", verdict: null, recallId: null }),
  ];
  const result = score(outcomes);

  it("fills the confusion table by expected and given verdict", () => {
    expect(result.confusion.check_label).toEqual({ recalled: 1, check_label: 1, clear: 1, failed: 1 });
    expect(result.confusion.clear).toEqual({ recalled: 0, check_label: 1, clear: 1, failed: 0 });
  });

  it("counts a flag as right when it names the expected recall, whatever its level", () => {
    expect(result.precision).toBeCloseTo(2 / 3);
    expect(result.recall).toBeCloseTo(2 / 4);
    expect(result.correct).toBe(2);
    expect(result.wrong.map((o) => o.id)).toEqual(["b", "c", "d", "f"]);
  });

  it("has no ratio without flags", () => {
    expect(score([]).precision).toBeNull();
  });
});

describe("reportMarkdown", () => {
  it("writes only ids, verdicts, recall ids and counts", () => {
    const report = reportMarkdown(score([outcome({ id: "lbc-009", verdict: "clear", recallId: null })]), { excluded: 4, unlabelled: 2 }, "2026-10-24");
    expect(report).toContain("1 labelled listings scored; 4 excluded, 2 not labelled.");
    expect(report).toContain("| lbc-009 | missed recall | check_label | rc:23843 | clear |  |");
  });
});
