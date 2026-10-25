import { connection } from "next/server";
import { Suspense } from "react";
import { recallStats } from "@/lib/db/recalls";
import { Accent } from "../ui";

const STEPS = ["Bought new", "A danger is found", "Resold second-hand"];

async function RecallCount() {
  await connection();
  const { total } = await recallStats();
  return total.toLocaleString("en-GB");
}

function Stat({ value, children }: { value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[2.6rem] leading-none font-semibold tracking-[-0.05em] sm:text-[3.2rem]">{value}</span>
      <span className="text-[15px] text-sage-text">{children}</span>
    </div>
  );
}

export function WhatIsARecall() {
  return (
    <section id="recall" className="scroll-mt-4 bg-sage">
      <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-10 px-4 py-16 text-center sm:gap-14 sm:px-7 sm:py-[120px]">
        <div className="flex flex-col items-center gap-5">
          <h2 className="m-0 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] sm:text-[3.4rem]">
            What&apos;s a <Accent>recall?</Accent>
          </h2>
          <p className="m-0 max-w-[40rem] text-lg leading-[1.6] text-sage-text sm:text-xl">
            When a product turns out to be dangerous, the brand and the government publish an official warning and ask owners to stop
            using it. The warning reaches the first owner. The next one usually never hears about it.
          </p>
        </div>
        <ol className="m-0 grid w-full list-none grid-cols-2 gap-3 p-0 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          {STEPS.map((step, i) => (
            <li key={step} className="flex flex-col items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full border border-[#D5DBD0] bg-surface font-semibold">{i + 1}</span>
              <span className="text-[17px] font-medium">{step}</span>
            </li>
          ))}
          <li className="flex flex-col items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-ink font-semibold text-paper">4</span>
            <span className="text-[17px] font-semibold text-brand">Vetted warns you</span>
          </li>
        </ol>
        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-8 border-t border-[#D5DBD0] pt-6">
          <Stat value="321">recalled bike seats listed 4 days after the recall</Stat>
          <Stat value="18">scooters for sale in one search, every unit recalled</Stat>
          <Stat
            value={
              <Suspense fallback="…">
                <RecallCount />
              </Suspense>
            }
          >
            official recalls Vetted checks
          </Stat>
        </div>
        <span className="font-mono text-xs text-[#5B6A61]">Leboncoin searches, 23 and 24 Oct 2026 · RappelConso and EU Safety Gate</span>
      </div>
    </section>
  );
}
