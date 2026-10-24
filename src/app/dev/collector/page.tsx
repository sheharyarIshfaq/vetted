import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookmarkletLink } from "./BookmarkletLink";

export const metadata: Metadata = { title: "Collector · Vetted dev" };

export default function CollectorPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <section className="mx-auto flex max-w-[720px] flex-col gap-5 px-4 py-12 sm:px-6">
      <div className="font-mono text-[13px] tracking-[0.06em] text-brand uppercase">Dev only</div>
      <h1 className="m-0 text-[32px] leading-tight font-extrabold tracking-[-0.02em]">Test-set collector</h1>
      <p className="m-0 text-[17px] leading-normal text-ink-2">
        Save listings you open yourself on Leboncoin or Vinted into <code className="font-mono text-[15px]">content/eval/listings.json</code>,
        one click each. Nothing is crawled.
      </p>

      <ol className="m-0 flex flex-col gap-3 pl-5 text-[16px] leading-normal">
        <li>
          Show the bookmarks bar (<kbd className="font-mono text-sm">⌘ Shift B</kbd> on Mac, <kbd className="font-mono text-sm">Ctrl Shift B</kbd>{" "}
          elsewhere).
        </li>
        <li>
          Drag this button onto the bookmarks bar:
          <div className="mt-2 flex">
            <BookmarkletLink />
          </div>
        </li>
        <li>Open a listing in this browser, then click the bookmark. A small window opens and confirms the save.</li>
        <li>
          Set the expected verdict for each listing on{" "}
          <Link href="/dev/label" className="font-semibold">
            /dev/label
          </Link>
          .
        </li>
      </ol>

      <div className="rounded-2xl border border-line bg-surface p-5 text-[15px] leading-normal text-ink-2">
        <h2 className="m-0 mb-2 text-base font-bold text-ink">What it saves</h2>
        The page URL (without tracking parameters), og:title, the description text (or og:description), and up to 3 photos from the
        listing&apos;s gallery, downloaded to <code className="font-mono text-sm">content/eval/photos/</code>. It never reads seller
        names, usernames or profile photos. Keep this tool to listings you open yourself.
      </div>
    </section>
  );
}
