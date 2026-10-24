import { randomUUID } from "node:crypto";
import type { Recall } from "../../db/schema";
import { loadBrandAliases } from "../db/brands";
import { insertCheck } from "../db/checks";
import { uploadObject } from "../storage";
import { normalizeBrand } from "../text";
import { decideBest, type Evidence, type ItemFacts, type Verdict } from "../verdict";
import { findCandidates } from "./candidates";
import { comparePhotos, type PhotoResult } from "./compare";
import { extractListing, type ExtractedItem } from "./extract";
import { downloadImage, prepareImage } from "./images";
import { readListingPage, type ListingPage } from "./listing-page";

const MAX_PHOTOS = 3;
const MAX_TEXT_LENGTH = 5000;

// A problem with what the user sent; the message is shown to them as is.
export class CheckInputError extends Error {}

export type CheckInput = { text?: string; url?: string; photos: Uint8Array[] };

export type CheckResult = {
  id: string;
  verdict: Verdict;
  evidence: Evidence[];
  notes: string[];
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

async function readInput(input: CheckInput) {
  let page: ListingPage | null = null;
  if (input.url) {
    try {
      page = await readListingPage(input.url);
    } catch {
      if (!input.text?.trim() && input.photos.length === 0) {
        throw new CheckInputError("We couldn't read that page. Paste the listing title and description instead.");
      }
    }
  }
  const text = [page?.title, page?.description, input.text?.trim()]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT_LENGTH);

  let uploads: Buffer[];
  try {
    uploads = await Promise.all(input.photos.slice(0, MAX_PHOTOS).map(prepareImage));
  } catch {
    throw new CheckInputError("One of the photos could not be read. Try a JPEG or PNG.");
  }
  const pagePhoto = page?.image && uploads.length < MAX_PHOTOS ? await downloadImage(page.image) : null;
  const photos = pagePhoto ? [...uploads, pagePhoto] : uploads;

  if (!text && photos.length === 0) {
    throw new CheckInputError("Paste a listing link or its text, or add a photo.");
  }
  return { text, page, uploads, photos };
}

export function toItemFacts(extracted: ExtractedItem, brandNorm: string | null): ItemFacts {
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
  };
}

export async function runCheck(input: CheckInput, log: Log = () => {}): Promise<CheckResult> {
  const lap = timer(log);
  const { text, page, uploads, photos } = await readInput(input);
  lap("read input");

  const photoKeys = uploads.map(() => `checks/${randomUUID()}.jpg`);
  const [extracted, aliases] = await Promise.all([
    extractListing(text, photos),
    loadBrandAliases(),
    ...uploads.map((photo, i) => uploadObject(photoKeys[i], photo, "image/jpeg")),
  ]);
  lap("extract");

  const brandNorm = extracted.brand ? normalizeBrand(extracted.brand, aliases) : null;
  const ranked = await findCandidates({
    brandNorm,
    model: [extracted.model, extracted.modelVariant].filter(Boolean).join(" ") || null,
    gtin: extracted.gtin,
    searchText: [extracted.brand, extracted.model, extracted.modelVariant, page?.title ?? text.split("\n")[0]]
      .filter(Boolean)
      .join(" "),
  });
  lap(`candidates (${ranked.length})`);

  const photoResults = await comparePhotos(photos, ranked.map((candidate) => candidate.recall));
  lap(`compare photos (${photoResults.size})`);

  const item = toItemFacts(extracted, brandNorm);
  const result = decideBest({ item, candidates: ranked, photos: photoResults });
  const matched: Recall | undefined = ranked.find((candidate) => candidate.recall.id === result.recall?.id)?.recall;

  const stored: { input: StoredInput; extracted: StoredExtracted; evidence: StoredEvidence } = {
    input: { text: input.text ?? null, url: input.url ?? null, page, photoKeys },
    extracted: { ...extracted, brandNorm },
    evidence: {
      items: result.evidence,
      notes: result.notes,
      relation: result.recall?.relation ?? null,
      alsoMatched: result.alsoMatched,
    },
  };
  const id = await insertCheck({
    ...stored,
    candidates: ranked.map(({ recall, titleSimilarity, brandSimilarity }): StoredCandidate => ({
      recallId: recall.id,
      titleSimilarity,
      brandSimilarity,
      photo: photoResults.get(recall.id) ?? null,
    })),
    verdict: result.verdict,
    recallId: result.recall?.id ?? null,
  });
  lap("decide and save");

  return {
    id,
    verdict: result.verdict,
    evidence: result.evidence,
    notes: result.notes,
    recall:
      result.recall && matched
        ? { ...result.recall, productName: matched.productName, sourceRef: matched.sourceRef, url: matched.url }
        : null,
    extracted,
  };
}
