import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { downloadImage } from "../check/images";

export const EVAL_DIR = path.join(process.cwd(), "content/eval");
export const PHOTOS_DIR = path.join(EVAL_DIR, "photos");
const LISTINGS_FILE = path.join(EVAL_DIR, "listings.json");
const MAX_PHOTOS = 3;

export const expectedSchema = z.enum(["recalled", "check_label", "clear"]);

export const listingSchema = z.object({
  id: z.string(),
  source: z.string(),
  collectedOn: z.string(),
  url: z.string().optional(),
  title: z.string(),
  description: z.string(),
  photos: z.array(z.string()),
  expected: expectedSchema.nullable(),
  expectedRecallId: z.string().nullable(),
  notes: z.string().optional(),
});

export type EvalListing = z.infer<typeof listingSchema>;

// What the bookmarklet reads from the page the user is viewing. Nothing about the seller is collected.
export const collectInputSchema = z.object({
  url: z.url({ protocol: /^https$/ }),
  title: z.string().trim().max(300),
  ogDescription: z.string().trim().max(5000),
  description: z.string().trim().max(5000),
  images: z.array(z.url({ protocol: /^https$/ })).max(20),
});

export type CollectInput = z.infer<typeof collectInputSchema>;

// Query strings and fragments carry tracking, not the listing.
export function cleanUrl(url: string) {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

export function sourceOf(url: string) {
  const host = new URL(url).hostname;
  if (/(^|\.)leboncoin\.fr$/.test(host)) return "leboncoin";
  if (/(^|\.)vinted\.[a-z.]+$/.test(host)) return "vinted";
  return host.replace(/^www\./, "");
}

const PREFIXES: Record<string, string> = { leboncoin: "lbc", vinted: "vin" };

// "lbc-007": the source's prefix and the next free number for it.
export function nextId(listings: readonly EvalListing[], source: string) {
  const prefix = PREFIXES[source] ?? "web";
  const used = listings
    .map((listing) => new RegExp(`^${prefix}-(\\d+)$`).exec(listing.id)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  return `${prefix}-${String(Math.max(0, ...used) + 1).padStart(3, "0")}`;
}

export async function readListings(): Promise<EvalListing[]> {
  try {
    return z.array(listingSchema).parse(JSON.parse(await readFile(LISTINGS_FILE, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeListings(listings: EvalListing[]) {
  const temp = `${LISTINGS_FILE}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(listings, null, 2)}\n`);
  await rename(temp, LISTINGS_FILE);
}

// Every change is a read-modify-write of one file, so changes run one at a time.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

export function collectListing(input: CollectInput, today = new Date().toISOString().slice(0, 10)) {
  return exclusive(async () => {
    const listings = await readListings();
    const url = cleanUrl(input.url);
    const existing = listings.find((listing) => listing.url === url);
    if (existing) return { listing: existing, duplicate: true };

    const source = sourceOf(url);
    const id = nextId(listings, source);
    const downloads = await Promise.all([...new Set(input.images)].slice(0, MAX_PHOTOS * 2).map((image) => downloadImage(image)));
    const photos = downloads.filter((photo) => photo !== null).slice(0, MAX_PHOTOS);
    await mkdir(PHOTOS_DIR, { recursive: true });
    const names = photos.map((_, i) => `${id}-${i + 1}.jpg`);
    await Promise.all(photos.map((photo, i) => writeFile(path.join(PHOTOS_DIR, names[i]), photo)));

    const listing: EvalListing = {
      id,
      source,
      collectedOn: today,
      url,
      title: input.title,
      // The page's own text is complete; og:description is often cut short.
      description: input.description.length >= input.ogDescription.length ? input.description : input.ogDescription,
      photos: names,
      expected: null,
      expectedRecallId: null,
    };
    await writeListings([...listings, listing]);
    return { listing, duplicate: false };
  });
}

export function labelListing(id: string, expected: z.infer<typeof expectedSchema> | null, expectedRecallId: string | null) {
  return exclusive(async () => {
    const listings = await readListings();
    const index = listings.findIndex((listing) => listing.id === id);
    if (index === -1) return null;
    listings[index] = { ...listings[index], expected, expectedRecallId };
    await writeListings(listings);
    return listings[index];
  });
}
