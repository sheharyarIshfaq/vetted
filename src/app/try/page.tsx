import type { Metadata } from "next";
import Link from "next/link";
import { AddToChrome } from "@/components/AddToChrome";
import { RemoteImage } from "@/components/check/RemoteImage";
import { VettedTag } from "@/components/VettedTag";
import { VERDICT_PILL } from "@/components/home/products";
import { Accent, ButtonLink, buttonStyles, Eyebrow } from "@/components/ui";
import type { Verdict } from "@/lib/verdict";
import { RunCheck } from "./RunCheck";
import { SAMPLES, TECH } from "./samples";

export const metadata: Metadata = {
  title: "Try it on real listings · Vetted",
  description: "Real second-hand listings of recalled products, to see every answer Vetted gives.",
};

const VERDICT_NAMES: Record<Verdict, string> = { recalled: "Recalled", check_label: "Check the label", clear: "No recall found" };

const search = (text: string) => ({
  leboncoin: `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(text)}`,
  vinted: `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(text)}`,
});

// What the official data says about each search, so people know which colour to expect.
const SEARCHES = [
  { text: "acer es series 5", expect: "Every Acer ES Series 5 scooter is recalled. Open one and the tag turns red." },
  { text: "trottinette acer", expect: "A mix of Acer scooters. ES Series 5 listings turn red; other Acer models aren't in this recall." },
  { text: "hamax buddy", expect: "Seats made from January 2022 to August 2026 are recalled. The tag turns amber: ask for the label." },
  { text: "britax smile", expect: "Some Smile III, Smile 4 and Smile 5Z strollers are recalled, so those turn amber. Smile 2 comes back green." },
  { text: "coffret petit sportif fisher price", expect: "Fisher-Price's baby toy set is recalled for a choking risk. Listings of it turn red." },
  { text: "hoverboard tilgreen", expect: "Only the Tilboard model is recalled. A listing that doesn't say which model turns amber." },
];

// Listings we opened with the extension. The extension reads their photos too, which is where the codes are.
const LISTINGS = [
  {
    url: "https://www.leboncoin.fr/ad/accessoires_telephone_objets_connectes/3190162918",
    name: "B39 wireless headphones, Leboncoin",
    expect: "Recalled (EU Safety Gate), once the photos are read.",
  },
  {
    url: "https://www.leboncoin.fr/ad/photo_audio_video/3181703414",
    name: "Fede kids' karaoke machine, Leboncoin",
    expect: "Recalled (EU Safety Gate): the K36 code is on the box in the photos.",
  },
  {
    url: "https://www.vinted.fr/items/10519842357-porte-bebe-pour-velo-hamax-buddy",
    name: "Hamax Buddy bike seat, Vinted",
    expect: "Check the label: only some production dates are recalled.",
  },
];

const SECTION = "flex scroll-mt-20 flex-col gap-6";
const HEADING = "m-0 text-[1.9rem] leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-[2.5rem]";
const CARD = "flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 sm:p-5";
const LINK = "inline-flex min-h-11 items-center rounded-full border border-field bg-surface px-4 text-[15px] font-semibold text-ink no-underline hover:border-ink hover:text-ink";

export default function TryPage() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-16 px-4 pt-12 pb-20 sm:gap-20 sm:px-7 sm:pt-16">
      <section className="flex max-w-[46rem] flex-col gap-5">
        <Eyebrow>Try it</Eyebrow>
        <h1 className="m-0 text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-[3.4rem]">
          Try it on <Accent>real listings.</Accent>
        </h1>
        <p className="m-0 text-lg leading-[1.6] text-ink-2">
          Most second-hand items have no recall, so green is the usual answer. That&apos;s the point: Vetted catches the few that
          are dangerous. Here are real ones to try.
        </p>
      </section>

      <section aria-labelledby="here-title" className={SECTION}>
        <div className="flex flex-col gap-3">
          <Eyebrow>Check it here</Eyebrow>
          <h2 id="here-title" className={HEADING}>
            One click, <Accent>each answer.</Accent>
          </h2>
          <p className="m-0 max-w-[44rem] text-base leading-[1.6] text-ink-2">
            Each check sends the title and description of a listing that was for sale on Leboncoin, saved so it still works after
            the item sells. The photos are from the official recall notices.
          </p>
        </div>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-4 p-0">
          {SAMPLES.map((sample) => (
            <li key={sample.key} className={CARD}>
              <figure className="m-0 flex flex-col gap-1.5">
                <RemoteImage src={sample.image} alt={`${sample.name}, from the official recall notice`} className="h-[190px] w-full rounded-xl bg-surface object-contain" />
                <figcaption className="text-xs text-muted">{sample.caption ?? "Photo: official recall notice"}</figcaption>
              </figure>
              <span className="text-[17px] font-semibold tracking-[-0.01em]">{sample.name}</span>
              <span className={`self-start rounded-full px-2.5 py-[5px] font-mono text-[11px] uppercase ${VERDICT_PILL[sample.verdict]}`}>
                {VERDICT_NAMES[sample.verdict]}
              </span>
              <div className="mt-auto pt-1">
                <RunCheck text={sample.text} label={sample.name} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tech-title" className={SECTION}>
        <div className="flex flex-col gap-3">
          <Eyebrow>Tech and gadgets</Eyebrow>
          <h2 id="tech-title" className={HEADING}>
            Headphones, chargers, <Accent>power banks.</Accent>
          </h2>
          <p className="m-0 max-w-[44rem] text-base leading-[1.6] text-ink-2">
            The things people buy second-hand most often, including fakes of big brands. Each check sends just the product name,
            the way you&apos;d type it.
          </p>
        </div>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(15rem,100%),1fr))] gap-4 p-0">
          {TECH.map((sample) => (
            <li key={sample.key} className={CARD}>
              {sample.image ? (
                <RemoteImage src={sample.image} alt={`${sample.name}, from the official recall notice`} className="h-[170px] w-full rounded-xl bg-surface object-contain" />
              ) : (
                <div className="flex h-[170px] items-center justify-center rounded-xl bg-safe-soft">
                  <VettedTag variant="clear" width={72} decorative />
                </div>
              )}
              <span className="text-[17px] font-semibold tracking-[-0.01em]">{sample.name}</span>
              <span className={`self-start rounded-full px-2.5 py-[5px] font-mono text-[11px] uppercase ${VERDICT_PILL[sample.verdict]}`}>
                {VERDICT_NAMES[sample.verdict]}
              </span>
              <span className="text-[15px] leading-[1.5] text-ink-2">{sample.line}</span>
              <span className="font-mono text-xs break-words text-muted">Checks: “{sample.text}”</span>
              <div className="mt-auto pt-1">
                <RunCheck text={sample.text} label={sample.name} />
              </div>
            </li>
          ))}
        </ul>
        <p className="m-0 text-xs text-muted">Photos: official recall notices (RappelConso, EU Safety Gate).</p>
      </section>

      <section aria-labelledby="ext-title" className={SECTION}>
        <div className="flex flex-col gap-3">
          <Eyebrow>With the Chrome extension</Eyebrow>
          <h2 id="ext-title" className={HEADING}>
            Try it on <Accent>Leboncoin and Vinted.</Accent>
          </h2>
          <p className="m-0 max-w-[44rem] text-base leading-[1.6] text-ink-2">
            With the extension, open any listing from these searches and the tag on its photo shows the answer.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <AddToChrome className={buttonStyles.primary}>Add to Chrome, free</AddToChrome>
            <Link href="/how-it-works#extension" className="text-[15px] font-semibold">
              How to install it
            </Link>
          </div>
        </div>

        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {SEARCHES.map((item) => {
            const links = search(item.text);
            return (
              <li key={item.text} className={`${CARD} sm:flex-row sm:items-center sm:justify-between`}>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-[15px] text-ink">“{item.text}”</span>
                  <span className="text-[15px] leading-[1.5] text-ink-2">{item.expect}</span>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a href={links.leboncoin} target="_blank" rel="noopener noreferrer" className={LINK}>
                    Leboncoin ↗
                  </a>
                  <a href={links.vinted} target="_blank" rel="noopener noreferrer" className={LINK}>
                    Vinted ↗
                  </a>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-3">
          <h3 className="m-0 text-xl font-semibold tracking-[-0.02em]">Listings we&apos;ve tested</h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {LISTINGS.map((listing) => (
              <li key={listing.url} className={`${CARD} sm:flex-row sm:items-center sm:justify-between`}>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[16px] font-semibold">{listing.name}</span>
                  <span className="text-[15px] leading-[1.5] text-ink-2">{listing.expect}</span>
                  <span className="font-mono text-xs text-muted">May have sold</span>
                </div>
                <a href={listing.url} target="_blank" rel="noopener noreferrer" className={`${LINK} shrink-0 self-start sm:self-center`}>
                  Open the listing ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="week-title" className={`${SECTION} rounded-[20px] bg-sage p-6 sm:p-8`}>
        <div className="flex flex-col gap-3">
          <Eyebrow>Recalled this week</Eyebrow>
          <h2 id="week-title" className={HEADING}>
            Look up <Accent>anything you own.</Accent>
          </h2>
          <p className="m-0 max-w-[44rem] text-base leading-[1.6] text-sage-text">
            Every recall from RappelConso and EU Safety Gate, newest first, with a search.
          </p>
        </div>
        <ButtonLink href="/recalls" className="self-start">
          See recent recalls
        </ButtonLink>
      </section>
    </div>
  );
}
