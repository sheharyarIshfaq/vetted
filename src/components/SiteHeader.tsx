import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { VerdictSticker } from "./VerdictSticker";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
          <VerdictSticker verdict="brand" size={34} decorative />
          <span className="text-[26px] font-extrabold tracking-[-0.04em]">tiko</span>
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          <NavLinks />
          <Link
            href="/how-it-works#extension"
            className="ml-2 rounded-[10px] bg-ink px-4 py-[9px] text-[15px] font-bold text-white no-underline hover:text-white"
          >
            Add to Chrome
          </Link>
        </nav>
      </div>
    </header>
  );
}
