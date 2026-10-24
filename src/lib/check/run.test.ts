import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

// Link reading fails the way a site that blocks it does.
vi.mock("./listing-page", () => ({ readListingPage: () => Promise.reject(new Error("HTTP 403 text/html")) }));

const { CheckInputError, readInput } = await import("./run");

const photo = () => sharp({ create: { width: 40, height: 40, channels: 3, background: "#0f6b4f" } }).webp().toBuffer();
const broken = new TextEncoder().encode("<html>not a photo</html>");

describe("readInput", () => {
  it("skips a photo it can't read and keeps the others", async () => {
    const input = await readInput({ text: "Siège Hamax Buddy", photos: [broken, await photo()] });
    expect(input.photos).toHaveLength(1);
    expect(input.photosUnread).toBe(false);
  });

  it("goes on with the text alone when no photo can be read, and says so", async () => {
    const input = await readInput({ text: "Siège Hamax Buddy", photos: [broken, broken] });
    expect(input.photos).toHaveLength(0);
    expect(input.photosUnread).toBe(true);
  });

  it("counts photos the caller could not download", async () => {
    expect((await readInput({ text: "Siège Hamax Buddy", photos: [], unreadPhotos: 2 })).photosUnread).toBe(true);
    expect((await readInput({ text: "Siège Hamax Buddy", photos: [] })).photosUnread).toBe(false);
  });

  it("refuses only when nothing at all can be read", async () => {
    await expect(readInput({ text: "", photos: [broken] })).rejects.toThrow(CheckInputError);
    await expect(readInput({ text: "", photos: [broken] })).rejects.toThrow("The photos could not be read");
  });

  it("says Leboncoin blocks link reading, and points to the extension", async () => {
    const blocked = readInput({ url: "https://www.leboncoin.fr/ad/velos/3293929400", photos: [] });
    await expect(blocked).rejects.toMatchObject({ code: "link_blocked", message: expect.stringContaining("Leboncoin blocks link reading") });
    const other = readInput({ url: "https://www.vinted.fr/items/1", photos: [] });
    await expect(other).rejects.toMatchObject({ code: undefined, message: expect.stringContaining("couldn't read that page") });
  });
});
