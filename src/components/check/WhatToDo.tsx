import type { ReactNode } from "react";
import type { Recall } from "@/db/schema";
import { dayName } from "@/lib/check/copy";
import { SOURCE_NAMES } from "@/lib/check/panel";

type Props = { children: ReactNode; recall: Pick<Recall, "source" | "publishedAt" | "url"> | null; closest?: boolean };

// The next step in plain words, and the notice it comes from.
export function WhatToDo({ children, recall, closest = false }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-paper px-[18px] py-4">
      <div className="text-[15px] leading-normal">
        <strong className="font-semibold">What to do:</strong> {children}
      </div>
      {recall && (
        <a href={recall.url} target="_blank" rel="noopener noreferrer" className="self-start font-mono text-[13px]">
          {closest ? "Closest notice" : "Official notice"} · {SOURCE_NAMES[recall.source] ?? recall.source} · {dayName(recall.publishedAt)} →
        </a>
      )}
    </div>
  );
}
