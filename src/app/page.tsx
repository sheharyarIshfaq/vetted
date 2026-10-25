import { CheckForm } from "@/components/home/CheckForm";
import { Cta } from "@/components/home/Cta";
import { ExtensionSection } from "@/components/home/ExtensionSection";
import { Faq } from "@/components/home/Faq";
import { HowItWorks, ThreeAnswers } from "@/components/home/HowItWorks";
import { RecalledProducts } from "@/components/home/RecalledProducts";
import { SeeItWork } from "@/components/home/SeeItWork";
import { WashingLine } from "@/components/home/WashingLine";
import { WhatIsARecall } from "@/components/home/WhatIsARecall";

function Hero() {
  return (
    // Pulled up under the transparent header, so the washing line runs behind it.
    <section className="hero relative -mt-[120px] overflow-hidden border-b border-divider bg-paper md:-mt-[86px] md:flex md:min-h-svh md:flex-col">
      <div aria-hidden="true" className="hero-glow absolute inset-0" />
      <svg aria-hidden="true" width="100%" height="100%" className="absolute inset-0 opacity-30 mix-blend-multiply">
        <filter id="hero-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.28  0 0 0 0.32 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-grain)" />
      </svg>
      <WashingLine />
      <div className="relative mx-auto flex max-w-[1100px] flex-col items-center gap-[22px] px-4 pt-[156px] pb-16 text-center sm:px-7 md:w-full md:flex-1 md:justify-center md:gap-[calc(22px*var(--fit))] md:pt-(--hero-top) md:pb-[calc(56px*var(--fit))]">
        <div className="flex items-center gap-3 font-mono text-[13px] text-[#6A4E1E]">
          <TanTag />
          <span>Second-hand. Not second-guessed.</span>
          <TanTag flip />
        </div>
        <h1 className="m-0 flex flex-col items-center">
          <span className="text-[2.6rem] leading-[0.95] font-bold tracking-[-0.06em] text-balance sm:text-[4rem] md:text-[calc(4rem*var(--type))] lg:text-[calc(5.6rem*var(--type))]">
            Is that second-hand item
          </span>
          <span className="font-serif text-[3.1rem] leading-none font-normal tracking-[-0.03em] text-brand italic sm:text-[4.8rem] md:text-[calc(4.8rem*var(--type))] lg:text-[calc(6.6rem*var(--type))]">
            safe to buy?
          </span>
        </h1>
        <p className="m-0 max-w-[38rem] text-lg leading-[1.6] text-ink-2 sm:text-xl md:text-[calc(1.25rem*var(--type))]">
          Some products get pulled from sale because they&apos;re dangerous, but they keep being resold. Paste a Leboncoin or Vinted
          listing and Vetted checks it against the official lists of dangerous products. Free, in about 5 seconds.
        </p>
        <CheckForm />
      </div>
    </section>
  );
}

function TanTag({ flip = false }: { flip?: boolean }) {
  return (
    <span aria-hidden="true" className={`text-[#C9A253] ${flip ? "-scale-x-100" : ""}`}>
      <svg width="22" height="15" viewBox="0 0 120 80">
        <g transform="rotate(-10 60 40)">
          <path d="M32 8 H104 a10 10 0 0 1 10 10 V62 a10 10 0 0 1 -10 10 H32 L10 46 a9 9 0 0 1 0 -12 Z" fill="currentColor" />
        </g>
      </svg>
    </span>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <RecalledProducts />
      <WhatIsARecall />
      <SeeItWork />
      <HowItWorks />
      <ThreeAnswers />
      <ExtensionSection />
      <Faq />
      <Cta />
    </>
  );
}
