import type { Verdict } from "../verdict";

export type Outcome = {
  id: string;
  expected: Verdict;
  expectedRecallId: string | null;
  verdict: Verdict | null; // null when the check failed
  recallId: string | null;
  alsoMatched: string[];
};

export const VERDICTS: Verdict[] = ["recalled", "check_label", "clear"];

const isFlag = (verdict: Verdict | null) => verdict === "recalled" || verdict === "check_label";

// The same recall may be published by both sources; either notice names the right product.
function namesExpectedRecall(outcome: Outcome) {
  const { expectedRecallId } = outcome;
  return !expectedRecallId || outcome.recallId === expectedRecallId || outcome.alsoMatched.includes(expectedRecallId);
}

export function isCorrect(outcome: Outcome) {
  if (outcome.verdict !== outcome.expected) return false;
  return outcome.expected === "clear" || namesExpectedRecall(outcome);
}

export function mistake(outcome: Outcome) {
  if (outcome.verdict === null) return "check failed";
  if (isFlag(outcome.expected) && !isFlag(outcome.verdict)) return "missed recall";
  if (!isFlag(outcome.expected) && isFlag(outcome.verdict)) return "false flag";
  if (!namesExpectedRecall(outcome)) return "wrong recall";
  return "wrong verdict";
}

export function score(outcomes: readonly Outcome[]) {
  const confusion = Object.fromEntries(
    VERDICTS.map((expected) => [expected, { recalled: 0, check_label: 0, clear: 0, failed: 0 }]),
  ) as Record<Verdict, Record<Verdict | "failed", number>>;
  for (const outcome of outcomes) confusion[outcome.expected][outcome.verdict ?? "failed"]++;

  // A flag is either recalled or check_label; it only counts as right when it names the expected recall.
  const flagged = outcomes.filter((outcome) => isFlag(outcome.verdict));
  const expectedFlags = outcomes.filter((outcome) => isFlag(outcome.expected));
  const rightFlags = flagged.filter((outcome) => isFlag(outcome.expected) && namesExpectedRecall(outcome));
  const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole);

  return {
    total: outcomes.length,
    correct: outcomes.filter(isCorrect).length,
    confusion,
    precision: ratio(rightFlags.length, flagged.length),
    recall: ratio(rightFlags.length, expectedFlags.length),
    flagged: flagged.length,
    expectedFlags: expectedFlags.length,
    rightFlags: rightFlags.length,
    wrong: outcomes.filter((outcome) => !isCorrect(outcome)),
  };
}

export type Score = ReturnType<typeof score>;

const percent = (value: number | null) => (value === null ? "n/a" : `${Math.round(value * 100)}%`);

// Ids, verdicts and counts only: the listings themselves stay out of the repository.
export function reportMarkdown(result: Score, counts: { excluded: number; unlabelled: number }, date: string) {
  const lines = [
    "# Evaluation",
    "",
    `Run on ${date}. ${result.total} labelled listings scored; ${counts.excluded} excluded, ${counts.unlabelled} not labelled.`,
    "",
    `- Correct: ${result.correct} of ${result.total} (${percent(result.total ? result.correct / result.total : null)})`,
    `- Flag precision: ${percent(result.precision)} (${result.rightFlags} of ${result.flagged} flags name the expected recall)`,
    `- Flag recall: ${percent(result.recall)} (${result.rightFlags} of ${result.expectedFlags} expected flags found)`,
    "",
    "Flags are recalled and check_label verdicts. Rows are the expected verdict, columns what Vetted said.",
    "",
    "| expected \\ got | recalled | check_label | clear | failed |",
    "|---|---:|---:|---:|---:|",
    ...VERDICTS.map((expected) => {
      const row = result.confusion[expected];
      return `| ${expected} | ${row.recalled} | ${row.check_label} | ${row.clear} | ${row.failed} |`;
    }),
    "",
    "## Wrong cases",
    "",
  ];
  if (result.wrong.length === 0) lines.push("None.");
  else {
    lines.push("| id | mistake | expected | expected recall | got | got recall |", "|---|---|---|---|---|---|");
    for (const outcome of result.wrong) {
      lines.push(
        `| ${outcome.id} | ${mistake(outcome)} | ${outcome.expected} | ${outcome.expectedRecallId ?? ""} | ${outcome.verdict ?? "failed"} | ${outcome.recallId ?? ""} |`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

const BASELINE_HEADING = "## Before fixes";

// A recorded earlier run is carried over unchanged, so a new run never overwrites the numbers it is compared with.
export function withBaseline(report: string, previous: string | null) {
  const at = previous?.indexOf(BASELINE_HEADING) ?? -1;
  return at === -1 ? report : `${report}\n${previous!.slice(at)}`;
}
