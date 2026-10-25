import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ThreeAnswers } from "@/components/home/HowItWorks";
import { Lists } from "@/components/home/sources";
import { recallStats } from "@/lib/db/recalls";

export const metadata: Metadata = { title: "How it works · Vetted" };

const UPDATED_AT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

const STEPS = [
  {
    tag: "1 · AI",
    title: "Read the listing",
    text: "Title, description and photos become clean fields: category, brand, model, references, barcode, batch, production date and any label text.",
  },
  {
    tag: "2 · Data",
    title: "Find candidate recalls",
    text: (
      <>
        A barcode is matched first. Otherwise Vetted searches by brand, then by model, across{" "}
        <Suspense fallback="the official recall lists">
          <Lists />
        </Suspense>
        , and keeps the five closest.
      </>
    ),
  },
  {
    tag: "3 · AI",
    title: "Compare photos",
    text: "Listing photos against the official recall photos: same product, different, or unsure, with reasons.",
  },
  {
    tag: "4 · Rules",
    title: "Decide the verdict",
    text: "Model and date or batch match: recalled. Model matches, date unknown: check the label. Otherwise: no recall found.",
  },
];

const SOURCES = [
  {
    source: "rappelconso",
    name: "RappelConso",
    text: "France's official recall list, run by the Ministry of the Economy. Open data with barcodes, photos, risks and sale dates.",
  },
  {
    source: "safetygate",
    name: "EU Safety Gate",
    text: "The EU alert system for dangerous non-food products, including many items first bought online from outside the EU. Vetted keeps the categories people resell second-hand, from 2020 onwards.",
  },
] as const;

async function Sources() {
  await connection();
  const stats = await recallStats();
  const loaded = SOURCES.filter((entry) => stats.sources.includes(entry.source));
  return (
    <>
        {loaded.map((entry) => (
          <div key={entry.source} className="flex flex-col gap-1 border-t border-line pt-2.5">
            <div className="font-semibold">{entry.name}</div>
            <div className="text-sm leading-normal text-ink-2">{entry.text}</div>
            <div className="font-mono text-[13px] text-muted">
              {(stats.bySource[entry.source] ?? 0).toLocaleString("en-GB")} recalls loaded
            </div>
          </div>
        ))}
        {stats.updatedAt && <div className="font-mono text-[13px] text-muted">Last updated {UPDATED_AT.format(stats.updatedAt)}</div>}
    </>
  );
}

export default function HowItWorksPage() {
  return (
    <>
    <div className="mx-auto flex max-w-[1160px] flex-col gap-10 px-4 pt-12 pb-16 sm:px-6">
      <div className="flex max-w-[720px] flex-col gap-3">
        <h1 className="m-0 text-[36px] leading-[1.08] font-semibold tracking-[-0.045em] sm:text-[44px]">AI reads. Official data decides.</h1>
        <p className="m-0 text-lg leading-[1.55] text-ink-2">
          Vetted uses AI only for the messy parts: reading listings, photos and labels. Whether something is recalled comes from
          government data and fixed rules, and every verdict shows its source.
        </p>
      </div>

      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4 p-0">
        {STEPS.map((step) => (
          <li key={step.tag} className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-[22px]">
            <span className="font-mono text-[13px] text-brand">{step.tag}</span>
            <h2 className="m-0 text-[19px] font-semibold">{step.title}</h2>
            <p className="m-0 text-[15px] leading-normal text-ink-2">{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
        <section aria-labelledby="sources" className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-[22px]">
          <h2 id="sources" className="m-0 text-[22px] font-semibold">
            Where the data comes from
          </h2>
          <Suspense fallback={<p className="m-0 text-sm text-muted">Loading the sources…</p>}>
            <Sources />
          </Suspense>
        </section>
        <section aria-labelledby="limits" className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-[22px]">
          <h2 id="limits" className="m-0 text-[22px] font-semibold">
            What Vetted won&apos;t do
          </h2>
          <ul className="m-0 flex flex-col gap-2 pl-5 text-[15px] leading-normal text-ink-2">
            <li>Say an item is safe. &ldquo;No recall found&rdquo; only means no official recall matches.</li>
            <li>Guess a production date. If it isn&apos;t known, Vetted asks for the label.</li>
            <li>Collect listings in bulk. The extension only reads the page you&apos;re looking at.</li>
            <li>Replace the official notice. Every verdict links to it.</li>
          </ul>
        </section>
      </div>

      <section
        id="extension"
        aria-labelledby="extension-title"
        className="flex scroll-mt-6 flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-[22px]"
      >
        <h2 id="extension-title" className="m-0 text-[22px] font-semibold">
          The Chrome extension
        </h2>
        <p className="m-0 max-w-[720px] text-[15px] leading-normal text-ink-2">
          The extension shows the same check next to the Leboncoin or Vinted listing you&apos;re viewing. It reads only that page,
          never other listings or your account.
        </p>
        <p className="m-0 text-sm text-muted">It isn&apos;t in the Chrome Web Store yet.</p>
      </section>
    </div>
    <ThreeAnswers />
    </>
  );
}
