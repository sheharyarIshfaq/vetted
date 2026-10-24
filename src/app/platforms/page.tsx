import type { Metadata } from "next";
import { BatchCheck } from "./BatchCheck";

export const metadata: Metadata = { title: "For platforms · Vetted" };

const CHECK_EXAMPLE = `POST /api/check
text=Poussette Britax Smile III, fabriquée en 03/2020
photos=@listing.jpg   (up to 3, optional)

→ { "id": "…",
    "verdict": "recalled",
    "recall": { "id": "rc:22625",
                "sourceRef": "2026-06-0195",
                "url": "https://rappel.conso.gouv.fr/…" },
    "evidence": [ … ] }`;

export default function PlatformsPage() {
  return (
    <div className="mx-auto flex max-w-[1160px] flex-col gap-8 px-4 pt-12 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end gap-8">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
          <div className="font-mono text-[13px] tracking-[0.06em] text-brand uppercase">For marketplaces and second-hand shops</div>
          <h1 className="m-0 text-[36px] leading-[1.08] font-extrabold tracking-[-0.03em] sm:text-[44px]">
            Catch recalled products before your buyers do.
          </h1>
          <p className="m-0 text-lg leading-[1.55] text-ink-2">
            Check every new listing or donated item against French and EU recalls, review the matches in one queue, and keep a
            record of what you did. The EU General Product Safety Regulation has applied to online marketplaces since 13 December
            2024.
          </p>
        </div>
        <div className="flex flex-[1_1_260px] flex-wrap gap-2.5">
          <a
            href="#batch"
            className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 text-base font-bold text-white no-underline hover:text-white"
          >
            Try the batch check
          </a>
          <a
            href="#api"
            className="inline-flex min-h-12 items-center rounded-xl border border-field bg-surface px-5 text-base font-semibold text-ink no-underline hover:text-ink"
          >
            See the API
          </a>
        </div>
      </div>

      <BatchCheck />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
        <section id="api" aria-labelledby="api-title" className="flex scroll-mt-6 flex-col gap-3 rounded-[18px] bg-ink p-[22px] text-white">
          <h2 id="api-title" className="m-0 text-xl font-bold">
            One call per listing
          </h2>
          <pre className="m-0 overflow-x-auto font-mono text-[13px] leading-[1.6] whitespace-pre-wrap text-[#D8E3DD]">{CHECK_EXAMPLE}</pre>
          <p className="m-0 text-sm text-[#C9D1CC]">
            Or send a whole CSV to <span className="font-mono">POST /api/batch</span>: one result line per listing, up to 200
            rows.
          </p>
        </section>
        <section aria-labelledby="built-for" className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-[22px]">
          <h2 id="built-for" className="m-0 text-xl font-bold">
            Built for
          </h2>
          <ul className="m-0 flex flex-col gap-2 pl-5 text-[15px] leading-normal text-ink-2">
            <li>Second-hand marketplaces checking new listings</li>
            <li>Resellers and refurbishers before they list stock</li>
            <li>Charity shops and ressourceries sorting donations</li>
            <li>Insurers and brands tracking recalled products</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
