import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RemoteImage } from "@/components/check/RemoteImage";
import { Lists } from "@/components/home/sources";
import { capitalize, numericDate, riskWord, titleCase } from "@/lib/check/copy";
import { listRecalls, recallStats } from "@/lib/db/recalls";
import {
  CATEGORY_GROUPS,
  SOURCE_BADGES,
  SOURCE_FILTERS,
  parseRecallFilters,
  recallFiltersHref,
  recallHref,
  type RecallFilters,
  type RecallSource,
} from "@/lib/recalls";

export const metadata: Metadata = { title: "Recent recalls · Vetted" };

const PAGE_SIZE = 24;

const UPDATED_AT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function Chip({ href, pressed, children }: { href: string; pressed: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={pressed ? "true" : undefined}
      className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-semibold no-underline ${
        pressed ? "bg-ink text-white hover:text-white" : "border border-field bg-surface text-ink hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function Filters({ filters }: { filters: RecallFilters }) {
  return (
    <div className="flex flex-col gap-3">
      <form action="/recalls" className="flex gap-2.5">
        {filters.category && <input type="hidden" name="category" value={filters.category} />}
        {filters.source && <input type="hidden" name="source" value={filters.source} />}
        <label htmlFor="recall-search" className="sr-only">
          Search recalls
        </label>
        <input
          id="recall-search"
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search a brand or product"
          className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-field bg-surface px-3.5 text-[15px]"
        />
        <button type="submit" className="min-h-11 cursor-pointer rounded-[10px] bg-ink px-4 text-[15px] font-bold text-white">
          Search
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <nav aria-label="Category" className="flex flex-wrap gap-1.5">
          <Chip href={recallFiltersHref(filters, { category: null })} pressed={filters.category === null}>
            All
          </Chip>
          {CATEGORY_GROUPS.map((group) => (
            <Chip key={group.key} href={recallFiltersHref(filters, { category: group.key })} pressed={filters.category === group.key}>
              {group.label}
            </Chip>
          ))}
        </nav>
        <nav aria-label="Source" className="flex flex-wrap gap-1.5">
          <Chip href={recallFiltersHref(filters, { source: null })} pressed={filters.source === null}>
            France and EU
          </Chip>
          {SOURCE_FILTERS.map((filter) => (
            <Chip key={filter.key} href={recallFiltersHref(filters, { source: filter.key })} pressed={filters.source === filter.key}>
              {filter.label}
            </Chip>
          ))}
        </nav>
      </div>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/recalls">["searchParams"] }) {
  const filters = parseRecallFilters(await searchParams);
  const { items, total } = await listRecalls({
    q: filters.q,
    group: CATEGORY_GROUPS.find((group) => group.key === filters.category) ?? null,
    source: SOURCE_FILTERS.find((filter) => filter.key === filters.source)?.source ?? null,
    page: filters.page,
    pageSize: PAGE_SIZE,
  });
  const first = (filters.page - 1) * PAGE_SIZE + 1;
  const last = first + items.length - 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Filters filters={filters} />
      {items.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-6">
          <p className="m-0 font-semibold">No recall matches these filters.</p>
          <p className="m-0 text-ink-2">
            That doesn&apos;t mean a product is safe. Try another spelling, or{" "}
            <Link href="/recalls" className="font-semibold">
              clear the filters
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-line bg-surface p-0">
          {items.map((recall) => {
            const brand = recall.brand && !recall.productName.toLowerCase().includes(recall.brand.toLowerCase()) ? titleCase(recall.brand) : null;
            const risk = riskWord(recall.risk);
            return (
              <li key={recall.id} className="border-t border-line first:border-t-0">
                <Link
                  href={recallHref(recall.id)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-ink no-underline hover:bg-paper hover:text-ink sm:px-[18px]"
                >
                  {recall.images[0] ? (
                    <RemoteImage src={recall.images[0]} alt="" className="size-16 shrink-0 rounded-[10px] bg-placeholder object-cover" />
                  ) : (
                    <div aria-hidden="true" className="size-16 shrink-0 rounded-[10px] bg-placeholder" />
                  )}
                  <div className="flex min-w-0 flex-[999_1_220px] flex-col gap-[3px]">
                    <div className="font-bold break-words">{capitalize(recall.productName)}</div>
                    <div className="text-sm text-ink-2">{[brand, risk && capitalize(risk)].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className="rounded-full bg-[#ECEFEC] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-ink-2">
                    {SOURCE_BADGES[recall.source as RecallSource]}
                  </span>
                  <span className="w-[90px] text-right font-mono text-[13px] text-ink-2">{numericDate(recall.publishedAt)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
          <span>
            Showing {first.toLocaleString("en-GB")}–{last.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")}, newest first.
            Each one links to its official notice.
          </span>
          <nav aria-label="Pages" className="flex gap-4 text-[15px]">
            {filters.page > 1 && (
              <Link href={recallFiltersHref(filters, { page: filters.page - 1 })} className="font-semibold">
                Previous
              </Link>
            )}
            {filters.page < pages && (
              <Link href={recallFiltersHref(filters, { page: filters.page + 1 })} className="font-semibold">
                Next
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}

async function Updated() {
  const { updatedAt } = await recallStats();
  return updatedAt ? `Updated ${UPDATED_AT.format(updatedAt).replace(",", "")}` : null;
}

export default function RecallsPage({ searchParams }: PageProps<"/recalls">) {
  return (
    <div className="mx-auto flex max-w-[1160px] flex-col gap-[22px] px-4 pt-9 pb-14 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[32px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[38px]">Recent recalls</h1>
          <p className="m-0 text-ink-2">
            Products people resell second-hand, from{" "}
            <Suspense fallback="official recall lists">
              <Lists />
            </Suspense>
            .
          </p>
        </div>
        <div className="font-mono text-[13px] text-muted">
          <Suspense fallback={null}>
            <Updated />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={<p className="m-0 text-ink-2">Loading recalls…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
