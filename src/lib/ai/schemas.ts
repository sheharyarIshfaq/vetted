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
