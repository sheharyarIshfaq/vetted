import { CopyMessageButton } from "@/components/check/CopyMessageButton";
import { EvidenceList } from "@/components/check/EvidenceList";
import { LabelRead } from "@/components/check/LabelRead";
import { ListingSummary } from "@/components/check/ListingSummary";
import { PhotoPair } from "@/components/check/PhotoPair";
import { ReportWrongMatch } from "@/components/check/ReportWrongMatch";
import { SecondNotice } from "@/components/check/SecondNotice";
import { VerdictPanel } from "@/components/check/VerdictPanel";
import { WhatToDo } from "@/components/check/WhatToDo";
import { buttonStyles } from "@/components/ui";
import { capitalize, eyebrow, headline, recalledSummary, sellerMessage, sourcesLabel } from "@/lib/check/copy";
import { remediesPhrase } from "@/lib/official-text";
import type { Recall } from "@/db/schema";
import type { RecallLimits } from "@/lib/verdict";
import { Breadcrumb } from "./Breadcrumb";
import type { LoadedCheck } from "./load-check";

type Props = { check: LoadedCheck & { recall: Recall; limits: RecallLimits } };

function nextStep(recall: Recall, fromRecall: boolean) {
  const steps = remediesPhrase(recall.whatToDo);
  if (fromRecall) return steps ? `The notice tells owners to ${steps}.` : "Follow the steps in the official notice.";
  return steps ? `Skip this one. The notice tells owners to ${steps}.` : "Skip this one, and read the official notice.";
}

export function RecalledLayout({ check }: Props) {
  const { recall, limits, extracted } = check;
  return (
    <>
      <Breadcrumb>
        Checked {check.checkedAt} · against {check.stats.total.toLocaleString("en-GB")} {sourcesLabel(check.stats.sources)} recall
        entries
      </Breadcrumb>
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <ListingSummary title={check.listingTitle} photo={check.listingPhoto} extracted={extracted} fromRecall={check.fromRecall} />
          {check.label && <LabelRead read={check.label.read} photo={check.labelPhoto} />}
        </div>
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <VerdictPanel
            verdict="recalled"
            eyebrow={eyebrow("recalled", recall.risk)}
            title={check.fromRecall ? "Yours is one of the recalled units." : headline("recalled", extracted.category)}
            body={
              <>
                <PhotoPair listingPhoto={check.listingPhoto} officialPhoto={recall.images[0] ?? null} noticeRef={recall.sourceRef} />
                <EvidenceList items={check.evidence.items} verdict="recalled" fromRecall={check.fromRecall} />
                <WhatToDo recall={recall}>{nextStep(recall, check.fromRecall)}</WhatToDo>
                <div className="flex flex-wrap gap-2.5">
                  <a href={recall.url} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.primary} min-h-11 text-[15px]`}>
                    Read the official notice
                  </a>
                  {!check.fromRecall && (
                    <CopyMessageButton
                      label="Copy a message for the seller"
                      message={sellerMessage("recalled", check.sellerLabel, limits, recall.url)}
                    />
                  )}
                  <ReportWrongMatch checkId={check.id} alreadyFlagged={check.flagged} />
                </div>
                <SecondNotice recall={check.secondRecall} />
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
              <p lang="fr" className="mt-2 mb-0 text-[15px]">
                <span lang="en" className="text-muted">Official reason: </span>
                {capitalize(recall.reason)}
              </p>
            )}
          </VerdictPanel>
        </div>
      </div>
    </>
  );
}
