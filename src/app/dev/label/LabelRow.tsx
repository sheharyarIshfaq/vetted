"use client";

import { useState, useTransition } from "react";
import type { EvalListing } from "@/lib/eval/listings";
import { saveLabel, searchRecalls } from "./actions";

type Expected = NonNullable<EvalListing["expected"]>;
type Found = Awaited<ReturnType<typeof searchRecalls>>[number];

const VERDICTS: { value: Expected; label: string; on: string }[] = [
  { value: "recalled", label: "Recalled", on: "border-recalled bg-recalled-soft text-recalled-text" },
  { value: "check_label", label: "Check the label", on: "border-check bg-check-soft text-check-text" },
  { value: "clear", label: "Clear", on: "border-safe bg-brand-soft text-safe-text" },
];

export function LabelRow({ listing }: { listing: EvalListing }) {
  const [expected, setExpected] = useState(listing.expected);
  const [recallId, setRecallId] = useState(listing.expectedRecallId);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(nextExpected: Expected | null, nextRecallId: string | null) {
    setExpected(nextExpected);
    setRecallId(nextRecallId);
    startTransition(async () => {
      const ok = await saveLabel({ id: listing.id, expected: nextExpected, expectedRecallId: nextRecallId }).catch(() => false);
      setStatus(ok ? "Saved" : "Not saved. Try again.");
    });
  }

  function search(value: string) {
    setQuery(value);
    startTransition(async () => setFound(await searchRecalls(value).catch(() => [])));
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Expected verdict" className="flex flex-wrap gap-2">
        {VERDICTS.map((verdict) => (
          <button
            key={verdict.value}
            type="button"
            aria-pressed={expected === verdict.value}
            onClick={() => save(expected === verdict.value ? null : verdict.value, verdict.value === "clear" ? null : recallId)}
            className={`min-h-10 cursor-pointer rounded-[10px] border px-3.5 py-2 text-sm font-semibold ${
              expected === verdict.value ? verdict.on : "border-field bg-surface text-ink"
            }`}
          >
            {verdict.label}
          </button>
        ))}
      </div>

      {expected && expected !== "clear" && (
        <div className="flex flex-col gap-2">
          <div className="text-sm">
            Recall:{" "}
            {recallId ? (
              <>
                <span className="font-mono">{recallId}</span>{" "}
                <button type="button" onClick={() => save(expected, null)} className="cursor-pointer text-sm font-semibold text-brand">
                  Clear
                </button>
              </>
            ) : (
              <span className="text-muted">none chosen</span>
            )}
          </div>
          <label className="sr-only" htmlFor={`recall-${listing.id}`}>
            Search recalls
          </label>
          <input
            id={`recall-${listing.id}`}
            type="search"
            value={query}
            onChange={(event) => search(event.target.value)}
            placeholder="Search recalls: brand, model or code"
            className="min-h-10 rounded-[10px] border border-field px-3 text-[15px]"
          />
          {found.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {found.map((recall) => (
                <li key={recall.id}>
                  <button
                    type="button"
                    onClick={() => {
                      save(expected, recall.id);
                      setFound([]);
                      setQuery("");
                    }}
                    className="w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper"
                  >
                    <span className="font-mono">{recall.id}</span> · {recall.productName}
                    {recall.brand ? ` · ${recall.brand}` : ""} · <span className="text-muted">{recall.publishedAt}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p role="status" className="m-0 min-h-5 text-xs text-muted">
        {pending ? "Saving…" : status}
      </p>
    </div>
  );
}
