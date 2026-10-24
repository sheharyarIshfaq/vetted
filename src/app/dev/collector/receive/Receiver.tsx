"use client";

import { useEffect, useState } from "react";

type Saved = { id: string; title: string; photos: number; duplicate: boolean };

export function Receiver() {
  const [state, setState] = useState<{ saved?: Saved; error?: string } | null>(null);

  useEffect(() => {
    const fragment = window.location.hash.slice(1);
    // The data shouldn't stay in the address bar or be sent again on reload.
    history.replaceState(null, "", window.location.pathname);

    async function save() {
      let payload: unknown;
      try {
        payload = JSON.parse(decodeURIComponent(fragment));
      } catch {
        return setState({ error: "Nothing to save. Click the bookmark on a listing page." });
      }
      const response = await fetch("/api/dev/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null);
      const body = (await response?.json().catch(() => null)) as (Saved & { error?: string }) | null;
      setState(response?.ok && body ? { saved: body } : { error: body?.error ?? "Saving failed. Is the dev server running?" });
    }
    void save();
  }, []);

  if (!state) return <p role="status">Saving…</p>;
  if (state.error) {
    return (
      <p role="alert" className="m-0 text-recalled-text">
        {state.error}
      </p>
    );
  }
  const { saved } = state;
  return (
    <div role="status" className="flex flex-col gap-2">
      <p className="m-0 text-lg font-bold">{saved!.duplicate ? `Already saved as ${saved!.id}` : `Saved as ${saved!.id}`}</p>
      <p className="m-0 text-ink-2">{saved!.title}</p>
      <p className="m-0 text-sm text-muted">
        {saved!.photos} photo{saved!.photos === 1 ? "" : "s"} saved. You can close this window.
      </p>
    </div>
  );
}
