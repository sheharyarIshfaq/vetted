import { sourceLabel } from "@/lib/check/copy";
import type { Evidence } from "@/lib/verdict";

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

export function EvidenceList({ items }: { items: Evidence[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface px-5 py-5 sm:px-6">
      <h2 className="m-0 text-lg font-bold">Why Tiko says so</h2>
      <ol className="m-0 flex list-none flex-col p-0">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-3.5 border-t border-line py-2.5 last:border-b">
            <span
              aria-hidden="true"
              className={`flex size-[26px] shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                item.matched ? "bg-brand-soft text-safe" : "bg-recalled-soft text-recalled"
              }`}
            >
              {item.matched ? "✓" : "!"}
            </span>
            <span className="sr-only">{item.matched ? "Matches:" : "Does not match:"}</span>
            <span className="min-w-0 grow">
              <Fact text={item.fact} />
            </span>
            <span className="shrink-0 text-right text-[13px] text-muted">{sourceLabel(item.source)}</span>
          </li>
        ))}
      </ol>
      <p className="m-0 text-[13px] leading-normal text-muted">
        AI reads the listing and compares photos. The verdict comes from the official recall data and fixed rules.
      </p>
    </section>
  );
}
