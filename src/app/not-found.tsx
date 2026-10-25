import type { Metadata } from "next";
import Link from "next/link";
import { VettedTag } from "@/components/VettedTag";
import { Accent, ButtonLink, Eyebrow } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found · Vetted" };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[44rem] flex-col items-center gap-6 px-4 pt-20 pb-28 text-center sm:pt-28">
      <VettedTag variant="plain" width={84} decorative />
      <Eyebrow>Error 404</Eyebrow>
      <h1 className="m-0 text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.05em] text-balance sm:text-[3.2rem]">
        This page <Accent>doesn&apos;t exist.</Accent>
      </h1>
      <p className="m-0 text-lg leading-[1.6] text-ink-2">
        The link may be mistyped, or the page has moved. A check or recall link can also stop working if its id is incomplete.
      </p>
      <div className="flex flex-wrap justify-center gap-2.5">
        <ButtonLink href="/">Check a listing</ButtonLink>
        <ButtonLink href="/try" variant="secondary">
          Try real recalled listings
        </ButtonLink>
      </div>
      <Link href="/recalls" className="text-[15px] font-semibold">
        Browse recent recalls
      </Link>
    </div>
  );
}
