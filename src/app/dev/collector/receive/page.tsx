import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Receiver } from "./Receiver";

export const metadata: Metadata = { title: "Saving listing · Vetted dev" };

export default function ReceivePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <section className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-8">
      <Receiver />
      <Link href="/dev/label" target="_blank" className="text-[15px] font-semibold">
        Label collected listings
      </Link>
    </section>
  );
}
