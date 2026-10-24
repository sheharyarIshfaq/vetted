import { randomUUID } from "node:crypto";
import type { Recall } from "../../db/schema";
import { loadBrandAliases } from "../db/brands";
import { insertCheck } from "../db/checks";
import { withinDailyBudget } from "../ai/spend";
import { uploadObject } from "../storage";
import { normalizeBrand } from "../text";
import { decideBest, type Evidence, type ItemFacts, type Verdict } from "../verdict";
import { findCandidates, type Route } from "./candidates";
import { comparePhotos, type PhotoResult } from "./compare";
import { extractListing, type ExtractedItem } from "./extract";
import { downloadImage, prepareImage } from "./images";
import { readListingPage, type ListingPage } from "./listing-page";

const MAX_PHOTOS = 3;
const MAX_TEXT_LENGTH = 5000;

// A problem with what the user sent; the message is shown to them as is. "link_blocked": the site refuses link reading.
export class CheckInputError extends Error {
  constructor(
    message: string,
    readonly code?: "link_blocked",
  ) {
    super(message);
  }
}

const BLOCKS_LINK_READING = /(^|\.)leboncoin\.fr$/;

// unreadPhotos: photos the caller could not download, so the check can say they weren't seen.
export type CheckInput = { text?: string; url?: string; photos: Uint8Array[]; unreadPhotos?: number };

const PHOTOS_SKIPPED: Evidence = {
  fact: "Photos weren't checked: today's photo budget is used up, so only the text was read",
  matched: false,
  source: "listing_photo",
};

const PHOTOS_UNREAD: Evidence = {
  fact: "The photos could not be read, so only the text was checked",
  matched: false,
  source: "listing_photo",
};

export type CheckResult = {
  id: string;
  verdict: Verdict;
  evidence: Evidence[];
  notes: string[];
  alsoMatched: string[];
  recall: { id: string; relation: "match" | "other_dates" | "not_a_match"; productName: string; sourceRef: string; url: string } | null;
  extracted: ExtractedItem;
};

// Shapes of the JSON columns saved on a check.
export type StoredInput = {
  text: string | null;
  url: string | null;
  page: ListingPage | null;
  photoKeys: string[];
  fromRecall?: string; // a label check started from a recall page, with no listing
};
export type StoredExtracted = ExtractedItem & { brandNorm: string | null };
export type StoredCandidate = {
  recallId: string;
  titleSimilarity: number;
  brandSimilarity: number;
  photo: PhotoResult | null;
  routes?: Route[]; // absent on checks stored before candidate routes
};
export type StoredEvidence = {
  items: Evidence[];
  notes: string[];
  relation: "match" | "other_dates" | "not_a_match" | null;
  alsoMatched?: string[]; // absent on checks stored before the second source
};

type Log = (message: string) => void;

function timer(log: Log) {
  let last = performance.now();
  return (stage: string) => {
    const now = performance.now();
    log(`[check] ${stage} ${Math.round(now - last)}ms`);
    last = now;
  };
}

// A photo that can't be read is skipped; only a listing with nothing readable at all is refused.
export async function readInput(input: CheckInput, log: Log = () => {}) {
  let page: ListingPage | null = null;
  if (input.url) {
    try {
      page = await readListingPage(input.url);
    } catch {
      if (!input.text?.trim() && input.photos.length === 0) {
        if (BLOCKS_LINK_READING.test(new URL(input.url).hostname)) {
          throw new CheckInputError("Leboncoin blocks link reading. Paste the text, or use the Chrome extension.", "link_blocked");
        }
        throw new CheckInputError("We couldn't read that page. Paste the listing title and description instead.");
      }
    }
  }
  const text = [page?.title, page?.description, input.text?.trim()]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT_LENGTH);

  const prepared = await Promise.all(
    input.photos.slice(0, MAX_PHOTOS).map(async (photo, i) => {
      try {
        return await prepareImage(photo);
      } catch (error) {
        log(`[check] photo ${i + 1} skipped: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    }),
  );
  const uploads = prepared.filter((photo) => photo !== null);
  const pagePhoto = page?.image && uploads.length < MAX_PHOTOS ? await downloadImage(page.image, { referer: input.url, log }) : null;
  const photos = pagePhoto ? [...uploads, pagePhoto] : uploads;

  const photosUnread = photos.length === 0 && (input.photos.length > 0 || (input.unreadPhotos ?? 0) > 0 || Boolean(page?.image));
  if (!text && photos.length === 0) {
    throw new CheckInputError(
      photosUnread
        ? "The photos could not be read and there is no text to check. Paste the listing text or try other photos."
        : "Paste a listing link or its text, or add a photo.",
    );
  }
  return { text, page, uploads, photos, photosUnread };
}

// What the listing is, in the same shape as a recall's embedding text.
export function listingEmbeddingText(
  extracted: Pick<ExtractedItem, "brand" | "productType" | "category" | "model" | "modelVariant">,
  title: string | null,
) {
  const text = [extracted.brand, extracted.productType ?? extracted.category, [extracted.model, extracted.modelVariant].filter(Boolean).join(" "), title]
    .filter(Boolean)
    .join(" | ");
  return text || null;
}

// The listing's own title: the page's, else the first line of the pasted text.
export function titleOf(page: ListingPage | null, text: string | null) {
  return page?.title ?? text?.split("\n")[0] ?? null;
}

export function toItemFacts(extracted: ExtractedItem, brandNorm: string | null, title: string | null): ItemFacts {
  return {
    brand: extracted.brand,
    brandNorm,
    model: extracted.model,
    modelVariant: extracted.modelVariant,
    references: extracted.references,
    gtin: extracted.gtin,
    batch: extracted.batch,
    productionDate: extracted.productionDate,
    sources: extracted.sources,
    category: extracted.category,
    productType: extracted.productType ?? null,
    title,
  };
}

// Finds the candidate recalls for what was read from a listing, compares photos and lets the rules decide.
export async function matchListing({
  extracted,
  title,
  photos,
  aliases,
  lap = () => {},
}: {
  extracted: ExtractedItem;
  title: string | null;
  photos: Buffer[];
  aliases: ReadonlyMap<string, string>;
  lap?: (step: string) => void;
}) {
  const brandNorm = extracted.brand ? normalizeBrand(extracted.brand, aliases) : null;
  const ranked = await findCandidates({
    brandNorm,
    model: [extracted.model, extracted.modelVariant].filter(Boolean).join(" ") || null,
    gtin: extracted.gtin,
    codes: extracted.references,
    productType: extracted.productType ?? null,
    searchText: [extracted.brand, extracted.model, extracted.modelVariant, title].filter(Boolean).join(" "),
    embeddingText: listingEmbeddingText(extracted, title),
  });
  lap(`candidates (${ranked.length})`);

  const photoResults = await comparePhotos(photos, ranked.map((candidate) => candidate.recall));
  lap(`compare photos (${photoResults.size})`);

  const item = toItemFacts(extracted, brandNorm, title);
  return { brandNorm, ranked, photoResults, result: decideBest({ item, candidates: ranked, photos: photoResults }) };
}

export async function runCheck(input: CheckInput, log: Log = () => {}): Promise<CheckResult> {
  const lap = timer(log);
  const { text, page, uploads, photos: readPhotos, photosUnread } = await readInput(input, log);
  // Past the daily budget the model reads the text only; photos are still kept with the check.
  const photosSkipped = readPhotos.length > 0 && !(await withinDailyBudget());
  const photos = photosSkipped ? [] : readPhotos;
  if (photosSkipped && !text) {
    throw new CheckInputError("Photo checks are paused until tomorrow: today's photo budget is used up. Paste the listing text instead.");
  }
  lap("read input");

  const photoKeys = uploads.map(() => `checks/${randomUUID()}.jpg`);
  const [extracted, aliases] = await Promise.all([
    extractListing(text, photos),
    loadBrandAliases(),
    ...uploads.map((photo, i) => uploadObject(photoKeys[i], photo, "image/jpeg")),
  ]);
  lap("extract");

  const { brandNorm, ranked, photoResults, result } = await matchListing({
    extracted,
    title: titleOf(page, text),
    photos,
    aliases,
    lap,
  });
  const evidence = [...result.evidence, ...(photosUnread ? [PHOTOS_UNREAD] : []), ...(photosSkipped ? [PHOTOS_SKIPPED] : [])];
  const matched: Recall | undefined = ranked.find((candidate) => candidate.recall.id === result.recall?.id)?.recall;

  const stored: { input: StoredInput; extracted: StoredExtracted; evidence: StoredEvidence } = {
    input: { text: input.text ?? null, url: input.url ?? null, page, photoKeys },
    extracted: { ...extracted, brandNorm },
    evidence: {
      items: evidence,
      notes: result.notes,
      relation: result.recall?.relation ?? null,
      alsoMatched: result.alsoMatched,
    },
  };
  const id = await insertCheck({
    ...stored,
    candidates: ranked.map(({ recall, titleSimilarity, brandSimilarity, routes }): StoredCandidate => ({
      recallId: recall.id,
      titleSimilarity,
      brandSimilarity,
      photo: photoResults.get(recall.id) ?? null,
      routes,
    })),
    verdict: result.verdict,
    recallId: result.recall?.id ?? null,
  });
  lap("decide and save");

  return {
    id,
    verdict: result.verdict,
    evidence,
    notes: result.notes,
    alsoMatched: result.alsoMatched,
    recall:
      result.recall && matched
        ? { ...result.recall, productName: matched.productName, sourceRef: matched.sourceRef, url: matched.url }
        : null,
    extracted,
  };
}
