import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getRecalls } from "@/lib/db/recalls";
import { recallHref } from "@/lib/recalls";
import { OfficialImage } from "./OfficialImage";
import { PRODUCTS, VERDICT_PILL } from "./products";

function Card({ product, image }: { product: (typeof PRODUCTS)[number]; image: string | null }) {
  return (
    <figure className="m-0 flex h-full flex-col gap-3 rounded-[20px] border border-line bg-surface px-2.5 pt-2.5 pb-4 group-hover:border-field">
      <OfficialImage src={image} fallback={product.fallback} alt={product.alt} className="h-[220px] w-full rounded-xl bg-surface object-contain" />
      <figcaption className="flex flex-col gap-1.5 px-1.5">
        <span className="text-base font-semibold">{product.name}</span>
        <span className="text-sm leading-[1.45] text-ink-2">{product.line}</span>
        <span className={`self-start rounded-full px-2.5 py-[5px] font-mono text-[11px] ${VERDICT_PILL[product.verdict]}`}>{product.tag}</span>
      </figcaption>
    </figure>
  );
}

// Each card links to its recall once the recall is found in the database.
async function Cards() {
  await connection();
  const recalls = await getRecalls(PRODUCTS.map((product) => product.recallId));
  return PRODUCTS.map((product) => {
    const recall = recalls.find((row) => row.id === product.recallId);
    return (
      <li key={product.recallId}>
        {recall ? (
          <Link href={recallHref(recall.id)} className="group block h-full rounded-[20px] text-ink no-underline hover:text-ink">
            <Card product={product} image={"cropped" in product ? null : (recall.images[0] ?? null)} />
          </Link>
        ) : (
          <Card product={product} image={null} />
        )}
      </li>
    );
  });
}

function SavedCards() {
  return PRODUCTS.map((product) => (
    <li key={product.recallId}>
      <Card product={product} image={null} />
    </li>
  ));
}

export function RecalledProducts() {
  return (
    <section className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 pt-12 pb-16 sm:px-7 sm:pt-[72px] sm:pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="m-0 max-w-[34ch] text-[1.6rem] leading-[1.1] font-semibold tracking-[-0.04em] text-balance sm:text-[2rem]">
          All four were for sale on Leboncoin on 24 October. All four are on an official danger list.
        </h2>
        <span className="font-mono text-xs text-muted">Photos: official recall notices</span>
      </div>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4 p-0">
        <Suspense fallback={<SavedCards />}>
          <Cards />
        </Suspense>
      </ul>
    </section>
  );
}
