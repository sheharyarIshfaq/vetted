import { zodTextFormat } from "openai/helpers/zod";
import type { Recall } from "../../db/schema";
import { PHOTO_COMPARISON_PROMPT } from "../ai/prompts";
import { photoComparisonSchema } from "../ai/schemas";
import { openai, openaiModel } from "../openai";
import type { PhotoComparison } from "../verdict";
import { downloadImage, toDataUrl } from "./images";

export type PhotoResult = PhotoComparison & { reasons: string[]; officialImagesUsed: number };

const MAX_COMPARED_RECALLS = 3;
const MAX_OFFICIAL_IMAGES = 3;
const DOWNLOAD_TIMEOUT_MS = 5000;

// Official images are downloaded here and sent inline: the model never gets their URLs.
async function compareOne(listingPhotos: Buffer[], recall: Recall): Promise<PhotoResult> {
  const urls = recall.images.slice(0, MAX_OFFICIAL_IMAGES);
  const downloaded = await Promise.all(urls.map((url) => downloadImage(url, DOWNLOAD_TIMEOUT_MS)));
  const official = downloaded.filter((image) => image !== null);
  const officialPhotoUnavailable = official.length < urls.length;
  if (official.length === 0) {
    return { sameProduct: null, officialPhotoUnavailable, reasons: [], officialImagesUsed: 0 };
  }

  try {
    const response = await openai().responses.parse({
      model: openaiModel(),
      instructions: PHOTO_COMPARISON_PROMPT,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Listing photos:" },
            ...listingPhotos.map((photo) => ({ type: "input_image" as const, detail: "auto" as const, image_url: toDataUrl(photo) })),
            { type: "input_text", text: `Official photos of the recalled product "${recall.productName}" (${recall.brand ?? "brand unknown"}):` },
            ...official.map((photo) => ({ type: "input_image" as const, detail: "auto" as const, image_url: toDataUrl(photo) })),
          ],
        },
      ],
      text: { format: zodTextFormat(photoComparisonSchema, "photo_comparison") },
    });
    const output = photoComparisonSchema.parse(response.output_parsed);
    return { ...output, officialPhotoUnavailable, officialImagesUsed: official.length };
  } catch {
    // A failed comparison leaves the decision to the text match.
    return { sameProduct: null, officialPhotoUnavailable, reasons: [], officialImagesUsed: official.length };
  }
}

// Compares the listing photos with the official photos of the first few candidates that have any.
export async function comparePhotos(listingPhotos: Buffer[], candidates: Recall[]) {
  const results = new Map<string, PhotoResult>();
  if (listingPhotos.length === 0) return results;
  const compared = candidates.filter((recall) => recall.images.length > 0).slice(0, MAX_COMPARED_RECALLS);
  const outcomes = await Promise.all(compared.map((recall) => compareOne(listingPhotos, recall)));
  compared.forEach((recall, i) => results.set(recall.id, outcomes[i]));
  return results;
}
