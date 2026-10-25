"use client";

import Link from "next/link";
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
  return /^https?:\/\/\S+$/i.test(value.trim());
}

type CheckError = { message: string; extensionLink?: boolean };

function StageMark({ state }: { state: "done" | "current" | "next" }) {
  if (state === "done") {
    return (
      <span aria-hidden="true" className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-safe text-[11px] font-bold text-ink">
        ✓
      </span>
    );
  }
  if (state === "current") {
    return <span aria-hidden="true" className="size-[18px] shrink-0 rounded-full border-[2.5px] border-brand border-r-transparent motion-safe:animate-[spin_0.8s_linear_infinite]" />;
  }
  return <span aria-hidden="true" className="size-[18px] shrink-0 rounded-full border-2 border-field" />;
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
    <ol role="status" aria-live="polite" className="m-0 flex list-none flex-col gap-2.5 self-center p-0 text-sm">
      {stages.map((stage, i) => (
        <li key={stage.label} className={`flex items-center gap-2.5 ${i <= current ? "text-ink" : "text-muted"}`}>
          <StageMark state={i < current ? "done" : i === current ? "current" : "next"} />
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
  const [error, setError] = useState<CheckError | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // The box grows with what's pasted, up to a limit after which it scrolls.
  useEffect(() => {
    const box = textarea.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 320)}px`;
  }, [value]);

  async function run(input: string, files: File[]) {
    if (!input.trim() && files.length === 0) {
      setError({ message: "Paste a listing link or its text, or add a photo." });
      return;
    }
    setError(null);
    setRunning({ withPhotos: files.length > 0 || isLink(input) });
    const body = new FormData();
    body.append(isLink(input) ? "url" : "text", input.trim());
    for (const file of files) body.append("photos", file);

    const response = await fetch("/api/check", { method: "POST", body }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { id?: string; error?: string; code?: string } | null;
    if (response?.ok && result?.id) {
      router.push(`/check/${result.id}`);
      return;
    }
    setError({ message: result?.error ?? "The check failed. Please try again.", extensionLink: result?.code === "link_blocked" });
    setRunning(null);
  }

  function addPhotos(files: FileList | null) {
    const picked = [...(files ?? [])].filter((file) => file.type.startsWith("image/"));
    if (picked.some((file) => file.size > MAX_BYTES)) setError({ message: "Each photo must be 8 MB or less." });
    setPhotos((current) => [...current, ...picked.filter((file) => file.size <= MAX_BYTES)].slice(0, MAX_PHOTOS));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(value, photos);
  }

  return (
    <div className="flex w-full max-w-[42rem] flex-col gap-3.5 text-left">
      <form onSubmit={submit} aria-busy={running !== null} className="flex flex-col gap-2.5">
        <label htmlFor="listing" className="text-[13px] text-ink-2">
          Listing title and description, or a Vinted link
        </label>
        <div className="flex flex-wrap items-center gap-2 rounded-[28px] border border-field bg-surface py-1.5 pr-1.5 pl-5 shadow-[0_18px_40px_-24px_rgba(70,52,30,0.4)] focus-within:border-brand">
          <textarea
            id="listing"
            ref={textarea}
            rows={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              // Enter checks, as in a search box; Shift+Enter adds a line.
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Trottinette électrique Acer ES Series 5…"
            maxLength={5000}
            disabled={running !== null}
            className="min-h-11 min-w-0 flex-[999_1_200px] resize-none self-center border-0 bg-transparent py-2.5 text-base leading-snug text-ink outline-none placeholder:text-muted"
          />
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={running !== null || photos.length >= MAX_PHOTOS}
              className="min-h-[46px] cursor-pointer rounded-full border border-field bg-surface px-4 text-sm font-medium text-ink hover:border-ink disabled:cursor-default disabled:opacity-60"
            >
              {photos.length ? `Photos (${photos.length}/${MAX_PHOTOS})` : "Add photos"}
            </button>
            <button
              type="submit"
              disabled={running !== null}
              className="min-h-[46px] cursor-pointer rounded-full bg-ink px-[22px] text-[15px] font-semibold text-paper hover:bg-brand disabled:opacity-60"
            >
              {running ? "Checking…" : "Check it"}
            </button>
          </div>
        </div>
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
      </form>

      {photos.length > 0 && !running && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-sm">
          {photos.map((photo, i) => (
            <li key={`${photo.name}-${i}`} className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1.5 pl-3">
              <span className="max-w-[180px] truncate">{photo.name}</span>
              <button
                type="button"
                onClick={() => setPhotos((current) => current.filter((_, j) => j !== i))}
                aria-label={`Remove ${photo.name}`}
                className="size-7 cursor-pointer rounded-full text-base text-ink-2 hover:bg-paper"
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
        <>
          <span className="text-center text-[13px] text-muted">
            Shopping on Leboncoin or Vinted? <Link href="#extension">Add the Chrome extension</Link> and it checks each listing you open.
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] text-muted">
            <span>Try:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => {
                  setValue(example.text);
                  void run(example.text, []);
                }}
                className="min-h-11 cursor-pointer rounded-full border border-line bg-surface px-3.5 text-[13px] text-ink hover:border-ink"
              >
                {example.label}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="m-0 text-center text-[15px] text-recalled-text">
          {error.message}
          {error.extensionLink && (
            <>
              {" "}
              <Link href="/how-it-works#extension" className="font-semibold text-recalled-text underline">
                How to install it
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
