"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export const EXTENSION_ZIP = "/vetted-extension.zip";

// The extension isn't in the Chrome Web Store, so the button downloads it and opens the install steps.
export function AddToChrome({ className, children, onClick }: { className: string; children: ReactNode; onClick?: () => void }) {
  const router = useRouter();
  return (
    <a
      href={EXTENSION_ZIP}
      download
      className={className}
      onClick={() => {
        onClick?.();
        router.push("/how-it-works#extension");
      }}
    >
      {children}
    </a>
  );
}
