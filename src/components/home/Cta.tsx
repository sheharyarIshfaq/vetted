import Link from "next/link";
import { Accent, ButtonLink } from "../ui";

export function Cta() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-7">
      <div className="flex flex-col items-center gap-5 rounded-[28px] bg-sage px-6 py-14 text-center sm:px-10">
        <h2 className="m-0 text-[2.2rem] leading-[1.02] font-semibold tracking-[-0.05em] sm:text-5xl">
          Buying something second-hand <Accent>this week?</Accent>
        </h2>
        <p className="m-0 text-lg text-sage-text">Check it first. It takes five seconds and it&apos;s free.</p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <ButtonLink href="#listing">Check a listing</ButtonLink>
          <ButtonLink href="#extension" variant="secondary">
            Add to Chrome
          </ButtonLink>
        </div>
        <span className="mt-2 text-sm text-sage-text">
          Run a marketplace or a charity shop? <Link href="/platforms">Check your listings in bulk</Link>.
        </span>
      </div>
    </section>
  );
}
