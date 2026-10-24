import { sourceLabel } from "@/lib/check/copy";
import { PART_OF_MODEL, type Evidence, type Verdict } from "@/lib/verdict";

// Dates and codes in a fact are official numbers, so they get the mono face.
function Fact({ text }: { text: string }) {
  return text.split(/(\b\d{2}\/\d{4}\b|\b\d{7,14}\b)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-mono">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

// A fact that doesn't match is a missing detail on a check-label verdict, or advice to check another part's label,
// and a difference otherwise.
// On a clear verdict a matching fact only explains why a recall came close, so its tick is grey, never green.
function markFor(item: Evidence, verdict: Verdict) {
  if (!item.matched) {
    return verdict === "check_label" || item.fact.startsWith(PART_OF_MODEL)
      ? { symbol: "!", className: "bg-check text-ink", label: "Not known:" }
      : { symbol: "×", className: "bg-recalled text-ink", label: "Does not match:" };
  }
  return verdict === "clear"
    ? { symbol: "✓", className: "bg-line text-ink-2", label: "Partly matches:" }
    : { symbol: "✓", className: "bg-safe text-ink", label: "Matches:" };
}

type Props = { items: Evidence[]; verdict: Verdict; fromRecall?: boolean };

export function EvidenceList({ items, verdict, fromRecall = false }: Props) {
  return (
    <section aria-labelledby="why" className="flex flex-col gap-3">
      <h2 id="why" className="m-0 font-mono text-xs font-normal tracking-[0.1em] text-muted uppercase">
        Why Vetted says so
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((item, i) => {
          const mark = markFor(item, verdict);
          return (
            <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.45]">
              <span aria-hidden="true" className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${mark.className}`}>
                {mark.symbol}
              </span>
              <span className="min-w-0 grow">
                <span className="sr-only">{mark.label} </span>
                <Fact text={item.fact} />
              </span>
              <span className="shrink-0 pt-0.5 text-right text-xs text-muted">{sourceLabel(item.source, fromRecall)}</span>
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-[13px] leading-normal text-muted">
        AI reads the listing and compares photos. The verdict comes from the official recall data and fixed rules.
      </p>
    </section>
  );
}
