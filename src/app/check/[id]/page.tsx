import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckLabelLayout } from "./CheckLabelLayout";
import { ClearLayout } from "./ClearLayout";
import { loadCheck } from "./load-check";
import { RecalledLayout } from "./RecalledLayout";

export const metadata: Metadata = { title: "Check result · Vetted" };

async function CheckView({ params }: { params: PageProps<"/check/[id]">["params"] }) {
  const { id } = await params;
  const check = await loadCheck(id);
  if (!check) notFound();
  if (check.verdict === "recalled" && check.recall && check.limits) {
    return <RecalledLayout check={{ ...check, recall: check.recall, limits: check.limits }} />;
  }
  if (check.verdict === "check_label" && check.recall && check.limits) {
    return <CheckLabelLayout check={{ ...check, recall: check.recall, limits: check.limits }} />;
  }
  return <ClearLayout check={check} />;
}

function Loading() {
  return (
    <div role="status" className="rounded-[18px] border border-line bg-surface p-6 text-ink-2">
      Loading the check…
    </div>
  );
}

export default function CheckPage({ params }: PageProps<"/check/[id]">) {
  return (
    <div className="mx-auto flex max-w-[1160px] flex-col gap-5 px-4 pt-7 pb-14 sm:px-6">
      <Suspense fallback={<Loading />}>
        <CheckView params={params} />
      </Suspense>
      <p className="m-0 text-sm">
        <Link href="/" className="font-semibold">
          Check another listing
        </Link>
      </p>
    </div>
  );
}
