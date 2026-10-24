import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@/lib/check/images";
import { runLabelCheck } from "@/lib/check/label";
import { CheckInputError } from "@/lib/check/run";

const photoSchema = z
  .instanceof(File, { error: "Add a photo of the label" })
  .refine((file) => file.size > 0, "Add a photo of the label")
  .refine((file) => file.size <= MAX_UPLOAD_BYTES, "The photo must be 8 MB or less")
  .refine((file) => file.type.startsWith("image/"), "The label photo must be an image");

const log = (message: string) => process.stdout.write(`${message}\n`);

export async function POST(request: Request, { params }: RouteContext<"/api/check/[id]/label">) {
  const { id } = await params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send the label photo as multipart form data" }, { status: 400 });
  }

  const parsed = photoSchema.safeParse(form.get("photo"));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const result = await runLabelCheck(id, new Uint8Array(await parsed.data.arrayBuffer()), log);
    if (!result) return Response.json({ error: "Check not found" }, { status: 404 });
    return Response.json(result);
  } catch (error) {
    if (error instanceof CheckInputError) return Response.json({ error: error.message }, { status: 422 });
    log(`[label] failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "The label check failed. Please try again." }, { status: 500 });
  }
}
