import { CopyMessageButton } from "@/components/check/CopyMessageButton";
import { EvidenceList } from "@/components/check/EvidenceList";
import { LabelRead } from "@/components/check/LabelRead";
import { LabelUpload } from "@/components/check/LabelUpload";
import { RemoteImage } from "@/components/check/RemoteImage";
import { ReportWrongMatch } from "@/components/check/ReportWrongMatch";
import { SecondNotice } from "@/components/check/SecondNotice";
import { VerdictPanel } from "@/components/check/VerdictPanel";
import { WhatToDo } from "@/components/check/WhatToDo";
import { checkLabelSummary, eyebrow, headline, labelTargets, sellerMessage } from "@/lib/check/copy";
import type { Recall } from "@/db/schema";
import { modelInDoubt, type Evidence, type RecallLimits } from "@/lib/verdict";
import { Breadcrumb } from "./Breadcrumb";
import type { LoadedCheck } from "./load-check";

type Props = { check: LoadedCheck & { recall: Recall; limits: RecallLimits } };

// "Matched on brand, model and photo." from the evidence that actually matched.
function matchedOn(items: Evidence[]) {
  const parts = [
    items.some((item) => item.matched && item.fact.startsWith("Barcode")) && "barcode",
    items.some((item) => item.matched && item.fact.startsWith("Brand")) && "brand",
    items.some((item) => item.matched && /^(Model|Reference|Listing title)/.test(item.fact)) && "model",
    items.some((item) => item.matched && item.source === "listing_photo") && "photo",
  ].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function CheckLabelLayout({ check }: Props) {
  const { recall, limits } = check;
  const missing = limits.batches.length
    ? "The batch number"
    : limits.from || limits.to
      ? "The production date"
      : "A reference code or barcode";
  const matched = matchedOn(check.evidence.items);
  return (
    <>
      <Breadcrumb>{check.listingTitle}</Breadcrumb>
      <VerdictPanel
        verdict="check_label"
        eyebrow={eyebrow("check_label", recall.risk)}
        title={check.fromRecall ? "Check your item's label." : headline("check_label", null)}
        body={
          <>
            <EvidenceList items={check.evidence.items} verdict="check_label" fromRecall={check.fromRecall} />
            <p className="m-0 text-[13px] text-muted">
              {matched ? `Matched on ${matched}. ` : ""}
              {missing} is the one thing Vetted still needs.
            </p>
            <WhatToDo recall={recall}>
              {check.fromRecall
                ? "Add a photo of your item's label below."
                : "Copy the French message Vetted writes and ask for a photo of the label."}
            </WhatToDo>
          </>
        }
      >
        <p className="m-0">
          {checkLabelSummary({
            brand: recall.brand,
            productLabel: check.productLabel,
            publishedAt: recall.publishedAt,
            limits,
            fromRecall: check.fromRecall,
          })}
        </p>
      </VerdictPanel>

      <div className="flex flex-wrap items-stretch gap-5">
        <section
          aria-label="The label photo"
          className="flex min-w-0 flex-[999_1_520px] flex-col gap-4 rounded-[22px] border border-line bg-surface p-[22px] sm:p-[26px]"
        >
          <h2 className="m-0 text-xl font-semibold tracking-[-0.02em]">{check.fromRecall ? "Your label photo" : "Step 2: the label photo"}</h2>
          {(recall.images[0] || (check.listingPhoto && !check.fromRecall)) && (
            <div className={check.listingPhoto && !check.fromRecall && recall.images[0] ? "grid grid-cols-2 gap-3 sm:gap-4" : "flex"}>
              {check.listingPhoto && !check.fromRecall && (
                <figure className="m-0 flex min-w-0 grow flex-col gap-2">
                  <RemoteImage
                    src={check.listingPhoto}
                    alt="Photo from the listing"
                    className="h-[200px] w-full rounded-[14px] border border-divider bg-surface object-contain"
                  />
                  <figcaption className="text-[13px] text-muted">In the listing</figcaption>
                </figure>
              )}
              {recall.images[0] && (
                <figure className="m-0 flex min-w-0 grow flex-col gap-2">
                  <RemoteImage
                    src={recall.images[0]}
                    alt={`Photo from notice ${recall.sourceRef}`}
                    className="h-[200px] w-full rounded-[14px] border border-divider bg-surface object-contain"
                  />
                  <figcaption className="text-[13px] text-muted">In the official notice</figcaption>
                </figure>
              )}
            </div>
          )}
          <div className="text-sm leading-normal text-ink-2">Vetted looks for these on the label:</div>
          <div className="rounded-xl bg-paper px-3.5 py-3 font-mono text-sm leading-relaxed text-ink">{labelTargets(limits)}</div>
          {check.label && <LabelRead read={check.label.read} photo={check.labelPhoto} />}
          <LabelUpload checkId={check.id} />
        </section>

        {check.fromRecall ? (
          <section
            aria-label="The official notice"
            className="flex min-w-0 flex-[1_1_340px] flex-col self-start gap-3.5 rounded-[22px] border border-line bg-surface p-[22px] sm:p-[26px]"
          >
            <h2 className="m-0 text-xl font-semibold tracking-[-0.02em]">If yours is affected</h2>
            <p className="m-0 text-[15px] leading-normal text-ink-2">Follow the steps in the official notice.</p>
            <a href={recall.url} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold">
              Read the official notice
            </a>
            <SecondNotice recall={check.secondRecall} />
          </section>
        ) : (
          <section
            aria-label="Ask the seller"
            className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5 rounded-[22px] border border-line bg-surface p-[22px] sm:p-[26px]"
          >
            <h2 className="m-0 text-xl font-semibold tracking-[-0.02em]">No photo yet? Ask the seller</h2>
            <div className="font-mono text-xs tracking-[0.1em] text-muted uppercase">Ready to paste, in French</div>
            <p lang="fr" className="m-0 rounded-2xl bg-paper p-4 text-[15px] leading-[1.55]">
              {sellerMessage("check_label", check.sellerLabel, limits, recall.url, modelInDoubt(check.evidence.items))}
            </p>
            <div className="self-start">
              <CopyMessageButton label="Copy message" variant="primary" message={sellerMessage("check_label", check.sellerLabel, limits, recall.url, modelInDoubt(check.evidence.items))} />
            </div>
            <a href={recall.url} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold">
              Read the official notice
            </a>
            <SecondNotice recall={check.secondRecall} />
          </section>
        )}
      </div>

      <div className="flex">
        <ReportWrongMatch checkId={check.id} alreadyFlagged={check.flagged} />
      </div>
    </>
  );
}
