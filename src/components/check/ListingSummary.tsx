import { madeLabel, titleCase } from "@/lib/check/copy";
import type { StoredExtracted } from "@/lib/check/run";
import { RemoteImage } from "./RemoteImage";

type Props = { title: string; photo: string | null; extracted: StoredExtracted; fromRecall?: boolean };

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-[7px] text-[15px]">
      <span className="text-ink-2">{label}</span>
      <span className={`text-right ${mono ? "font-mono font-medium" : "font-semibold"}`}>{value}</span>
    </div>
  );
}

export function ListingSummary({ title, photo, extracted, fromRecall = false }: Props) {
  const model = [extracted.model, extracted.modelVariant].filter(Boolean).join(" ");
  return (
    <aside aria-label={fromRecall ? "Your item" : "The listing"} className="flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-line bg-surface">
      {photo && <RemoteImage src={photo} alt="Photo from the listing" className="h-60 w-full bg-placeholder object-cover" />}
      <div className="flex flex-col gap-3.5 p-[18px]">
        <div className="flex flex-col gap-1">
          <div className="text-[13px] text-muted">{fromRecall ? "Your item" : "The listing"}</div>
          <div className="text-lg leading-[1.3] font-bold break-words">{title}</div>
        </div>
        <div className="flex flex-col border-t border-line">
          <div className="pt-3 pb-1 text-[13px] text-muted">{fromRecall ? "From the recall and your label" : "What Vetted read"}</div>
          {extracted.category && <Row label="Category" value={titleCase(extracted.category)} />}
          {extracted.brand && <Row label="Brand" value={extracted.brand} />}
          {model && <Row label="Model" value={model} />}
          {extracted.references.length > 0 && <Row label="Reference" value={extracted.references.join(", ")} mono />}
          {extracted.gtin && <Row label="Barcode" value={extracted.gtin} mono />}
          {extracted.batch && <Row label="Batch" value={extracted.batch} mono />}
          {extracted.productionDate && (
            <Row label="Made" value={madeLabel(extracted.productionDate, extracted.sources.productionDate)} mono />
          )}
          {!extracted.brand && !model && <p className="m-0 py-2 text-[15px] text-ink-2">No brand or model could be read.</p>}
        </div>
      </div>
    </aside>
  );
}
