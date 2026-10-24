import { Suspense } from "react";
import { countRecalls } from "@/lib/db/recalls";

const CHILD_CATEGORY = "bébés-enfants (hors alimentaire)";

function Stat({ value, children }: { value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t-2 border-[#3A4E44] pt-3.5">
      <div className="text-[34px] font-extrabold">{value}</div>
      <div className="text-sm leading-[1.45] text-[#C9D1CC]">{children}</div>
    </div>
  );
}

async function ChildRecallCount() {
  return (await countRecalls(CHILD_CATEGORY)).toLocaleString("en-GB");
}

export function StatsStrip() {
  return (
    <section aria-label="Why it matters" className="bg-ink text-white">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-10 px-4 py-12 sm:px-6">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5">
          <div className="font-mono text-[13px] tracking-[0.06em] text-[#9FD4BC] uppercase">Why this matters</div>
          <p className="m-0 text-[26px] leading-[1.2] font-bold tracking-[-0.02em] text-balance sm:text-[30px]">
            Recall letters go to the first owner. Second-hand buyers never get them.
          </p>
        </div>
        <div className="grid min-w-0 flex-[1_1_520px] grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat value="321">Leboncoin results for a child bike seat recalled four days earlier (23 Oct 2026)</Stat>
          <Stat value="124">Leboncoin results for &ldquo;britax smile&rdquo;, mostly models recalled in June 2026 (23 Oct 2026)</Stat>
          <Stat
            value={
              <Suspense fallback={<span className="text-[#C9D1CC]">…</span>}>
                <ChildRecallCount />
              </Suspense>
            }
          >
            baby and child product entries in France&apos;s recall list
          </Stat>
        </div>
      </div>
    </section>
  );
}
