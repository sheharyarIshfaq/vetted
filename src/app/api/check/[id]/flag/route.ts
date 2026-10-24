import { z } from "zod";
import { flagCheck } from "@/lib/db/checks";

const bodySchema = z.object({ note: z.string().trim().max(1000).optional() });

export async function POST(request: Request, { params }: RouteContext<"/api/check/[id]/flag">) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "The note is too long" }, { status: 400 });

  const flagged = await flagCheck(id, parsed.data.note || null);
  if (!flagged) return Response.json({ error: "Check not found" }, { status: 404 });
  return Response.json({ ok: true });
}
