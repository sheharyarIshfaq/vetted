import { z } from "zod";
import { checkListing } from "@/lib/check/listing";
import { CheckInputError } from "@/lib/check/run";
import { limitReached } from "../../rate-limits";

const pinnedExtensionOrigin = "chrome-extension://blbmfaapgjjfdolfklhjgckmpcghggem";
const extensionOrigin = process.env.EXTENSION_ORIGIN || pinnedExtensionOrigin;
const supportedPageUrl = z.url({ protocol: /^https$/ }).refine((rawUrl) => {
  const url = new URL(rawUrl);
  return (
    (url.hostname === "www.leboncoin.fr" && /^\/ad\//.test(url.pathname)) ||
    (url.hostname === "www.vinted.fr" && /^\/items\//.test(url.pathname))
  );
}, "Use an open Leboncoin or Vinted listing");

const bodySchema = z.object({
  pageUrl: supportedPageUrl,
  title: z.string().trim().min(1).max(1000),
  description: z.string().trim().max(5000),
  imageUrls: z.array(z.url({ protocol: /^https$/ })).max(12),
});

function corsHeaders(origin: string | null) {
  const headers = new Headers({ Vary: "Origin" });
  if (origin === extensionOrigin) {
    headers.set("Access-Control-Allow-Origin", extensionOrigin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "600");
  }
  return headers;
}

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== extensionOrigin) return new Response(null, { status: 403, headers: corsHeaders(origin) });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

const log = (message: string) => process.stdout.write(`${message}\n`);

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  if (origin !== extensionOrigin) return Response.json({ error: "This endpoint is for the Vetted extension." }, { status: 403, headers });
  const limited = limitReached(request, "check", headers);
  if (limited) return limited;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON listing payload." }, { status: 400, headers });
  }

  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || "The listing details are invalid." }, { status: 400, headers });
  }

  try {
    const { title, description, imageUrls, pageUrl } = parsed.data;
    const { result, panel, panelFr } = await checkListing({ title, description, imageUrls, pageUrl }, log);
    return Response.json(
      {
        id: result.id,
        verdict: result.verdict,
        evidence: result.evidence,
        recall: result.recall,
        panel,
        panelFr,
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof CheckInputError) return Response.json({ error: error.message }, { status: 422, headers });
    log(`[extension-check] failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "The check failed. Please try again." }, { status: 500, headers });
  }
}
