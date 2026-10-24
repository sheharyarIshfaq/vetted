import { EvidenceList } from "@/components/check/EvidenceList";
import { LabelRead } from "@/components/check/LabelRead";
import { ReportWrongMatch } from "@/components/check/ReportWrongMatch";
import { VerdictPanel } from "@/components/check/VerdictPanel";
import { WatchForm } from "@/components/check/WatchForm";
import { WhatToDo } from "@/components/check/WhatToDo";
import { capitalize, eyebrow, headline, searchedSummary } from "@/lib/check/copy";
import { Breadcrumb } from "./Breadcrumb";
import type { LoadedCheck } from "./load-check";

const SOURCE_NAMES = { rappelconso: "RappelConso", safetygate: "EU Safety Gate" } as const;

function Tile({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-divider p-3.5">
      <div className="font-mono text-xs tracking-[0.1em] text-muted uppercase">{label}</div>
      <div className={`mt-1 font-semibold break-words ${mono ? "font-mono" : ""}`}>{children}</div>
    </div>
  );
}

function ClosestRecall({ check }: { check: LoadedCheck }) {
  const { recall, evidence } = check;
  if (!recall) return <>None close enough</>;
  const label = evidence.relation === "other_dates" ? "same model, other dates" : "not a match";
  return (
    <a href={recall.url} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-brand">
      {capitalize(recall.productName)} · {label}
    </a>
  );
}

export function ClearLayout({ check }: { check: LoadedCheck }) {
  const { stats, extracted, evidence } = check;
  const searched = searchedSummary({ total: stats.total, sources: stats.sources, searchedFor: check.searchedFor });
  return (
    <>
      <Breadcrumb>{check.listingTitle}</Breadcrumb>
      <VerdictPanel
        verdict="clear"
        eyebrow={eyebrow("clear", null)}
        title={
          check.fromRecall
            ? evidence.relation === "other_dates"
              ? "Yours is outside the recalled units."
              : "Your label doesn't match this recall."
            : headline("clear", extracted.category)
        }
        body={
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              <Tile label="Searched">{stats.sources.map((source) => SOURCE_NAMES[source]).join(" + ") || "Official recall lists"}</Tile>
              <Tile label="Closest recall">
                <ClosestRecall check={check} />
              </Tile>
              {stats.updatedAt && (
                <Tile label="Data updated" mono>
                  {stats.updatedAt}
                </Tile>
              )}
            </div>
            {evidence.items.length > 0 && <EvidenceList items={evidence.items} verdict="clear" fromRecall={check.fromRecall} />}
            {!check.fromRecall && (
              <WhatToDo recall={check.recall} closest>
                Check its condition as you normally would.
              </WhatToDo>
            )}
          </>
        }
      >
        {evidence.notes.map((note) => (
          <p key={note} className="mt-0 mb-2">
            {note}
          </p>
        ))}
        <p className="m-0">
          {check.fromRecall ? "That's based on what your label shows. If in doubt, read the official notice." : searched}
        </p>
      </VerdictPanel>

      {check.label && <LabelRead read={check.label.read} photo={check.labelPhoto} />}

      <section
        aria-label="Watch this item"
        className="flex flex-wrap items-center gap-5 rounded-[22px] border border-line bg-surface p-[22px] sm:p-[26px]"
      >
        <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-1.5">
          <h2 className="m-0 text-xl font-semibold tracking-[-0.02em]">Bought it? Vetted can keep watching.</h2>
          <p className="m-0 text-[15px] leading-normal text-ink-2">
            Leave your email and we&apos;ll tell you if this model is recalled later.
          </p>
          <p className="m-0 text-[13px] text-muted">Email alerts are coming soon.</p>
        </div>
        <WatchForm brandNorm={extracted.brandNorm} model={[extracted.model, extracted.modelVariant].filter(Boolean).join(" ") || null} />
      </section>

      {check.recall && (
        <div className="flex">
          <ReportWrongMatch checkId={check.id} alreadyFlagged={check.flagged} />
        </div>
      )}
    </>
  );
}
