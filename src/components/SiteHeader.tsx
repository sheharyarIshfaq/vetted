import Link from "next/link";
import { VettedTag } from "./VettedTag";

const LINKS = [
  { href: "/#recall", label: "What's a recall?" },
  { href: "/#how", label: "How it works" },
  { href: "/#faq", label: "Questions" },
  { href: "/platforms", label: "For marketplaces" },
];

// Transparent, so the home hero shows through it; the hero pulls itself up by the header's height.
export function SiteHeader() {
  return (
    <header className="relative z-10 h-[120px] md:h-[86px]">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-4 sm:px-7 md:py-[22px]">
        <Link href="/" aria-label="Vetted home" className="flex min-h-11 items-center gap-2 text-xl font-bold tracking-[-0.05em] text-ink no-underline hover:text-ink">
          <VettedTag variant="brand" width={30} decorative />
          vetted
        </Link>
        <Link
          href="/#extension"
          className="inline-flex min-h-11 items-center rounded-full border border-ink px-[18px] text-sm font-medium text-ink no-underline hover:bg-ink hover:text-paper md:order-last"
        >
          Add to Chrome
        </Link>
        <nav aria-label="Main" className="-mx-2 flex w-full gap-x-1 overflow-x-auto text-[15px] md:mx-0 md:w-auto md:gap-x-[18px]">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="flex min-h-11 shrink-0 items-center px-2 text-ink no-underline hover:text-brand">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
