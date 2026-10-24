import type { ReactNode } from "react";
import { VERDICT_TAGS, VettedTag } from "@/components/VettedTag";
import type { Verdict } from "@/lib/verdict";

export const VERDICT_TONES: Record<Verdict, { soft: string; text: string }> = {
  recalled: { soft: "bg-recalled-soft", text: "text-recalled-text" },
  check_label: { soft: "bg-check-soft", text: "text-check-text" },
  clear: { soft: "bg-safe-soft", text: "text-safe-text" },
};

type Props = { verdict: Verdict; eyebrow: string; title: string; children: ReactNode; body?: ReactNode };

// The answer card: a soft block in the verdict's colour with the tag, the verdict and why, then whatever backs it up.
export function VerdictPanel({ verdict, eyebrow, title, children, body }: Props) {
  const tone = VERDICT_TONES[verdict];
  return (
    <section
      aria-label="Verdict"
      className="motion-safe:animate-[fade-in_300ms_ease-out] overflow-hidden rounded-[22px] border border-line bg-surface p-2.5"
    >
      <div className={`flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-start sm:gap-5 sm:p-6 ${tone.soft}`}>
        <VettedTag variant={VERDICT_TAGS[verdict]} width={72} decorative className="sm:mt-1" />
        <div className="flex min-w-0 flex-col gap-2">
          <div className={`font-mono text-xs tracking-[0.1em] uppercase ${tone.text}`}>{eyebrow}</div>
          <h1 className="m-0 text-[1.8rem] leading-[1.08] font-semibold tracking-[-0.04em] sm:text-[2.2rem]">{title}</h1>
          <div className="max-w-[720px] text-base leading-[1.6] text-ink-2">{children}</div>
        </div>
      </div>
      {body && <div className="flex flex-col gap-5 px-3 pt-5 pb-3 sm:px-4">{body}</div>}
    </section>
  );
}
