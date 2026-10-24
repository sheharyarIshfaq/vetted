"use client";

import { useState, type FormEvent } from "react";

export function WatchForm({ brandNorm, model }: { brandNorm: string | null; model: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);
    const response = await fetch("/api/watch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, brandNorm, model }),
    }).catch(() => null);
    if (response?.ok) {
      setState("saved");
      return;
    }
    const body = (await response?.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error ?? "That didn't go through. Try again.");
    setState("idle");
  }

  if (state === "saved") {
    return (
      <p role="status" className="m-0 flex-[1_1_340px] text-[15px] text-ink-2">
        Saved for {email}. Email alerts are coming soon.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-[1_1_340px] flex-wrap gap-2.5">
      <label htmlFor="watch-email" className="sr-only">
        Email
      </label>
      <input
        id="watch-email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        className="min-h-11 min-w-0 flex-[999_1_200px] rounded-[10px] border border-field px-3.5 py-3 text-[15px]"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="min-h-11 cursor-pointer rounded-[10px] bg-brand px-[18px] py-3 text-[15px] font-bold text-white disabled:opacity-60"
      >
        Watch this item
      </button>
      {error && (
        <p role="alert" className="m-0 w-full text-sm text-recalled-text">
          {error}
        </p>
      )}
    </form>
  );
}
