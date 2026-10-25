"use client";

import { useState } from "react";
import type { PlatformResponse } from "@/lib/check/platform";
import { ACTION_STYLES } from "./actions";

// Listings that were for sale on Leboncoin, one for each action.
const SAMPLES = [
  {
    label: "Acer ES Series 5 scooter",
    body: {
      listing_id: "3247445342",
      title: "Trottinette électrique Acer ES Series 5 – 470W – Noir – État neuf",
      description:
        "Je vends ma trottinette électrique Acer ES Series 5 (470 W crête / 350 W nominal), noire, achetée neuve et très peu utilisée.",
      url: "https://www.leboncoin.fr/ad/sport_plein_air/3247445342",
    },
  },
  { label: "Hamax Buddy bike seat", body: { listing_id: "demo-hamax", title: "Siège enfant Hamax Buddy, très bon état" } },
  { label: "Bébé Confort Sunlite stroller", body: { listing_id: "demo-sunlite", title: "Poussette Bébé Confort Sunlite, très bon état" } },
];

export function TryIt() {
  const [chosen, setChosen] = useState(0);
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<PlatformResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setRunning(true);
    setResponse(null);
    setError(null);
    try {
      const reply = await fetch("/api/v1/listings/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(SAMPLES[chosen].body),
      });
      const payload = (await reply.json()) as PlatformResponse | { error: string };
      if ("error" in payload) setError(`${reply.status} · ${payload.error}`);
      else setResponse(payload);
    } catch {
      setError("The request didn't reach Vetted. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  const action = response ? ACTION_STYLES[response.suggested_action] : null;

  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
      <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
        <legend className="mb-2.5 text-[15px] font-semibold">Pick a real listing to send</legend>
        {SAMPLES.map((sample, i) => (
          <label
            key={sample.label}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-field px-4 text-[15px] has-checked:border-ink has-checked:bg-ink has-checked:text-paper"
          >
            <input
              type="radio"
              name="sample"
              checked={chosen === i}
              onChange={() => {
                setChosen(i);
                setResponse(null);
                setError(null);
              }}
              className="sr-only"
            />
            {sample.label}
          </label>
        ))}
      </fieldset>

      <pre className="m-0 overflow-x-auto rounded-xl bg-paper p-4 font-mono text-[13px] leading-[1.6] text-ink-2">
        {JSON.stringify(SAMPLES[chosen].body, null, 2)}
      </pre>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void send()}
          disabled={running}
          className="inline-flex min-h-12 cursor-pointer items-center rounded-full bg-ink px-[22px] font-semibold text-paper hover:bg-brand disabled:cursor-wait disabled:opacity-70"
        >
          {running ? "Checking…" : "Send this listing"}
        </button>
        <span role="status" className="text-sm text-muted">
          {running ? "Usually a few seconds." : ""}
        </span>
      </div>

      {error && (
        <p role="alert" className="m-0 text-[15px] text-recalled-text">
          {error}
        </p>
      )}

      {response && action && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[15px] font-semibold">Suggested action:</span>
            <span className={`rounded-full px-3 py-1.5 text-[14px] font-semibold ${action.pill}`}>{action.label}</span>
          </div>
          <pre className="m-0 max-h-[420px] overflow-auto rounded-xl bg-ink p-4 font-mono text-[13px] leading-[1.6] whitespace-pre-wrap text-[#D8E3DD]">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
