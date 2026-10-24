import { zodTextFormat } from "openai/helpers/zod";
import { LISTING_EXTRACTION_PROMPT } from "../ai/prompts";
import { listingExtractionSchema, type ListingExtraction } from "../ai/schemas";
import { recordSpend } from "../ai/spend";
import { openai, openaiModel } from "../openai";
import { normalizeText } from "../text";
import type { EvidenceSource } from "../verdict";
import { toDataUrl } from "./images";

type ScalarField = "category" | "brand" | "model" | "modelVariant" | "gtin" | "batch" | "productionDate";

export type ExtractedItem = {
  category: string | null;
  productType?: string | null; // from the fixed type list; absent on checks stored before it existed
  brand: string | null;
  model: string | null;
  modelVariant: string | null;
  references: string[];
  gtin: string | null;
  batch: string | null;
  productionDate: string | null;
  labelTextSeen: string | null;
  confidence: number;
  quotes: ListingExtraction["quotes"];
  sources: Partial<Record<"references" | "gtin" | "batch" | "productionDate", EvidenceSource>>;
};

export async function extractListing(text: string, photos: Buffer[]) {
  const response = await openai().responses.parse({
    model: openaiModel(),
    instructions: LISTING_EXTRACTION_PROMPT,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: text || "(no text, photos only)" },
          ...photos.map((photo) => ({ type: "input_image" as const, detail: "auto" as const, image_url: toDataUrl(photo) })),
        ],
      },
    ],
    text: { format: zodTextFormat(listingExtractionSchema, "listing_extraction") },
  });
  await recordSpend(response.usage);
  return groundExtraction(text, listingExtractionSchema.parse(response.output_parsed));
}

// Keeps a field only when the listing supports it: its value or a text quote appears in the text,
// or the model says it was read in a photo. Everything else becomes null.
export function groundExtraction(text: string, raw: ListingExtraction): ExtractedItem {
  const normalizedText = normalizeText(text);
  const compactText = normalizedText.replaceAll(" ", "");
  const inText = (value: string) => {
    const normalized = normalizeText(value);
    return normalized !== "" && (normalizedText.includes(normalized) || compactText.includes(normalized.replaceAll(" ", "")));
  };
  const quotesFor = (field: string) => raw.quotes.filter((quote) => quote.field === field && quote.text.trim());
  const fromPhoto = (field: string) => quotesFor(field).some((quote) => quote.from === "photo");
  const supportedByText = (field: string, value: string) =>
    inText(value) || quotesFor(field).some((quote) => quote.from === "text" && inText(quote.text));

  const ground = (field: ScalarField, value: string | null, valid: (value: string) => boolean = () => true) => {
    const trimmed = value?.trim();
    if (!trimmed || !valid(trimmed)) return { value: null, photo: false };
    if (field === "category" || supportedByText(field, trimmed)) return { value: trimmed, photo: false };
    if (fromPhoto(field)) return { value: trimmed, photo: true };
    return { value: null, photo: false };
  };

  const brand = ground("brand", raw.brand);
  const model = ground("model", raw.model);
  const modelVariant = ground("modelVariant", raw.modelVariant);
  const gtin = ground("gtin", raw.gtin?.replace(/\s/g, "") ?? null, (value) => /^\d{8,14}$/.test(value));
  const batch = ground("batch", raw.batch);
  const productionDate = ground("productionDate", raw.productionDate, (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value));

  const photoRefs = quotesFor("references").filter((quote) => quote.from === "photo").map((quote) => normalizeText(quote.text));
  const references = [...new Set(raw.references.map((ref) => ref.trim()))].filter(
    (ref) => ref && (inText(ref) || photoRefs.some((quote) => quote.includes(normalizeText(ref)))),
  );
  const refsFromPhoto = references.length > 0 && references.every((ref) => !inText(ref));

  const sources: ExtractedItem["sources"] = {};
  if (references.length) sources.references = refsFromPhoto ? "listing_photo" : "listing_text";
  if (gtin.value) sources.gtin = gtin.photo ? "barcode" : "listing_text";
  if (batch.value) sources.batch = batch.photo ? "listing_photo" : "listing_text";
  if (productionDate.value) sources.productionDate = productionDate.photo ? "listing_photo" : "listing_text";

  return {
    category: ground("category", raw.category).value,
    productType: raw.productType,
    brand: brand.value,
    model: model.value,
    modelVariant: modelVariant.value,
    references,
    gtin: gtin.value,
    batch: batch.value,
    productionDate: productionDate.value,
    labelTextSeen: raw.labelTextSeen?.trim() || null,
    confidence: Math.min(1, Math.max(0, raw.confidence)),
    quotes: raw.quotes,
    sources,
  };
}
