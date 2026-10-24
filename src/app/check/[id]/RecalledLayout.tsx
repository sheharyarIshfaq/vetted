import { CopyMessageButton } from "@/components/check/CopyMessageButton";
import { EvidenceList } from "@/components/check/EvidenceList";
import { LabelRead } from "@/components/check/LabelRead";
import { ListingSummary } from "@/components/check/ListingSummary";
import { PhotoPair } from "@/components/check/PhotoPair";
import { ReportWrongMatch } from "@/components/check/ReportWrongMatch";
import { VerdictPanel } from "@/components/check/VerdictPanel";
import { eyebrow, headline, recalledSummary, sellerMessage, sourcesLabel } from "@/lib/check/copy";
import type { Recall } from "@/db/schema";
import type { RecallLimits } from "@/lib/verdict";
import { Breadcrumb } from "./Breadcrumb";
import type { LoadedCheck } from "./load-check";

type Props = { check: LoadedCheck & { recall: Recall; limits: RecallLimits } };

export function RecalledLayout({ check }: Props) {
  const { recall, limits, extracted } = check;
  return (
    <>
      <Breadcrumb>
        Checked {check.checkedAt} · against {check.stats.total.toLocaleString("en-GB")} {sourcesLabel(check.stats.sources)} recall
        entries
      </Breadcrumb>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <ListingSummary title={check.listingTitle} photo={check.listingPhoto} extracted={extracted} />
          {check.label && <LabelRead read={check.label.read} photo={check.labelPhoto} />}
        </div>
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <VerdictPanel
            verdict="recalled"
            eyebrow={eyebrow("recalled", recall.risk)}
            title={headline("recalled", extracted.category)}
            body={
              <>
                <PhotoPair listingPhoto={check.listingPhoto} officialPhoto={recall.images[0] ?? null} noticeRef={recall.sourceRef} />
                <div className="flex flex-wrap gap-2.5 px-5 pt-5 pb-[22px] sm:px-6">
                  <a
                    href={recall.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-[18px] py-3 text-[15px] font-bold text-white no-underline hover:text-white"
                  >
                    Read the official notice
                  </a>
                  <CopyMessageButton
                    label="Copy a message for the seller"
                    message={sellerMessage("recalled", check.sellerLabel, limits, recall.url)}
                  />
                  <ReportWrongMatch checkId={check.id} alreadyFlagged={check.flagged} />
                </div>
              </>
            }
          >
            <p className="m-0">
              {recalledSummary({
                brand: recall.brand,
                productLabel: check.productLabel,
                publishedAt: recall.publishedAt,
                limits,
                item: { productionDate: extracted.productionDate, batch: extracted.batch },
              })}
            </p>
            {recall.reason && (
              <p lang="fr" className="mt-2 mb-0 text-[15px] text-ink-2">
                <span className="text-muted">Official reason: </span>
                {recall.reason}
              </p>
            )}
          </VerdictPanel>
          <EvidenceList items={check.evidence.items} />
        </div>
      </div>
    </>
  );
}
