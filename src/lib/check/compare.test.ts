import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Recall } from "../../db/schema";

const downloadImage = vi.fn();
const parse = vi.fn();

vi.mock("./images", () => ({
  downloadImage: (url: string) => downloadImage(url),
  toDataUrl: (photo: Buffer) => `data:image/jpeg;base64,${photo.toString("base64")}`,
}));
vi.mock("../openai", () => ({
  openai: () => ({ responses: { parse } }),
  openaiModel: () => "test-model",
}));

const { comparePhotos } = await import("./compare");

function recall(id: string, images: string[]) {
  return { id, productName: "siège vélo buddy", brand: "hamax", images } as Recall;
}

const listingPhoto = Buffer.from("listing");

beforeEach(() => {
  downloadImage.mockReset();
  parse.mockReset();
  parse.mockResolvedValue({ output_parsed: { sameProduct: "yes", reasons: ["same harness"] } });
});

describe("comparePhotos", () => {
  it("sends official images inline as base64, never their URLs", async () => {
    downloadImage.mockResolvedValue(Buffer.from("official"));
    const results = await comparePhotos([listingPhoto], [recall("rc:1", ["https://rappel.conso.gouv.fr/image/a.jpg"])]);
    expect(results.get("rc:1")).toMatchObject({ sameProduct: "yes", officialPhotoUnavailable: false, officialImagesUsed: 1 });
    const request = JSON.stringify(parse.mock.calls[0][0]);
    expect(request).not.toContain("rappel.conso.gouv.fr");
    expect(request).toContain(`data:image/jpeg;base64,${Buffer.from("official").toString("base64")}`);
  });

  it("skips a failed download, flags it, and still compares the rest", async () => {
    downloadImage.mockImplementation(async (url: string) => (url.endsWith("b.jpg") ? null : Buffer.from("ok")));
    const results = await comparePhotos([listingPhoto], [recall("rc:1", ["https://x/a.jpg", "https://x/b.jpg"])]);
    expect(results.get("rc:1")).toMatchObject({ sameProduct: "yes", officialPhotoUnavailable: true, officialImagesUsed: 1 });
  });

  it("does not call the model when no official image could be downloaded", async () => {
    downloadImage.mockResolvedValue(null);
    const results = await comparePhotos([listingPhoto], [recall("rc:1", ["https://x/a.jpg"])]);
    expect(results.get("rc:1")).toEqual({ sameProduct: null, officialPhotoUnavailable: true, reasons: [], officialImagesUsed: 0 });
    expect(parse).not.toHaveBeenCalled();
  });

  it("downloads at most 3 official images and compares at most 3 recalls", async () => {
    downloadImage.mockResolvedValue(Buffer.from("ok"));
    const images = ["1", "2", "3", "4", "5"].map((n) => `https://x/${n}.jpg`);
    const recalls = ["a", "b", "c", "d"].map((id) => recall(id, images));
    const results = await comparePhotos([listingPhoto], recalls);
    expect(results.size).toBe(3);
    expect(downloadImage).toHaveBeenCalledTimes(9);
  });

  it("keeps going when the model call fails", async () => {
    downloadImage.mockResolvedValue(Buffer.from("ok"));
    parse.mockRejectedValue(new Error("timeout"));
    const results = await comparePhotos([listingPhoto], [recall("rc:1", ["https://x/a.jpg"])]);
    expect(results.get("rc:1")?.sameProduct).toBeNull();
  });

  it("skips comparison when the listing has no photos", async () => {
    expect((await comparePhotos([], [recall("rc:1", ["https://x/a.jpg"])])).size).toBe(0);
    expect(downloadImage).not.toHaveBeenCalled();
  });
});
