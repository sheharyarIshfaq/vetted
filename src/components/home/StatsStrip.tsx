import { connection } from "next/server";
import { Suspense } from "react";
import { listsPhrase, sourceSplitPhrase } from "@/lib/check/copy";
import { countRecallsSince, recallStats } from "@/lib/db/recalls";
import { sinceDate } from "@/lib/ingest/dates";

const UPDATED_AT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

const EU_REPORT_URL =
  "https://commission.europa.eu/news-and-media/news/increased-action-against-dangerous-products-eu-2025-2026-03-09_en";

function Stat({ value, children }: { value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t-2 border-[#3A4E44] pt-3.5">
      <div className="text-[34px] font-extrabold">{value}</div>
      <div className="text-sm leading-[1.45] text-[#C9D1CC]">{children}</div>
    </div>
  );
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#9AA59F] underline hover:text-white">
      {children}
    </a>
  );
}

const Pending = () => <span className="text-[#C9D1CC]">…</span>;

async function LiveStats() {
  await connection();
  const [stats, thisWeek] = await Promise.all([recallStats(), countRecallsSince(sinceDate("7d"))]);
  if (stats.total === 0) return null;
  return (
    <>
      <Stat value={stats.total.toLocaleString("en-GB")}>
        official recalls Tiko checks against: {sourceSplitPhrase(stats.bySource)}
      </Stat>
      <Stat value={thisWeek.toLocaleString("en-GB")}>new recalls published in the last 7 days</Stat>
    </>
  );
}

async function LiveSources() {
  await connection();
  const stats = await recallStats();
  if (stats.total === 0) return null;
  const updated = stats.updatedAt ? `, updated ${UPDATED_AT.format(stats.updatedAt)}` : "";
  return (
    <>
      Recall counts: {listsPhrase(stats.sources)}
      {updated}.{" "}
    </>
  );
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
          <Suspense
            fallback={
              <>
                <Stat value={<Pending />}>official recalls Tiko checks against</Stat>
                <Stat value={<Pending />}>new recalls published in the last 7 days</Stat>
              </>
            }
          >
            <LiveStats />
          </Suspense>
          <Stat value="4,671">EU Safety Gate alerts in 2025, a record year</Stat>
        </div>
        <p className="m-0 w-full text-xs text-[#9AA59F]">
          <Suspense fallback={null}>
            <LiveSources />
          </Suspense>
          4,671: <SourceLink href={EU_REPORT_URL}>European Commission, March 2026</SourceLink>.
        </p>
      </div>
    </section>
  );
}
