"use client";

import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";

const MAX_BYTES = 8 * 1024 * 1024;

export function LabelUpload({ checkId }: { checkId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "reading">("idle");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("The label photo must be an image.");
    if (file.size > MAX_BYTES) return setError("The photo must be 8 MB or less.");

    setError(null);
    setState("reading");
    const body = new FormData();
    body.append("photo", file);
    const response = await fetch(`/api/check/${checkId}/label`, { method: "POST", body }).catch(() => null);
    if (response?.ok) {
      router.refresh();
      return;
    }
    const result = (await response?.json().catch(() => null)) as { error?: string } | null;
    setError(result?.error ?? "That didn't go through. Try again.");
    setState("idle");
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void send(event.dataTransfer.files[0]);
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="label-photo"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-5 text-center ${
          dragging ? "border-brand bg-brand-soft" : "border-field bg-paper"
        } ${state === "reading" ? "pointer-events-none opacity-70" : ""}`}
      >
        <span className="text-[15px] font-semibold">{state === "reading" ? "Reading the label…" : "Add a photo of the label"}</span>
        <span className="text-sm text-muted">
          {state === "reading" ? "This takes a few seconds." : "Drop it here or choose a file. Get close so the small print is sharp."}
        </span>
      </label>
      <input
        id="label-photo"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={state === "reading"}
        onChange={(event) => {
          void send(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <p role="status" aria-live="polite" className="m-0 text-sm text-recalled-text">
        {error}
      </p>
    </div>
  );
}
