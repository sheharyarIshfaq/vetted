import sharp from "sharp";
import { safeFetch } from "./safe-fetch";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 768;

// Smaller images keep the model fast and cheap; rotate() applies the EXIF orientation from phone photos.
export async function prepareImage(bytes: Uint8Array, maxSide = MAX_SIDE) {
  return sharp(bytes)
    .rotate()
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export async function shortestSide(image: Buffer) {
  const { width = 0, height = 0 } = await sharp(image).metadata();
  return Math.min(width, height);
}

export function toDataUrl(jpeg: Buffer) {
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

// Marketplace image servers can refuse unknown clients, so images are fetched like the browser showing the listing.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

type DownloadOptions = { referer?: string; timeoutMs?: number; log?: (message: string) => void };

function describe(url: string) {
  const { hostname, pathname } = new URL(url);
  return `${hostname}…${pathname.slice(-24)}`;
}

// Downloads one image in any format sharp reads (JPEG, PNG, WebP, AVIF…) and returns it as JPEG;
// null when it can't be fetched or decoded in time.
export async function downloadImage(url: string, { referer, timeoutMs = 5000, log = () => {} }: DownloadOptions = {}) {
  let fetched: Awaited<ReturnType<typeof safeFetch>>;
  try {
    fetched = await safeFetch(url, {
      timeoutMs,
      maxBytes: MAX_UPLOAD_BYTES,
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        ...(referer ? { Referer: referer } : {}),
      },
    });
  } catch (error) {
    log(`[image] ${describe(url)} not downloaded: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
  const head = Buffer.from(fetched.body.subarray(0, 12)).toString("hex");
  log(`[image] ${describe(url)} ${fetched.status} ${fetched.contentType || "no content-type"} ${fetched.body.byteLength} bytes, starts ${head}`);
  try {
    return await prepareImage(fetched.body);
  } catch (error) {
    log(`[image] ${describe(url)} not decoded: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
