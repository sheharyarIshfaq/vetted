import { z } from "zod";

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.url(),
});

export const storageEnvSchema = z.object({
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export const openaiEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-6.1-sol"),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  // Past this many dollars of model use in a day (UTC), checks stop sending photos to the model.
  OPENAI_DAILY_BUDGET_USD: z.coerce.number().positive().optional(),
});

export const ingestEnvSchema = z.object({
  INGEST_CONTACT: z
    .union([z.email(), z.literal("")])
    .optional()
    .transform((value) => value || undefined),
});

// Each area is parsed on first use, so a script only needs the variables it touches.
function lazyEnv<T extends z.ZodType>(schema: T) {
  let cached: z.infer<T> | undefined;
  return (): z.infer<T> => {
    if (cached === undefined) {
      const result = schema.safeParse(process.env);
      if (!result.success) {
        const invalid = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
        throw new Error(`Missing or invalid environment variables: ${invalid}`);
      }
      cached = result.data;
    }
    return cached as z.infer<T>;
  };
}

export const databaseEnv = lazyEnv(databaseEnvSchema);
export const storageEnv = lazyEnv(storageEnvSchema);
export const openaiEnv = lazyEnv(openaiEnvSchema);
export const ingestEnv = lazyEnv(ingestEnvSchema);
