import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Privacy · Vetted" };

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="flex flex-col gap-2.5 text-[17px] leading-[1.6] text-ink-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-10 px-4 pt-12 pb-20 sm:px-6">
      <div className="flex flex-col gap-3">
        <h1 className="m-0 text-[36px] leading-[1.08] font-semibold tracking-[-0.045em] sm:text-[44px]">Privacy</h1>
        <p className="m-0 text-lg leading-[1.55] text-ink-2">
          Vetted needs a listing to check it, and nothing else. There are no accounts and no ads.
        </p>
      </div>

      <Part title="What the extension reads">
        <p className="m-0">
          Only listing pages on Leboncoin (<span className="font-mono text-[15px]">leboncoin.fr/ad/…</span>) and Vinted (
          <span className="font-mono text-[15px]">vinted.fr/items/…</span>). On those pages it reads the listing&apos;s title,
          description and photos, and the page address.
        </p>
        <p className="m-0">
          It doesn&apos;t read any other site or page, your Leboncoin or Vinted account, your messages or your browsing history.
        </p>
      </Part>

      <Part title="Where it goes">
        <p className="m-0">
          The listing is sent only to Vetted, to run the check. Vetted&apos;s server uses OpenAI to read the text and photos, then
          decides the answer from the official recall lists.
        </p>
        <p className="m-0">
          The check is saved on Vetted&apos;s server with its result, so the result page can be opened. Its photos are kept in
          private storage and are never published.
        </p>
      </Part>

      <Part title="What stays on your computer">
        <p className="m-0">
          The extension keeps your last 10 checks, for its &quot;Your checks&quot; list, only on your computer. Removing the extension
          deletes them.
        </p>
      </Part>

      <Part title="On this website">
        <p className="m-0">
          The text and photos you paste or upload are used the same way: read to run the check, and saved with its result. If you
          leave your email to watch an item, it is used only to tell you if that item is recalled.
        </p>
      </Part>

      <p className="m-0 text-[15px] text-muted">
        Questions? See <Link href="/how-it-works">how Vetted works</Link>.
      </p>
    </div>
  );
}
