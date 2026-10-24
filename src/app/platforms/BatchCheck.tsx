"use client";

import Link from "next/link";
import { useState } from "react";
import type { BatchResult } from "@/lib/check/batch";
import { capitalize } from "@/lib/check/copy";
import type { Verdict } from "@/lib/verdict";

type Line = { type: "start"; total: number } | ({ type: "row" } & BatchResult) | { type: "done" };

const VERDICTS: Record<Verdict, { icon: string; label: string; counted: string; pill: string; action: string; done: string }> = {
  recalled: { icon: "✕", label: "Recalled", counted: "recalled", pill: "bg-recalled-soft text-recalled-text", action: "Take down", done: "Taken down" },
  check_label: { icon: "!", label: "Check label", counted: "check label", pill: "bg-check-soft text-check-text", action: "Ask seller", done: "Seller asked" },
  clear: { icon: "✓", label: "Clear", counted: "clear", pill: "bg-safe-soft text-safe-text", action: "Approve", done: "Approved" },
};

const SOURCE_NAMES: Record<string, string> = { rc: "RappelConso", sg: "Safety Gate" };

function MatchedRecall({ recall }: { recall: BatchResult["recall"] }) {
  if (!recall || recall.relation !== "match") return <span className="text-muted">No match</span>;
  return (
    <>
      <span className="font-mono text-[13px]">
        {SOURCE_NAMES[recall.id.split(":")[0]]} {recall.sourceRef}
      </span>
      <span> · {capitalize(recall.productName)}</span>
    </>
  );
}

export function BatchCheck() {
  const [file, setFile] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [handled, setHandled] = useState<Record<number, boolean>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(chosen: File) {
    setFile(chosen.name);
    setResults([]);
    setHandled({});
    setTotal(0);
    setError(null);
    setRunning(true);
    try {
      const body = new FormData();
      body.append("file", chosen);
      const response = await fetch("/api/batch", { method: "POST", body });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "The batch check failed. Please try again.");
        return;
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const text of lines.filter(Boolean)) {
          const line = JSON.parse(text) as Line;
          if (line.type === "start") setTotal(line.total);
          if (line.type === "row") setResults((current) => [...current, line].sort((a, b) => a.line - b.line));
        }
      }
    } catch {
      setError("The connection dropped before every listing was checked. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  const counts = { recalled: 0, check_label: 0, clear: 0 };
  for (const result of results) if (result.verdict) counts[result.verdict]++;

  return (
    <section id="batch" aria-labelledby="queue-title" className="scroll-mt-6 overflow-hidden rounded-[20px] border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 id="queue-title" className="m-0 text-lg font-semibold">
            Review queue
          </h2>
          <div role="status" className="text-[13px] text-muted">
            {file
              ? `${file} · ${running ? `checking, ${results.length} of ${total || "…"} done` : `${results.length} items checked`}`
              : "Upload a CSV to check your listings"}
          </div>
        </div>
        {results.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VERDICTS) as Verdict[]).map((verdict) => (
              <span key={verdict} className={`rounded-full px-2.5 py-1.5 text-[13px] font-semibold ${VERDICTS[verdict].pill}`}>
                {VERDICTS[verdict].icon} {counts[verdict]} {VERDICTS[verdict].counted}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-ink px-4 text-[15px] font-semibold text-paper has-disabled:cursor-not-allowed has-disabled:opacity-60">
          {file ? "Upload another CSV" : "Upload a CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={running}
            className="sr-only"
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              event.target.value = "";
              if (chosen) void upload(chosen);
            }}
          />
        </label>
        <span className="text-sm text-ink-2">
          Columns: <span className="font-mono">title, description, image_url</span>. Up to 200 rows.{" "}
          <a href="/examples/listings.csv" download className="font-semibold">
            Download an example
          </a>
        </span>
      </div>

      {error && (
        <p role="alert" className="m-0 px-5 pb-4 text-[15px] text-recalled-text">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[15px]">
            <thead>
              <tr className="bg-paper">
                <th scope="col" className="px-5 py-2.5 text-left text-[13px] font-semibold text-muted">Listing</th>
                <th scope="col" className="px-3 py-2.5 text-left text-[13px] font-semibold text-muted">Matched recall</th>
                <th scope="col" className="px-3 py-2.5 text-left text-[13px] font-semibold text-muted">Verdict</th>
                <th scope="col" className="px-5 py-2.5 text-right text-[13px] font-semibold text-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => {
                const verdict = result.verdict ? VERDICTS[result.verdict] : null;
                const done = handled[result.line];
                return (
                  <tr key={result.line} className="border-t border-line">
                    <td className="px-5 py-3">
                      <div className="font-semibold break-words">{result.title}</div>
                      <div className="font-mono text-xs text-muted">
                        line {result.line}
                        {result.checkId && (
                          <>
                            {" · "}
                            <Link href={`/check/${result.checkId}`} target="_blank" className="font-sans font-semibold">
                              Open the check
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-2">
                      {result.error ? <span className="text-recalled-text">{result.error}</span> : <MatchedRecall recall={result.recall} />}
                    </td>
                    <td className="px-3 py-3">
                      {verdict && (
                        <span className={`rounded-full px-2.5 py-[5px] text-[13px] font-semibold whitespace-nowrap ${verdict.pill}`}>
                          {verdict.icon} {verdict.label}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {verdict && (
                        <button
                          type="button"
                          aria-pressed={Boolean(done)}
                          onClick={() => setHandled((current) => ({ ...current, [result.line]: !done }))}
                          className={`min-h-10 cursor-pointer rounded-lg border px-3 text-sm font-semibold whitespace-nowrap ${
                            done ? "border-transparent bg-paper text-muted" : "border-field bg-surface text-ink"
                          }`}
                        >
                          {done ? `${verdict.done} · Undo` : verdict.action}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
