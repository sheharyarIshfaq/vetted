import { connection } from "next/server";
import { Suspense } from "react";
import { searchedSummary } from "@/lib/check/copy";
import { getRecalls, recallStats } from "@/lib/db/recalls";
import { Eyebrow } from "../ui";
import { SHOWCASES } from "./examples";
import { ShowcaseTabs } from "./ShowcaseTabs";

// The notices' photos and links, so each example shows and links its real recall.
async function LiveTabs() {
  await connection();
  const [recalls, stats] = await Promise.all([getRecalls(SHOWCASES.map((showcase) => showcase.recallId)), recallStats()]);
  const notices = Object.fromEntries(recalls.map((recall) => [recall.id, { url: recall.url, image: recall.images[0] ?? null }]));
  const searched = Object.fromEntries(
    SHOWCASES.flatMap(({ searchedFor }) => (searchedFor ? [[searchedFor, searchedSummary({ total: stats.total, sources: stats.sources, searchedFor })]] : [])),
  );
  return <ShowcaseTabs notices={notices} searched={searched} />;
}

export function SeeItWork() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-16 pb-16 sm:px-7 sm:pt-24 sm:pb-[88px]">
      <div className="mb-7 flex flex-col items-center gap-3.5 text-center">
        <Eyebrow>See it work</Eyebrow>
        <h2 className="m-0 text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.045em] sm:text-[2.8rem]">Three real listings, three answers.</h2>
      </div>
      <Suspense fallback={<ShowcaseTabs notices={{}} searched={{}} />}>
        <LiveTabs />
      </Suspense>
    </section>
  );
}
