import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { readListings } from "@/lib/eval/listings";
import { LabelRow } from "./LabelRow";

export const metadata: Metadata = { title: "Label test set · Tiko dev" };

async function Listings() {
  await connection();
  const listings = await readListings();
  const labelled = listings.filter((listing) => listing.expected !== null).length;
  if (listings.length === 0) {
    return (
      <p className="m-0 text-ink-2">
        Nothing collected yet. Install the bookmarklet from{" "}
        <Link href="/dev/collector" className="font-semibold">
          /dev/collector
        </Link>
        .
      </p>
    );
  }
  return (
    <>
      <p className="m-0 text-ink-2">
        {labelled} of {listings.length} labelled
      </p>
      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {listings.map((listing) => (
          <li key={listing.id} className="flex flex-wrap gap-5 rounded-2xl border border-line bg-surface p-5">
            <div className="flex shrink-0 gap-2">
              {listing.photos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element -- local dev photos served by a route handler
                <img key={photo} src={`/api/dev/photos/${photo}`} alt="" className="size-24 rounded-lg bg-placeholder object-cover" />
              ))}
            </div>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-sm text-muted">{listing.id}</span>
                <h2 className="m-0 text-lg font-bold">{listing.title}</h2>
              </div>
              {listing.url && (
                <a href={listing.url} target="_blank" rel="noopener noreferrer" className="text-sm break-all">
                  {listing.url}
                </a>
              )}
              <p className="m-0 line-clamp-4 text-sm leading-normal whitespace-pre-line text-ink-2">{listing.description}</p>
              <LabelRow listing={listing} />
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

export default function LabelPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <section className="mx-auto flex max-w-[1000px] flex-col gap-5 px-4 py-12 sm:px-6">
      <div className="font-mono text-[13px] tracking-[0.06em] text-brand uppercase">Dev only</div>
      <h1 className="m-0 text-[32px] leading-tight font-extrabold tracking-[-0.02em]">Label the test set</h1>
      <Suspense fallback={<p className="m-0 text-ink-2">Loading listings…</p>}>
        <Listings />
      </Suspense>
    </section>
  );
}
