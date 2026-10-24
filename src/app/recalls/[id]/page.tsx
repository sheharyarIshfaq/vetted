import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RemoteImage } from "@/components/check/RemoteImage";
import type { Recall } from "@/db/schema";
import { capitalize, monthNumber, numericDate, riskLabel, titleCase } from "@/lib/check/copy";
import { canCheckLabel, recallModels } from "@/lib/check/start-label";
import { getRecall } from "@/lib/db/recalls";
import { batchInEnglish, remedyInEnglish } from "@/lib/official-text";
import { SOURCE_BADGES, measuresTaken, type RecallSource } from "@/lib/recalls";
import { checkLabelForRecall } from "./actions";

export const metadata: Metadata = { title: "Recall · Vetted" };

// "09/2019 → 05/2020", "from 01/2022", "up to 05/2020"
function madeBetween(from: string | null, to: string | null) {
  if (from && to) return `${monthNumber(from)} → ${monthNumber(to)}`;
  if (from) return `from ${monthNumber(from)}`;
  if (to) return `up to ${monthNumber(to)}`;
  return "Dates not given";
}

function CheckLabelButton({ recall, model, label, variant }: { recall: Recall; model: string | null; label: string; variant: "button" | "link" }) {
  return (
    <form action={checkLabelForRecall}>
      <input type="hidden" name="recallId" value={recall.id} />
      {model && <input type="hidden" name="model" value={model} />}
      <button
        type="submit"
        className={
          variant === "button"
            ? "min-h-11 cursor-pointer rounded-[10px] border border-field bg-surface px-[18px] text-[15px] font-semibold text-ink"
            : "cursor-pointer border-0 bg-transparent p-0 text-[15px] font-semibold text-brand hover:text-brand-dark"
        }
      >
        {label}
      </button>
    </form>
  );
}

function Codes({ title, values, note }: { title: string; values: string[]; note?: string }) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="m-0 text-sm font-semibold text-muted">{title}</h3>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {values.map((value) => (
          <li key={value} className="rounded-md bg-[#F2F4F1] px-2 py-1 font-mono text-[13px] text-ink">
            {value}
          </li>
        ))}
      </ul>
      {note && <p className="m-0 text-[13px] text-muted">{note}</p>}
    </div>
  );
}

function Affected({ recall, labelCheck }: { recall: Recall; labelCheck: boolean }) {
  const hasDates = recall.productionFrom || recall.productionTo;
  const sold = recall.soldFrom || recall.soldTo;
  const models = recallModels(recall);
  const showModels = recall.modelRanges.length === 0 && (models.length > 0 || hasDates);
  const hasCodes = recall.refs.length + recall.gtins.length + recall.batches.length + recall.sampleBatches.length > 0;
  if (!recall.modelRanges.length && !showModels && !hasCodes && !sold) return null;

  return (
    <section aria-labelledby="affected" className="flex flex-col gap-4 rounded-[18px] border border-line bg-surface p-[22px]">
      <h2 id="affected" className="m-0 text-[22px] font-bold">
        Which ones are affected
      </h2>
      {recall.modelRanges.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-[15px]">
            <thead>
              <tr>
                <th scope="col" className="py-2 text-left text-[13px] font-semibold text-muted">Model</th>
                <th scope="col" className="py-2 text-left text-[13px] font-semibold text-muted">Made</th>
                <th scope="col" className="py-2 text-left text-[13px] font-semibold text-muted">
                  <span className="sr-only">Label check</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {recall.modelRanges.map((range) => (
                <tr key={range.model} className="border-t border-line">
                  <td className="py-2.5 font-semibold">{titleCase(range.model)}</td>
                  <td className="py-2.5 font-mono text-sm">
                    {range.from || range.to ? madeBetween(range.from, range.to) : "All production dates"}
                  </td>
                  <td className="py-2.5 text-right">
                    <CheckLabelButton recall={recall} model={range.model} label="Check the label" variant="link" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModels && (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
          {models.length > 0 && (
            <>
              <dt className="text-muted">Models</dt>
              <dd className="m-0 font-semibold">{models.map(titleCase).join(", ")}</dd>
            </>
          )}
          {hasDates && (
            <>
              <dt className="text-muted">Made</dt>
              <dd className="m-0 font-mono text-sm">{madeBetween(recall.productionFrom, recall.productionTo)}</dd>
            </>
          )}
        </dl>
      )}
      {recall.datesQuote && (
        <p className="m-0 text-sm text-ink-2">
          From the notice: <q lang="fr">{recall.datesQuote}</q>
        </p>
      )}
      {sold && (
        <p className="m-0 text-sm text-ink-2">
          Sold {recall.soldFrom ? `from ${numericDate(recall.soldFrom)} ` : ""}
          {recall.soldTo ? `to ${numericDate(recall.soldTo)}` : ""}.
        </p>
      )}
      <Codes title="Reference codes" values={recall.refs.filter((ref) => !recall.gtins.includes(ref))} />
      <Codes title="Barcodes" values={recall.gtins} />
      <Codes title="Recalled batches" values={recall.batches.map(batchInEnglish)} />
      <Codes
        title="Batch of the tested sample"
        values={recall.sampleBatches}
        note="This identifies the product the authorities tested. Other batches of the same product can be affected too."
      />
      {labelCheck && recall.modelRanges.length === 0 && (
        <p className="m-0 text-sm text-ink-2">A photo of your item&apos;s label tells Vetted whether yours is one of them.</p>
      )}
    </section>
  );
}

function EuAlert({ recall }: { recall: Recall }) {
  const measures = measuresTaken((recall.raw as { measures?: string }).measures);
  if (!recall.risk && measures.length === 0) return null;
  return (
    <section aria-labelledby="eu-alert" className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-[22px]">
      <h2 id="eu-alert" className="m-0 text-xl font-bold">
        From the EU alert
      </h2>
      <dl lang="fr" className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
        {recall.risk && (
          <>
            <dt className="text-muted" lang="en">
              Risk
            </dt>
            <dd className="m-0">{recall.risk}</dd>
          </>
        )}
        {measures.length > 0 && (
          <>
            <dt className="text-muted" lang="en">
              {measures.length > 1 ? "Measures taken" : "Measure taken"}
            </dt>
            <dd className="m-0">{measures.join(" · ")}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

async function RecallView({ params }: { params: PageProps<"/recalls/[id]">["params"] }) {
  const { id } = await params;
  const recall = await getRecall(decodeURIComponent(id));
  if (!recall) notFound();

  const source = recall.source as RecallSource;
  const name = capitalize(recall.productName);
  const brand = recall.brand && !recall.productName.toLowerCase().includes(recall.brand.toLowerCase()) ? titleCase(recall.brand) : null;
  const risk = riskLabel(recall.risk);
  const labelCheck = canCheckLabel(recall);
  const models = recallModels(recall);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted">
        <Link href="/recalls" className="font-semibold">
          Recent recalls
        </Link>
        <span aria-hidden="true">/</span>
        <span className="min-w-0 break-words">{brand ?? name}</span>
      </div>

      <div className="flex flex-wrap items-start gap-7">
        {recall.images[0] ? (
          <RemoteImage
            src={recall.images[0]}
            alt={`Photo from notice ${recall.sourceRef}`}
            className="h-[300px] min-w-0 flex-[1_1_320px] rounded-[18px] bg-placeholder object-contain sm:h-[340px]"
          />
        ) : (
          <div className="flex h-[200px] min-w-0 flex-[1_1_320px] items-center justify-center rounded-[18px] bg-placeholder text-sm text-muted">
            No photo in the official notice
          </div>
        )}
        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-3.5">
          <div className="flex flex-wrap gap-2">
            {risk && <span className="rounded-full bg-recalled-soft px-2.5 py-1 text-[13px] font-bold text-recalled-text">{capitalize(risk)}</span>}
            {recall.category && (
              <span className="rounded-full bg-[#ECEFEC] px-2.5 py-1 text-[13px] font-semibold text-ink-2">{capitalize(recall.category)}</span>
            )}
            <span className="rounded-full bg-[#ECEFEC] px-2.5 py-1 text-[13px] font-semibold text-ink-2">{SOURCE_BADGES[source]}</span>
          </div>
          <h1 className="m-0 text-[30px] leading-[1.1] font-extrabold tracking-[-0.03em] break-words sm:text-[38px]">
            {brand ? `${name} · ${brand}` : name}
          </h1>
          {recall.reason && (
            <p lang="fr" className="m-0 text-[17px] leading-[1.55] text-ink-2">
              {capitalize(recall.reason)}
            </p>
          )}
          <div className="font-mono text-sm text-ink-2">
            {source === "safetygate" ? "Alert" : "Notice"} {recall.sourceRef} · published {numericDate(recall.publishedAt)}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={recall.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-[18px] text-[15px] font-bold text-white no-underline hover:text-white"
            >
              Official notice
            </a>
            {labelCheck && recall.modelRanges.length === 0 && (
              <CheckLabelButton recall={recall} model={models.length === 1 ? models[0] : null} label="Check my item's label" variant="button" />
            )}
          </div>
        </div>
      </div>

      <Affected recall={recall} labelCheck={labelCheck} />
      {source === "safetygate" && <EuAlert recall={recall} />}

      <section aria-labelledby="what-to-do" className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-[22px]">
        <h2 id="what-to-do" className="m-0 text-xl font-bold">
          What to do
        </h2>
        {recall.whatToDo && (
          <div className="flex flex-col gap-1">
            <div className="text-[13px] text-muted">From the official notice</div>
            <ul className="m-0 flex flex-col gap-1 pl-5 text-[15px] leading-normal">
              {recall.whatToDo.split("\n").filter(Boolean).map((line) => (
                <li key={line}>{capitalize(remedyInEnglish(line.trim()))}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
          If you own one, follow the steps in the official notice. If you&apos;re buying second-hand, ask the seller for a photo
          of the label first.
        </p>
      </section>
    </>
  );
}

export default function RecallPage({ params }: PageProps<"/recalls/[id]">) {
  return (
    <div className="mx-auto flex max-w-[1160px] flex-col gap-[22px] px-4 pt-7 pb-14 sm:px-6">
      <Suspense fallback={<p className="m-0 text-ink-2">Loading the recall…</p>}>
        <RecallView params={params} />
      </Suspense>
    </div>
  );
}
