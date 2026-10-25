import Link from "next/link";
import { AddToChrome } from "./AddToChrome";
import { VettedTag } from "./VettedTag";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Check a listing" },
      { href: "/try", label: "Try it on real listings" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/how-it-works#extension", label: "Chrome extension" },
      { href: "/recalls", label: "Recent recalls" },
    ],
  },
  {
    title: "For business",
    links: [
      { href: "/platforms", label: "Vetted for platforms" },
      { href: "/platforms#api", label: "Listing check API" },
      { href: "/platforms#bulk", label: "Bulk check" },
      { href: "mailto:sheharyarishfaq@gmail.com?subject=Vetted", label: "Contact" },
    ],
  },
  {
    title: "Official sources",
    links: [
      { href: "https://rappel.conso.gouv.fr", label: "RappelConso" },
      { href: "https://ec.europa.eu/safety-gate-alerts", label: "EU Safety Gate" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

const LINK = "text-[15px] text-ink-2 no-underline hover:text-ink";

function FooterLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
        {label} ↗
      </a>
    );
  }
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={LINK}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={LINK}>
      {label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 pt-12 pb-8 sm:px-7">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
          <div className="flex flex-col items-start gap-3.5">
            <Link href="/" aria-label="Vetted home" className="flex items-center gap-2 text-xl font-bold tracking-[-0.05em] text-ink no-underline hover:text-ink">
              <VettedTag variant="brand" width={30} decorative />
              vetted
            </Link>
            <p className="m-0 max-w-[22rem] text-[15px] leading-[1.55] text-ink-2">
              Checks second-hand listings against official French and EU product recalls. Free, no account.
            </p>
            <AddToChrome className="inline-flex min-h-11 items-center rounded-full border border-ink px-[18px] text-sm font-medium text-ink no-underline hover:bg-ink hover:text-paper">
              Add to Chrome
            </AddToChrome>
          </div>
          <nav aria-label="Footer" className="contents">
            {COLUMNS.map((column) => (
              <div key={column.title} className="flex flex-col gap-3">
                <h2 className="m-0 font-mono text-xs font-normal tracking-[0.12em] text-muted uppercase">{column.title}</h2>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <FooterLink {...link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-6 text-[13px] leading-[1.55] text-muted">
          <p className="m-0">
            Recall data and product photos: RappelConso (Ministère de l&apos;Économie, Licence Ouverte 2.0) and EU Safety Gate.
            &ldquo;No recall found&rdquo; doesn&apos;t mean an item is safe. Always read the official notice.
          </p>
          <p className="m-0">Vetted is not affiliated with RappelConso, the European Commission, Leboncoin or Vinted.</p>
          <p className="m-0">© 2026 Vetted · Built solo at the OpenAI DevDay Community Hackathon Paris · #parisdevdayhack</p>
        </div>
      </div>
    </footer>
  );
}
