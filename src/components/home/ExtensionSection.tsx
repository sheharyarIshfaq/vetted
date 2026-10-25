import { VettedTag } from "@/components/VettedTag";
import { AddToChrome } from "../AddToChrome";
import { Accent, buttonStyles, Eyebrow } from "../ui";

// A drawing of the extension on a listing: the tag on the photo and the panel beside it.
function BrowserMock() {
  return (
    <div aria-hidden="true" className="min-w-0 flex-[1_1_560px] overflow-hidden rounded-[20px] border border-field bg-surface shadow-[0_30px_60px_-30px_rgba(70,52,30,0.45)]">
      <div className="flex h-9 items-center gap-[7px] border-b border-[#E8E5DF] bg-[#F4F2EE] px-3.5">
        <span className="size-[9px] rounded-full bg-[#D9D5CC]" />
        <span className="size-[9px] rounded-full bg-[#D9D5CC]" />
        <span className="size-[9px] rounded-full bg-[#D9D5CC]" />
        <span className="ml-2.5 truncate font-mono text-[11px] text-muted">leboncoin.fr/ad/sport_plein_air/…</span>
      </div>
      <div className="flex flex-wrap items-start gap-[18px] p-[18px]">
        <div className="relative min-w-[200px] flex-[1_1_0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/home/acer.jpg" alt="" className="h-[220px] w-full rounded-[10px] border border-[#EEE] bg-surface object-contain sm:h-[300px]" />
          <div className="absolute -top-[18px] right-5 flex flex-col items-center">
            <div className="h-[26px] w-0.5 bg-ink" />
            <div className="origin-top -rotate-[7deg]">
              <div className="bg-recalled py-2 pr-3 pl-6 font-mono text-[11px] font-semibold tracking-[0.1em] text-ink [clip-path:polygon(11px_0,100%_0,100%_100%,11px_100%,0_50%)]">
                RECALLED
              </div>
            </div>
          </div>
          <div className="mt-2.5 text-[15px] font-semibold">Trottinette électrique Acer ES Series 5</div>
        </div>
        <div className="w-[220px] shrink-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_16px_30px_-18px_rgba(70,52,30,0.5)] max-sm:w-full">
          <div className="flex items-center gap-1.5 border-b border-[#F0EADF] px-3 py-2.5 text-sm font-bold tracking-[-0.05em]">
            <VettedTag variant="plain" width={20} decorative />
            vetted
          </div>
          <div className="flex flex-col gap-1 bg-[#FDF3F1] p-3">
            <span className="font-mono text-[10px] tracking-[0.1em] text-recalled-text">RECALLED</span>
            <span className="text-base leading-[1.2] font-semibold">Don&apos;t buy it as it is.</span>
          </div>
          <div className="flex flex-col gap-2.5 p-3">
            <span className="text-xs leading-normal text-ink-2">A screw can come loose while riding. Every unit is recalled.</span>
            <span className="rounded-full bg-ink p-[9px] text-center text-xs font-semibold text-paper">Read the notice</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExtensionSection() {
  return (
    <section id="extension" className="scroll-mt-4 bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-11 px-4 py-16 sm:px-7 sm:py-[88px]">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-[18px]">
          <Eyebrow>Chrome extension</Eyebrow>
          <h2 className="m-0 text-[2.2rem] leading-[1.02] font-semibold tracking-[-0.05em] sm:text-[2.8rem]">
            Browse as usual. <Accent>Vetted checks as you go.</Accent>
          </h2>
          <p className="m-0 text-[17px] leading-[1.6] text-ink-2">
            Open a listing on Leboncoin or Vinted and a tag appears on the photo within seconds: green, amber or red. Click it for the
            full answer.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <AddToChrome className={buttonStyles.primary}>Add to Chrome, free</AddToChrome>
          </div>
        </div>
        <BrowserMock />
      </div>
    </section>
  );
}
