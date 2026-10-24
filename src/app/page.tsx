export default function Home() {
  return (
    <section className="mx-auto flex max-w-[1160px] flex-col gap-[22px] px-4 pt-12 pb-14 sm:px-6 sm:pt-[72px]">
      <div className="font-mono text-[13px] tracking-[0.06em] text-brand uppercase">Second-hand, checked</div>
      <h1 className="m-0 text-[40px] leading-[1.04] font-extrabold tracking-[-0.035em] text-balance sm:text-[56px]">
        Check it before you buy it.
      </h1>
      <p className="m-0 max-w-[560px] text-[19px] leading-[1.55] text-ink-2">
        Tiko checks second-hand listings against the official recall lists of France and the EU, and tells you in
        seconds if that car seat, stroller or toy was recalled.
      </p>
    </section>
  );
}
