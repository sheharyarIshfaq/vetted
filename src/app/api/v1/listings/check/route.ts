import { z } from "zod";
import { checkListing } from "@/lib/check/listing";
import { platformResponse } from "@/lib/check/platform";
import { CheckInputError } from "@/lib/check/run";
import { limitReached } from "../../../rate-limits";

// The demo endpoint for marketplaces: one listing in, a verdict and an action out. No key yet.
const bodySchema = z.object({
  listing_id: z.union([z.string().trim().max(200), z.number()]).optional(),
  title: z.string({ error: "title is required" }).trim().min(1, "title is required").max(1000, "title is too long (1,000 characters at most)"),
  description: z.string().trim().max(5000, "description is too long (5,000 characters at most)").optional(),
  image_urls: z
    .array(z.url({ protocol: /^https?$/, error: "Each image_url must be a full http(s) link" }))
    .max(3, "Send at most 3 image_urls")
    .optional(),
  url: z.url({ protocol: /^https?$/, error: "url must be a full http(s) link" }).optional(),
});

const log = (message: string) => process.stdout.write(`${message}\n`);

// The address the caller reached this site on, so check_url works locally and behind the proxy.
function siteOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export async function POST(request: Request) {
  const limited = limitReached(request, "check");
  if (limited) return limited;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Send the listing as a JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const { listing_id, title, description, image_urls, url } = parsed.data;
    const { result, recall, panel, panelFr } = await checkListing(
      { title, description: description ?? "", imageUrls: image_urls ?? [], pageUrl: url },
      log,
    );
    return Response.json(
      platformResponse({
        listingId: listing_id === undefined ? null : String(listing_id),
        verdict: result.verdict,
        recall,
        panel,
        panelFr,
        checkUrl: `${siteOrigin(request)}/check/${result.id}`,
      }),
    );
  } catch (error) {
    if (error instanceof CheckInputError) return Response.json({ error: error.message }, { status: 422 });
    log(`[v1-check] failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "The check failed. Please try again." }, { status: 500 });
  }
}
