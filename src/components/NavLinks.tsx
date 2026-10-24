"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Check a listing" },
  { href: "/recalls", label: "Recent recalls" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/platforms", label: "For platforms" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/check");
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Without a pathname (while the URL is not known yet) no link is marked as active.
export function NavLinkList({ pathname }: { pathname: string | null }) {
  return (
    <>
      {LINKS.map(({ href, label }) => {
        const active = pathname !== null && isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-brand-soft px-3.5 py-2 text-[15px] font-semibold text-brand no-underline hover:text-brand"
                : "px-3.5 py-2 text-[15px] font-medium text-ink-2 no-underline hover:text-ink"
            }
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function NavLinks() {
  return <NavLinkList pathname={usePathname()} />;
}
