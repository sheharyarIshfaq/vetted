import { z } from "zod";

// Structured Outputs needs every key present, so unknown values are null or empty arrays.
export const recallDetailsSchema = z.object({
  models: z.array(z.string()),
  references: z.array(z.string()),
  batches: z.array(z.string()),
  productionFrom: z.string().nullable(),
  productionTo: z.string().nullable(),
  modelRanges: z.array(
    z.object({
      model: z.string(),
      from: z.string().nullable(),
      to: z.string().nullable(),
      refs: z.array(z.string()),
      batches: z.array(z.string()),
    }),
  ),
  quote: z.string().nullable(),
});

export type RecallDetailsOutput = z.infer<typeof recallDetailsSchema>;

export const extractedFieldSchema = z.enum([
  "category",
  "brand",
  "model",
  "modelVariant",
  "references",
  "gtin",
  "batch",
  "productionDate",
]);

export const listingExtractionSchema = z.object({
  category: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  modelVariant: z.string().nullable(),
  references: z.array(z.string()),
  gtin: z.string().nullable(),
  batch: z.string().nullable(),
  productionDate: z.string().nullable(),
  labelTextSeen: z.string().nullable(),
  confidence: z.number(),
  quotes: z.array(
    z.object({
      field: extractedFieldSchema,
      from: z.enum(["text", "photo"]),
      text: z.string(),
    }),
  ),
});

export type ListingExtraction = z.infer<typeof listingExtractionSchema>;

export const photoComparisonSchema = z.object({
  sameProduct: z.enum(["yes", "no", "unsure"]),
  reasons: z.array(z.string()),
});

export type PhotoComparisonOutput = z.infer<typeof photoComparisonSchema>;

export const labelReadingSchema = z.object({
  labelText: z.string().nullable(),
  references: z.array(z.string()),
  gtin: z.string().nullable(),
  batch: z.string().nullable(),
  productionDate: z.string().nullable(),
  productionDateText: z.string().nullable(),
});

export type LabelReading = z.infer<typeof labelReadingSchema>;
