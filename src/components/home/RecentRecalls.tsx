import Link from "next/link";
import { connection } from "next/server";
import { RemoteImage } from "@/components/check/RemoteImage";
import { capitalize, riskWord, shortDay, titleCase } from "@/lib/check/copy";
import { recallsPublishedSince } from "@/lib/db/recalls";
import { sinceDate } from "@/lib/ingest/dates";

const SOURCE_NAMES = { rappelconso: "RappelConso", safetygate: "EU Safety Gate" } as const;

// This week's recalls, or the latest ones when none were published in the last seven days.
export async function RecentRecalls() {
  await connection();
  const thisWeek = await recallsPublishedSince(sinceDate("7d"), 4);
  const recalls = thisWeek.length ? thisWeek : await recallsPublishedSince("1900-01-01", 4);
  if (recalls.length === 0) return null;

  return (
    <section className="mx-auto flex max-w-[1160px] flex-col gap-5 px-4 pb-[72px] sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="m-0 text-[28px] font-bold tracking-[-0.02em] sm:text-[32px]">{thisWeek.length ? "Recalled this week" : "Latest recalls"}</h2>
        <Link href="/recalls" className="text-[15px] font-semibold">
          See all recalls
        </Link>
      </div>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 p-0">
        {recalls.map((recall) => {
          const name = capitalize(recall.productName);
          const brand = recall.brand && !recall.productName.includes(recall.brand) ? titleCase(recall.brand) : null;
          const meta = [SOURCE_NAMES[recall.source as keyof typeof SOURCE_NAMES], shortDay(recall.publishedAt), riskWord(recall.risk)];
          return (
            <li key={recall.id}>
              <a
                href={recall.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink no-underline hover:border-field hover:text-ink"
              >
                {recall.images[0] ? (
                  <RemoteImage src={recall.images[0]} alt="" className="h-[140px] w-full bg-placeholder object-contain" />
                ) : (
                  <div aria-hidden="true" className="h-[140px] bg-placeholder" />
                )}
                <div className="flex flex-col gap-1 px-4 py-3.5">
                  <div className="font-bold">{brand ? `${name} · ${brand}` : name}</div>
                  <div className="text-[13px] text-muted">{meta.filter(Boolean).join(" · ")}</div>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
