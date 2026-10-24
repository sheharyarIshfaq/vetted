import { Suspense } from "react";
import { CheckForm } from "@/components/home/CheckForm";
import { ExampleCards } from "@/components/home/ExampleCards";
import { RecentRecalls } from "@/components/home/RecentRecalls";
import { Lists, Regions } from "@/components/home/sources";
import { StatsStrip } from "@/components/home/StatsStrip";

const STEPS = [
  { title: "Reads the listing", text: "Brand, model and references from the title, description and photos." },
  {
    title: "Searches official lists",
    text: (
      <>
        <Suspense fallback="Official recall lists">
          <Lists />
        </Suspense>
        , refreshed every night.
      </>
    ),
  },
  { title: "Compares photos and dates", text: "Same product? Made inside the recalled period? Fixed rules decide." },
  { title: "Shows the proof", text: "Every verdict links to the government notice it comes from." },
];

export default function Home() {
  return (
    <>
      <section className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-12 px-4 pt-12 pb-14 sm:px-6 sm:pt-[72px]">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-[22px]">
          <div className="font-mono text-[13px] tracking-[0.06em] text-brand uppercase">Second-hand, checked</div>
          <h1 className="m-0 text-[40px] leading-[1.04] font-extrabold tracking-[-0.035em] text-balance sm:text-[56px]">
            Check it before you buy it.
          </h1>
          <p className="m-0 max-w-[560px] text-[19px] leading-[1.55] text-ink-2">
            Vetted checks second-hand listings against the official recall lists
            <Suspense>
              <Regions />
            </Suspense>
            , and tells you in seconds if that car seat, stroller or toy was recalled.
          </p>
          <CheckForm />
        </div>
        <Suspense>
          <ExampleCards />
        </Suspense>
      </section>

      <StatsStrip />

      <section className="mx-auto flex max-w-[1160px] flex-col gap-7 px-4 py-16 sm:px-6">
        <h2 className="m-0 text-[28px] font-bold tracking-[-0.02em] sm:text-[32px]">How Vetted checks</h2>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 p-0">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-[22px]">
              <div className="font-mono text-[13px] text-brand">{i + 1}</div>
              <div className="text-lg font-bold">{step.title}</div>
              <div className="text-[15px] leading-normal text-ink-2">{step.text}</div>
            </li>
          ))}
        </ol>
      </section>

      <Suspense>
        <RecentRecalls />
      </Suspense>
    </>
  );
}
