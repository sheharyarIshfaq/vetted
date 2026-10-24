import sharp from "sharp";
import { safeFetch } from "./safe-fetch";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 1024;

// Smaller images keep the model fast and cheap; rotate() applies the EXIF orientation from phone photos.
export async function prepareImage(bytes: Uint8Array) {
  return sharp(bytes)
    .rotate()
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export function toDataUrl(jpeg: Buffer) {
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

// Downloads and prepares one image; null when it can't be fetched or decoded in time.
export async function downloadImage(url: string, timeoutMs = 5000) {
  try {
    const { body } = await safeFetch(url, { timeoutMs, maxBytes: MAX_UPLOAD_BYTES });
    return await prepareImage(body);
  } catch {
    return null;
  }
}
