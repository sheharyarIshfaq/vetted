import type { Recall } from "@/db/schema";

const NOTICE_NAMES: Record<string, string> = { rappelconso: "a RappelConso notice", safetygate: "an EU Safety Gate alert" };

export function SecondNotice({ recall }: { recall: Pick<Recall, "source" | "sourceRef" | "url"> | null }) {
  if (!recall) return null;
  return (
    <p className="m-0 text-sm text-ink-2">
      Also published as {NOTICE_NAMES[recall.source] ?? "an official notice"}:{" "}
      <a href={recall.url} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold">
        {recall.sourceRef}
      </a>
    </p>
  );
}
