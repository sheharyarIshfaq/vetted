"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { RemoteImage } from "@/components/check/RemoteImage";
import { OfficialImage } from "./OfficialImage";
import { SHOWCASES, type Showcase } from "./examples";
import { VERDICT_PILL } from "./products";

type Notices = Record<string, { url: string; image: string | null }>;

const TAG_FILL = { recalled: "bg-recalled", check_label: "bg-check", clear: "bg-safe" } as const;
const MARKS = {
  ok: { symbol: "✓", className: "bg-safe", label: "Yes:" },
  warn: { symbol: "!", className: "bg-check", label: "Missing:" },
  no: { symbol: "×", className: "bg-recalled", label: "No:" },
} as const;

// Sends the example listing through the real check and opens the result.
function RunCheck({ showcase }: { showcase: Showcase }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "failed">("idle");
  async function run() {
    setState("running");
    const body = new FormData();
    body.append("text", showcase.title);
    const response = await fetch("/api/check", { method: "POST", body }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { id?: string } | null;
    if (response?.ok && result?.id) router.push(`/check/${result.id}`);
    else setState("failed");
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={state === "running"}
        className="min-h-11 cursor-pointer rounded-full border border-ink px-5 text-sm font-medium text-ink hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-60"
      >
        {state === "running" ? "Checking…" : "Run this check"}
      </button>
      {state === "failed" && (
        <span role="alert" className="text-sm text-recalled-text">
          The check failed. Please try again.
        </span>
      )}
    </div>
  );
}

function Photo({ showcase, image }: { showcase: Showcase; image: string | null }) {
  if (showcase.fallback) {
    return <OfficialImage key={showcase.recallId} src={image} fallback={showcase.fallback} alt={showcase.alt} className="h-[260px] w-full object-contain sm:h-[340px]" />;
  }
  return image ? <RemoteImage key={showcase.recallId} src={image} alt={showcase.alt} className="h-[260px] w-full object-contain sm:h-[300px]" /> : null;
}

export function ShowcaseTabs({ notices, searched }: { notices: Notices; searched: Record<string, string> }) {
  const [pick, setPick] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const showcase = SHOWCASES[pick];
  const notice = notices[showcase.recallId];

  function onKeyDown(event: KeyboardEvent) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = (pick + step + SHOWCASES.length) % SHOWCASES.length;
    setPick(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-7">
      <div role="tablist" aria-label="Real listings" onKeyDown={onKeyDown} className="flex flex-wrap justify-center gap-1 self-center rounded-full border border-line bg-surface p-1">
        {SHOWCASES.map((item, i) => (
          <button
            key={item.label}
            ref={(element) => {
              tabs.current[i] = element;
            }}
            type="button"
            role="tab"
            id={`showcase-tab-${i}`}
            aria-selected={i === pick}
            aria-controls="showcase-panel"
            tabIndex={i === pick ? 0 : -1}
            onClick={() => setPick(i)}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium ${
              i === pick ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
            }`}
          >
            <span aria-hidden="true" className={`size-2 rounded-full ${TAG_FILL[item.verdict]}`} />
            {item.label}
          </button>
        ))}
      </div>

      <div id="showcase-panel" role="tabpanel" aria-labelledby={`showcase-tab-${pick}`} className="flex flex-wrap items-stretch gap-5">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3 rounded-[22px] border border-line bg-surface p-3">
          <div className="relative flex h-[280px] items-center justify-center overflow-hidden rounded-[14px] bg-surface sm:h-[360px]">
            <Photo showcase={showcase} image={notice?.image ?? null} />
            <div aria-hidden="true" className="absolute top-0 right-[30px] flex flex-col items-center">
              <div className="h-7 w-0.5 bg-ink" />
              <div className="relative origin-top -rotate-[7deg]">
                <div
                  className={`py-2.5 pr-4 pl-[30px] font-mono text-xs font-semibold tracking-[0.1em] whitespace-nowrap text-ink [clip-path:polygon(14px_0,100%_0,100%_100%,14px_100%,0_50%)] ${TAG_FILL[showcase.verdict]}`}
                >
                  {showcase.tag}
                </div>
                <span className="absolute top-1/2 left-2.5 -mt-1 size-2 rounded-full bg-surface" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 px-2 pt-1 pb-2">
            <span className="text-[13px] text-muted">{showcase.caption}</span>
            <span className="text-xl font-semibold tracking-[-0.02em]">{showcase.title}</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5 rounded-[22px] border border-line bg-surface p-6 sm:p-7">
          <span className={`self-start rounded-full px-3 py-1.5 font-mono text-xs tracking-[0.08em] ${VERDICT_PILL[showcase.verdict]}`}>
            VETTED SAYS · {showcase.tag}
          </span>
          <span className="text-[1.8rem] leading-[1.05] font-semibold tracking-[-0.04em] sm:text-[2.1rem]">{showcase.headline}</span>
          <span className="text-base leading-[1.6] text-ink-2">{(showcase.searchedFor && searched[showcase.searchedFor]) || showcase.reason}</span>
          <ul className="m-0 flex list-none flex-col gap-[9px] p-0">
            {showcase.facts.map((fact) => (
              <li key={fact.text} className="flex items-start gap-2.5 text-[15px] leading-[1.45]">
                <span aria-hidden="true" className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-ink ${MARKS[fact.mark].className}`}>
                  {MARKS[fact.mark].symbol}
                </span>
                <span>
                  <span className="sr-only">{MARKS[fact.mark].label} </span>
                  {fact.text}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-2 rounded-2xl bg-paper px-[18px] py-4">
            <span className="text-[15px]">
              <strong className="font-semibold">What to do:</strong> {showcase.todo}
            </span>
            {notice ? (
              <a href={notice.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[13px]">
                {showcase.source}
              </a>
            ) : (
              <span className="font-mono text-[13px] text-muted">{showcase.source}</span>
            )}
          </div>
          <RunCheck key={showcase.recallId} showcase={showcase} />
        </div>
      </div>
    </div>
  );
}
