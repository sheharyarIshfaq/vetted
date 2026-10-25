import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-3.5 px-4 py-7 text-[13px] text-muted sm:px-7">
        <span>
          Recall data and product photos: RappelConso (Ministère de l&apos;Économie, Licence Ouverte 2.0) and EU Safety Gate. Always
          read the official notice.
        </span>
        <span className="flex flex-wrap gap-x-4">
          <Link href="/recalls" className="text-muted hover:text-ink">
            Recent recalls
          </Link>
          <Link href="/privacy" className="text-muted hover:text-ink">
            Privacy
          </Link>
          <span>Built in Paris · #parisdevdayhack</span>
        </span>
      </div>
    </footer>
  );
}
