"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AddToChrome } from "./AddToChrome";
import { VettedTag } from "./VettedTag";

const LINKS = [
  { href: "/#recall", label: "What's a recall?" },
  { href: "/#how", label: "How it works" },
  { href: "/#faq", label: "Questions" },
  { href: "/platforms", label: "For platforms" },
];

const linkStyle = "flex min-h-11 shrink-0 items-center px-2 text-ink no-underline hover:text-brand";
const chromeStyle =
  "min-h-11 items-center justify-center rounded-full border border-ink px-[18px] text-sm font-medium text-ink no-underline hover:bg-ink hover:text-paper";

// Sticky and clear at the top, so the home hero shows through; it gains a background once the page scrolls.
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={`sticky top-0 z-30 border-b transition-colors duration-200 ${
        solid ? "border-divider bg-paper/90 backdrop-blur-md" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-7 md:h-[86px]">
        <Link
          href="/"
          aria-label="Vetted home"
          onClick={() => setOpen(false)}
          className="flex min-h-11 items-center gap-2 text-xl font-bold tracking-[-0.05em] text-ink no-underline hover:text-ink"
        >
          <VettedTag variant="brand" width={30} decorative />
          vetted
        </Link>
        <nav aria-label="Main" className="hidden gap-x-[18px] text-[15px] md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkStyle}>
              {link.label}
            </Link>
          ))}
        </nav>
        <AddToChrome className={`${chromeStyle} hidden md:inline-flex`}>Add to Chrome</AddToChrome>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-field bg-surface px-4 text-sm font-medium text-ink md:hidden"
        >
          <span aria-hidden="true" className="flex w-3.5 flex-col gap-[3px]">
            <span className={`h-[1.5px] bg-ink transition-transform ${open ? "translate-y-[4.5px] rotate-45" : ""}`} />
            <span className={`h-[1.5px] bg-ink transition-opacity ${open ? "opacity-0" : ""}`} />
            <span className={`h-[1.5px] bg-ink transition-transform ${open ? "-translate-y-[4.5px] -rotate-45" : ""}`} />
          </span>
          Menu
        </button>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Main" className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-divider bg-paper px-4 pt-1 pb-5 text-[17px] shadow-[0_18px_30px_-24px_rgba(70,52,30,0.5)] md:hidden">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={`${linkStyle} border-b border-divider`}>
              {link.label}
            </Link>
          ))}
          <AddToChrome onClick={() => setOpen(false)} className={`${chromeStyle} mt-3 flex`}>
            Add to Chrome
          </AddToChrome>
        </nav>
      )}
    </header>
  );
}
