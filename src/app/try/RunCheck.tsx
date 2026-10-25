"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Sends the saved listing text through the same check as the home page form, then opens its result.
export function RunCheck({ text, label }: { text: string; label: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("text", text);
      const response = await fetch("/api/check", { method: "POST", body });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        setError(payload.error ?? "The check failed. Please try again.");
        setRunning(false);
        return;
      }
      router.push(`/check/${payload.id}`);
    } catch {
      setError("The check failed. Please try again.");
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={running}
        aria-label={`Run this check: ${label}`}
        className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full bg-ink px-5 font-semibold text-paper hover:bg-brand disabled:cursor-wait disabled:opacity-70"
      >
        {running ? "Checking…" : "Run this check"}
      </button>
      {error && (
        <p role="alert" className="m-0 text-sm text-recalled-text">
          {error}
        </p>
      )}
    </div>
  );
}
