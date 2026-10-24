import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@/lib/check/images";
import { CheckInputError, runCheck } from "@/lib/check/run";

const formSchema = z
  .object({
    text: z.string().trim().max(5000).optional(),
    url: z.url({ protocol: /^https?$/, error: "Paste a full link starting with https://" }).optional(),
    photos: z
      .array(
        z
          .instanceof(File)
          .refine((file) => file.size <= MAX_UPLOAD_BYTES, "Each photo must be 8 MB or less")
          .refine((file) => file.type.startsWith("image/"), "Photos must be images"),
      )
      .max(3, "Add at most 3 photos"),
  })
  .refine((form) => form.text || form.url || form.photos.length > 0, "Paste a listing link or its text, or add a photo");

const log = (message: string) => process.stdout.write(`${message}\n`);

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send the listing as multipart form data" }, { status: 400 });
  }

  const parsed = formSchema.safeParse({
    text: form.get("text") || undefined,
    url: form.get("url") || undefined,
    photos: form.getAll("photos").filter((photo) => photo instanceof File && photo.size > 0),
  });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const photos = await Promise.all(
      parsed.data.photos.map(async (photo) => new Uint8Array(await photo.arrayBuffer())),
    );
    const result = await runCheck({ text: parsed.data.text, url: parsed.data.url, photos }, log);
    return Response.json(result);
  } catch (error) {
    if (error instanceof CheckInputError) return Response.json({ error: error.message }, { status: 422 });
    log(`[check] failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "The check failed. Please try again." }, { status: 500 });
  }
}
