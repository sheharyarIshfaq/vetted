import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// The small uppercase label above a section heading.
export function Eyebrow({ children, className = "text-brand" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-xs tracking-[0.12em] uppercase ${className}`}>{children}</span>;
}

// The serif italic second half of a heading.
export function Accent({ children }: { children: ReactNode }) {
  return <span className="font-serif font-normal tracking-[-0.03em] text-brand italic">{children}</span>;
}

const BUTTON = "inline-flex min-h-12 items-center justify-center rounded-full px-[22px] text-center no-underline";

export const buttonStyles = {
  primary: `${BUTTON} bg-ink font-semibold text-paper hover:bg-brand hover:text-paper`,
  secondary: `${BUTTON} border border-ink font-medium text-ink hover:bg-ink hover:text-paper`,
};

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link {...props} className={`${buttonStyles[variant]} ${className}`} />;
}
