import type { Metadata } from "next";
import { VettedTag } from "@/components/VettedTag";
import { Accent, Eyebrow } from "@/components/ui";
import { ACTION_STYLES } from "./actions";
import { BatchCheck } from "./BatchCheck";
import { TryIt } from "./TryIt";

export const metadata: Metadata = {
  title: "Vetted for platforms",
  description: "Check every listing against French and EU product recalls when it's posted.",
};

const CURL = `curl -X POST https://vetted.sheharyarishfaq.com/api/v1/listings/check \\
  -H "Content-Type: application/json" \\
  -d '{
    "listing_id": "3247445342",
    "title": "Trottinette électrique Acer ES Series 5 – 470W – Noir – État neuf",
    "description": "Je vends ma trottinette électrique Acer ES Series 5 (470 W crête / 350 W nominal), noire, achetée neuve et très peu utilisée.",
    "url": "https://www.leboncoin.fr/ad/sport_plein_air/3247445342"
  }'`;

// The live endpoint's answer to the request above, as returned on 25 Oct 2026.
const RESPONSE = `{
  "listing_id": "3247445342",
  "verdict": "recalled",
  "recall": {
    "id": "rc:21110",
    "source": "rappelconso",
    "brand": "Acer",
    "model": "ES Series 5 (AES015)",
    "risk": "injury",
    "published_at": "2026-01-31",
    "notice_url": "https://rappel.conso.gouv.fr/fiche-rappel/21110/interne"
  },
  "reason": "Acer recalled the ES Series 5 (AES015) because a screw may not have been tightened enough during production and could come loose during normal use. Every unit is affected.",
  "suggested_action": "hold_listing",
  "seller_message": null,
  "check_url": "https://vetted.sheharyarishfaq.com/check/38b80c27-e19a-4dfc-9167-80e4f8867906"
}`;

const STEPS = [
  { title: "A seller posts a listing", text: "Title, description, up to three photo links. Nothing else is needed." },
  { title: "Your server sends it to Vetted", text: "One JSON request per listing, before it goes live or right after." },
  { title: "You get one of three actions back", text: "With the official recall behind it and a link to the government notice." },
];

const ACTIONS = [
  {
    action: ACTION_STYLES.hold_listing,
    text: "The listing matches an official recall. Keep it offline and point the seller to the notice.",
  },
  {
    action: ACTION_STYLES.ask_seller_for_label,
    text: "Only some units are recalled. Vetted writes the message asking for a label photo, in French and English.",
  },
  {
    action: ACTION_STYLES.publish,
    text: "Nothing in the French and EU recall lists matches. This doesn't prove the product is safe; it means no recall was found.",
  },
];

const FIELDS: [string, string][] = [
  ["title", "required, the listing title"],
  ["description", "optional"],
  ["image_urls", "optional, up to 3 photo links"],
  ["listing_id, url", "optional, returned as sent"],
];

const SECTION = "flex scroll-mt-20 flex-col gap-6";
const HEADING = "m-0 text-[1.9rem] leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-[2.5rem]";
const CARD = "flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-[22px] sm:p-[26px]";
const CODE = "m-0 overflow-x-auto rounded-[20px] bg-ink p-5 font-mono text-[13px] leading-[1.6] text-[#D8E3DD]";

export default function PlatformsPage() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-16 px-4 pt-12 pb-20 sm:gap-24 sm:px-7 sm:pt-16">
      <section className="flex max-w-[48rem] flex-col gap-5">
        <Eyebrow>Vetted for platforms</Eyebrow>
        <h1 className="m-0 text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-[3.6rem]">
          Catch recalled products <Accent>before they&apos;re listed.</Accent>
        </h1>
        <p className="m-0 max-w-[42rem] text-lg leading-[1.6] text-ink-2">
          Under EU product safety rules, platforms and professional sellers are responsible for recalled products sold through
          them. Vetted checks every listing against French and EU recalls when it&apos;s posted.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <a href="#try" className="inline-flex min-h-12 items-center rounded-full bg-ink px-[22px] font-semibold text-paper no-underline hover:bg-brand hover:text-paper">
            Try the API
          </a>
          <a href="#bulk" className="inline-flex min-h-12 items-center rounded-full border border-ink px-[22px] font-medium text-ink no-underline hover:bg-ink hover:text-paper">
            Check stock in bulk
          </a>
        </div>
      </section>

      <section aria-labelledby="how-title" className={SECTION}>
        <div className="flex flex-col gap-3">
          <Eyebrow>How it works</Eyebrow>
          <h2 id="how-title" className={HEADING}>
            One request per listing. <Accent>One action back.</Accent>
          </h2>
        </div>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(17rem,100%),1fr))] gap-4 p-0">
          {STEPS.map((step, i) => (
            <li key={step.title} className={CARD}>
              <span className="flex size-9 items-center justify-center rounded-full bg-ink font-semibold text-paper">{i + 1}</span>
              <span className="text-[21px] font-semibold tracking-[-0.02em]">{step.title}</span>
              <span className="text-base leading-[1.55] text-ink-2">{step.text}</span>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(17rem,100%),1fr))] gap-4">
          {ACTIONS.map(({ action, text }) => (
            <div key={action.label} className={CARD}>
              <VettedTag variant={action.tag} width={56} decorative />
              <span className={`self-start rounded-full px-2.5 py-[5px] font-mono text-[11px] uppercase ${action.pill}`}>{action.verdict}</span>
              <h3 className="m-0 text-[21px] font-semibold tracking-[-0.02em]">{action.label}</h3>
              <p className="m-0 text-base leading-[1.55] text-ink-2">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="api" aria-labelledby="api-title" className={SECTION}>
        <div className="flex flex-col gap-3">
          <Eyebrow>The API</Eyebrow>
          <h2 id="api-title" className={HEADING}>
            <span className="font-mono text-[0.7em] tracking-[-0.02em]">POST /api/v1/listings/check</span>
          </h2>
          <p className="m-0 max-w-[44rem] text-base leading-[1.6] text-ink-2">
            A demo endpoint: no key yet, and the same limits as the website (40 checks a minute and 400 a day per address). Send
            JSON; errors come back as <span className="font-mono text-[15px]">{"{ \"error\": \"…\" }"}</span> with status 400 for
            a bad request and 429 when the limit is reached.
          </p>
          <dl className="m-0 grid max-w-[44rem] grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[15px]">
            {FIELDS.map(([name, text]) => (
              <div key={name} className="contents">
                <dt className="font-mono text-ink">{name}</dt>
                <dd className="m-0 text-ink-2">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(26rem,100%),1fr))] gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-semibold text-muted">Request: an Acer ES Series 5 listing from Leboncoin</span>
            <pre className={CODE}>{CURL}</pre>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-semibold text-muted">Response</span>
            <pre className={CODE}>{RESPONSE}</pre>
          </div>
        </div>
      </section>

      <section id="try" aria-labelledby="try-title" className={SECTION}>
        <div className="flex flex-col gap-3">
          <Eyebrow>Try it</Eyebrow>
          <h2 id="try-title" className={HEADING}>
            Send a listing. <Accent>See the answer live.</Accent>
          </h2>
        </div>
        <TryIt />
      </section>

      <section id="bulk" aria-labelledby="bulk-title" className={SECTION}>
        <div className="flex flex-col gap-3">
          <Eyebrow>For resellers and charity shops</Eyebrow>
          <h2 id="bulk-title" className={HEADING}>
            Check your stock in bulk
          </h2>
          <p className="m-0 max-w-[44rem] text-base leading-[1.6] text-ink-2">
            Upload a spreadsheet of items, up to 200 rows, and get the same answer for each one.
          </p>
        </div>
        <BatchCheck />
      </section>

      <p className="m-0 text-lg text-ink-2">
        Interested in a pilot?{" "}
        <a href="mailto:sheharyarishfaq@gmail.com?subject=Vetted%20pilot" className="font-semibold">
          sheharyarishfaq@gmail.com
        </a>
      </p>
    </div>
  );
}
