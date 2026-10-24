import type { ReactNode } from "react";
import { VerdictSticker } from "@/components/VerdictSticker";
import type { Verdict } from "@/lib/verdict";

const STYLES: Record<Verdict, { border: string; band: string; eyebrow: string }> = {
  recalled: { border: "border-recalled", band: "bg-recalled-soft", eyebrow: "text-recalled-text" },
  check_label: { border: "border-check", band: "bg-check-soft", eyebrow: "text-check-text" },
  clear: { border: "border-safe", band: "bg-brand-soft", eyebrow: "text-safe-text" },
};

type Props = { verdict: Verdict; eyebrow: string; title: string; children: ReactNode; body?: ReactNode };

export function VerdictPanel({ verdict, eyebrow, title, children, body }: Props) {
  const style = STYLES[verdict];
  return (
    <section
      aria-label="Verdict"
      className={`motion-safe:animate-[fade-in_300ms_ease-out] overflow-hidden rounded-[18px] border-2 bg-surface ${style.border}`}
    >
      <div className={`flex items-start gap-4 p-5 sm:gap-[18px] sm:p-6 ${style.band}`}>
        <span className="hidden sm:block">
          <VerdictSticker verdict={verdict} size={72} decorative />
        </span>
        <span className="sm:hidden">
          <VerdictSticker verdict={verdict} size={52} decorative />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className={`font-mono text-xs tracking-[0.06em] uppercase ${style.eyebrow}`}>{eyebrow}</div>
          <h1 className="m-0 text-2xl leading-[1.15] font-extrabold tracking-[-0.02em] sm:text-[30px]">{title}</h1>
          <div className="max-w-[720px] text-base leading-[1.55] text-ink-2">{children}</div>
        </div>
      </div>
      {body}
    </section>
  );
}
