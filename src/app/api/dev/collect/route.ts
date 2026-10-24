import { collectInputSchema, collectListing } from "@/lib/eval/listings";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });

  const parsed = collectInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { listing, duplicate } = await collectListing(parsed.data);
  return Response.json({ id: listing.id, title: listing.title, photos: listing.photos.length, duplicate });
}
