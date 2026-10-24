import { readFile } from "node:fs/promises";
import path from "node:path";
import { PHOTOS_DIR } from "@/lib/eval/listings";

export async function GET(_: Request, { params }: RouteContext<"/api/dev/photos/[file]">) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });

  const { file } = await params;
  // Only names the collector writes, so nothing outside the photos folder can be read.
  if (!/^[a-z]+-\d{3}-\d+\.jpg$/.test(file)) return new Response(null, { status: 404 });
  try {
    const body = await readFile(path.join(PHOTOS_DIR, file));
    return new Response(body, { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
