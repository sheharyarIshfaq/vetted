import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { prepareImage, toDataUrl } from "./images";

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

  it("rejects data that is not an image", async () => {
    await expect(prepareImage(new TextEncoder().encode("not an image"))).rejects.toThrow();
  });
});

describe("toDataUrl", () => {
  it("builds a base64 JPEG data URL", () => {
    expect(toDataUrl(Buffer.from("abc"))).toBe("data:image/jpeg;base64,YWJj");
  });
});
