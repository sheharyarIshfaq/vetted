"use server";

import { z } from "zod";
import { listRecalls } from "@/lib/db/recalls";
import { expectedSchema, labelListing } from "@/lib/eval/listings";

function assertDev() {
  if (process.env.NODE_ENV !== "development") throw new Error("Only available in development");
}

const labelSchema = z.object({
  id: z.string().regex(/^[a-z]+-\d{3}$/),
  expected: expectedSchema.nullable(),
  expectedRecallId: z.string().regex(/^(rc|sg):\S+$/).nullable(),
});

export async function saveLabel(input: z.input<typeof labelSchema>) {
  assertDev();
  const { id, expected, expectedRecallId } = labelSchema.parse(input);
  const listing = await labelListing(id, expected, expectedRecallId);
  return listing !== null;
}

export async function searchRecalls(query: string) {
  assertDev();
  const q = z.string().trim().max(100).parse(query);
  if (q.length < 2) return [];
  const { items } = await listRecalls({ q, pageSize: 8 });
  return items.map((recall) => ({
    id: recall.id,
    productName: recall.productName,
    brand: recall.brand,
    publishedAt: recall.publishedAt,
  }));
}
