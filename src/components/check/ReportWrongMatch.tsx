"use client";

import { useState, type FormEvent } from "react";

export function ReportWrongMatch({ checkId, alreadyFlagged }: { checkId: string; alreadyFlagged: boolean }) {
  const [state, setState] = useState<"closed" | "open" | "sending" | "sent" | "failed">(alreadyFlagged ? "sent" : "closed");
  const [note, setNote] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("sending");
    const response = await fetch(`/api/check/${checkId}/flag`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: note || undefined }),
    }).catch(() => null);
    setState(response?.ok ? "sent" : "failed");
  }

  if (state === "sent") {
    return <p role="status" className="m-0 self-center text-[15px] text-ink-2">Thanks. This match is flagged for review.</p>;
  }
  if (state === "closed") {
    return (
      <button
        type="button"
        onClick={() => setState("open")}
        className="min-h-11 cursor-pointer rounded-full border border-field bg-surface px-5 py-2.5 text-[15px] font-medium text-ink hover:border-ink"
      >
        Report a wrong match
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2">
      <label htmlFor="flag-note" className="text-[15px] font-semibold">
        What looks wrong? <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id="flag-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={1000}
        rows={3}
        className="rounded-2xl border border-field bg-surface p-3 text-[15px]"
      />
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="submit"
          disabled={state === "sending"}
          className="min-h-11 cursor-pointer rounded-full bg-ink px-5 py-2.5 text-[15px] font-semibold text-paper hover:bg-brand disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => setState("closed")} className="min-h-11 cursor-pointer px-2 text-[15px] font-medium text-brand">
          Cancel
        </button>
        {state === "failed" && <span role="alert" className="text-[15px] text-recalled-text">That didn&apos;t go through. Try again.</span>}
      </div>
    </form>
  );
}
