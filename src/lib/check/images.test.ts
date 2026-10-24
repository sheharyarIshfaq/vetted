import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const safeFetch = vi.fn();
vi.mock("./safe-fetch", () => ({ safeFetch: (...args: unknown[]) => safeFetch(...args) }));

const { downloadImage, prepareImage, toDataUrl } = await import("./images");

const square = (background: string) => sharp({ create: { width: 64, height: 64, channels: 3, background } });

describe("prepareImage", () => {
  it("shrinks large photos to 1024px on the long side as JPEG", async () => {
    const png = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#0f6b4f" } }).png().toBuffer();
    const meta = await sharp(await prepareImage(png)).metadata();
    expect(meta).toMatchObject({ format: "jpeg", width: 1024, height: 512 });
  });

  it("does not enlarge small photos", async () => {
    const small = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
    expect((await sharp(await prepareImage(small)).metadata()).width).toBe(200);
  });

  it("turns WebP and AVIF photos into JPEG", async () => {
    const webp = await square("#c2362b").webp().toBuffer();
    const avif = await square("#1e7f55").avif().toBuffer();
    expect((await sharp(await prepareImage(webp)).metadata()).format).toBe("jpeg");
    expect((await sharp(await prepareImage(avif)).metadata()).format).toBe("jpeg");
  });

  it("rejects data that is not an image", async () => {
    await expect(prepareImage(new TextEncoder().encode("not an image"))).rejects.toThrow();
  });
});

describe("downloadImage", () => {
  beforeEach(() => safeFetch.mockReset());

  it("asks like a browser, with the listing as referer, and logs what came back", async () => {
    const webp = await square("#0f6b4f").webp().toBuffer();
    safeFetch.mockResolvedValue({ status: 200, contentType: "image/webp", body: webp, url: "https://img.example/a.webp" });
    const log = vi.fn();
    const photo = await downloadImage("https://img.example/a.webp", { referer: "https://www.leboncoin.fr/ad/x/1", log });

    expect((await sharp(photo!).metadata()).format).toBe("jpeg");
    const { headers } = safeFetch.mock.calls[0][1];
    expect(headers.Referer).toBe("https://www.leboncoin.fr/ad/x/1");
    expect(headers["User-Agent"]).toMatch(/^Mozilla\/5\.0/);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/ 200 image\/webp \d+ bytes, starts 52494646/));
  });

  it("returns null and logs the reason when the image can't be downloaded or decoded", async () => {
    const log = vi.fn();
    safeFetch.mockRejectedValueOnce(new Error("HTTP 403 text/html"));
    expect(await downloadImage("https://img.example/b.jpg", { log })).toBeNull();
    safeFetch.mockResolvedValueOnce({ status: 200, contentType: "text/html", body: Buffer.from("<html>"), url: "https://img.example/c.jpg" });
    expect(await downloadImage("https://img.example/c.jpg", { log })).toBeNull();
    expect(log.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining("not downloaded: HTTP 403 text/html"),
      expect.stringContaining("200 text/html"),
      expect.stringContaining("not decoded"),
    ]);
  });
});

describe("toDataUrl", () => {
  it("builds a base64 JPEG data URL", () => {
    expect(toDataUrl(Buffer.from("abc"))).toBe("data:image/jpeg;base64,YWJj");
  });
});
