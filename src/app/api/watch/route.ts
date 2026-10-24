import { z } from "zod";
import { insertWatch } from "@/lib/db/watches";

const bodySchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  brandNorm: z.string().trim().max(100).nullish(),
  model: z.string().trim().max(100).nullish(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  await insertWatch({
    email: parsed.data.email.toLowerCase(),
    brandNorm: parsed.data.brandNorm || null,
    model: parsed.data.model || null,
  });
  return Response.json({ ok: true });
}
