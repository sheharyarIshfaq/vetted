"use client";

import { useState } from "react";

type Props = { message: string; label: string; variant?: "primary" | "secondary" };

export function CopyMessageButton({ message, label, variant = "secondary" }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  const style =
    variant === "primary"
      ? "border-0 bg-ink text-white font-bold"
      : "border border-field bg-surface text-ink font-semibold";
  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={copy}
        className={`min-h-11 cursor-pointer rounded-[10px] px-[18px] py-[11px] text-[15px] ${style}`}
      >
        {state === "copied" ? "Copied" : label}
      </button>
      <span role="status" className="text-[13px] text-muted">
        {state === "failed" ? "Copy didn't work. Select the message and copy it by hand." : ""}
      </span>
    </span>
  );
}
