import { monthNumber } from "@/lib/check/copy";
import type { LabelFacts } from "@/lib/check/label";
import { RemoteImage } from "./RemoteImage";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 font-mono text-[15px]">
      <span>{label}</span>
      <span className="text-right break-all">{value}</span>
    </div>
  );
}

export function LabelRead({ read, photo }: { read: LabelFacts; photo: string | null }) {
  return (
    <section aria-label="Vetted read on the label" className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
      {photo && <RemoteImage src={photo} alt="Your label photo" className="h-[230px] w-full rounded-[10px] bg-placeholder object-contain" />}
      <div className="flex flex-col gap-2">
        <div className="font-mono text-xs tracking-[0.1em] text-muted uppercase">Vetted read on the label</div>
        {read.references.length > 0 && <Row label="Code" value={read.references.join(", ")} />}
        {read.gtin && <Row label="Barcode" value={read.gtin} />}
        {read.batch && <Row label="Batch" value={read.batch} />}
        {read.productionDate && <Row label="Made" value={monthNumber(read.productionDate)} />}
      </div>
    </section>
  );
}
