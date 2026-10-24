"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { EXAMPLES } from "./examples";

const MAX_PHOTOS = 3;
const MAX_BYTES = 8 * 1024 * 1024;

// The check is one request, so the stages advance on typical timings rather than live progress.
const STAGES = [
  { label: "Reading the listing", after: 0 },
  { label: "Searching the recall lists", after: 3500 },
  { label: "Comparing photos", after: 4500 },
];

function isLink(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function Progress({ withPhotos }: { withPhotos: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = performance.now();
    const timer = setInterval(() => setElapsed(performance.now() - started), 250);
    return () => clearInterval(timer);
  }, []);
  const stages = withPhotos ? STAGES : STAGES.slice(0, 2);
  const current = stages.findLastIndex((stage) => elapsed >= stage.after);
  return (
    <ol role="status" aria-live="polite" className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
      {stages.map((stage, i) => (
        <li key={stage.label} className={i <= current ? "text-ink" : "text-muted"}>
          <span aria-hidden="true" className="inline-block w-5 font-mono">
            {i < current ? "✓" : i === current ? "…" : ""}
          </span>
          {stage.label}
          {i === current && <span className="sr-only"> (in progress)</span>}
        </li>
      ))}
    </ol>
  );
}

export function CheckForm() {
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [running, setRunning] = useState<{ withPhotos: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(input: string, files: File[]) {
    if (!input.trim() && files.length === 0) {
      setError("Paste a listing link or its text, or add a photo.");
      return;
    }
    setError(null);
    setRunning({ withPhotos: files.length > 0 || isLink(input) });
    const body = new FormData();
    body.append(isLink(input) ? "url" : "text", input.trim());
    for (const file of files) body.append("photos", file);

    const response = await fetch("/api/check", { method: "POST", body }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (response?.ok && result?.id) {
      router.push(`/check/${result.id}`);
      return;
    }
    setError(result?.error ?? "The check failed. Please try again.");
    setRunning(null);
  }

  function addPhotos(files: FileList | null) {
    const picked = [...(files ?? [])].filter((file) => file.type.startsWith("image/"));
    if (picked.some((file) => file.size > MAX_BYTES)) setError("Each photo must be 8 MB or less.");
    setPhotos((current) => [...current, ...picked.filter((file) => file.size <= MAX_BYTES)].slice(0, MAX_PHOTOS));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(value, photos);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <form
        onSubmit={submit}
        aria-busy={running !== null}
        className="flex flex-wrap gap-2.5 rounded-2xl border border-field bg-surface p-2 shadow-[0_6px_24px_rgba(22,32,43,0.06)]"
      >
        <label htmlFor="listing" className="sr-only">
          Listing link or text
        </label>
        <input
          id="listing"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Paste a Leboncoin or Vinted link, or the listing title"
          maxLength={5000}
          disabled={running !== null}
          className="min-w-0 flex-[999_1_280px] border-0 bg-transparent px-3.5 py-3.5 text-[17px] text-ink outline-none"
        />
        <button
          type="button"
          onClick={() => photoInput.current?.click()}
          disabled={running !== null || photos.length >= MAX_PHOTOS}
          className="min-h-11 cursor-pointer rounded-xl border border-field bg-surface px-3.5 py-3 text-[15px] font-semibold text-ink disabled:cursor-default disabled:opacity-60"
        >
          {photos.length ? `Photos (${photos.length}/${MAX_PHOTOS})` : "Add photos"}
        </button>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            addPhotos(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="submit"
          disabled={running !== null}
          className="min-h-11 cursor-pointer rounded-xl bg-brand px-[22px] py-3.5 text-base font-bold text-white disabled:opacity-60"
        >
          {running ? "Checking…" : "Check"}
        </button>
      </form>

      {photos.length > 0 && !running && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-sm">
          {photos.map((photo, i) => (
            <li key={`${photo.name}-${i}`} className="flex items-center gap-1.5 rounded-full bg-[#ECEFEC] py-1 pr-1.5 pl-3">
              <span className="max-w-[180px] truncate">{photo.name}</span>
              <button
                type="button"
                onClick={() => setPhotos((current) => current.filter((_, j) => j !== i))}
                aria-label={`Remove ${photo.name}`}
                className="size-7 cursor-pointer rounded-full text-base text-ink-2 hover:bg-surface"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {running ? (
        <Progress withPhotos={running.withPhotos} />
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => {
                setValue(example.text);
                void run(example.text, []);
              }}
              className="min-h-8 cursor-pointer rounded-full bg-[#ECEFEC] px-3 py-1.5 text-sm text-ink hover:bg-line"
            >
              {example.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 text-[15px] text-recalled-text">
          {error}
        </p>
      )}
    </div>
  );
}
