import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { CheckInputError, readInput } from "./run";

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
});
