import { describe, expect, it } from "vitest";
import { BatchInputError, MAX_BATCH_ROWS, parseBatchCsv } from "./batch";

describe("parseBatchCsv", () => {
  it("reads the three columns, with quoted commas, quotes and line breaks", () => {
    const csv = [
      "title,description,image_url",
      'Poussette Britax Smile III,"Très bon état, fabriquée en 03/2020",https://example.com/1.jpg',
      '"Siège ""Hamax"" Buddy","Ligne 1',
      'ligne 2",',
    ].join("\r\n");
    expect(parseBatchCsv(csv)).toEqual([
      { line: 2, title: "Poussette Britax Smile III", description: "Très bon état, fabriquée en 03/2020", imageUrl: "https://example.com/1.jpg" },
      { line: 3, title: 'Siège "Hamax" Buddy', description: "Ligne 1\nligne 2", imageUrl: null },
    ]);
  });

  it("accepts semicolons, a BOM, any column order and French headers", () => {
    const csv = "﻿image_url;Titre;description\n;Chaise haute en bois;\n";
    expect(parseBatchCsv(csv)).toEqual([{ line: 2, title: "Chaise haute en bois", description: "", imageUrl: null }]);
  });

  it("ignores image links that aren't https and skips empty lines", () => {
    const csv = "title,description,image_url\nA,,http://example.com/a.jpg\n,,\nB,,javascript:alert(1)\n";
    expect(parseBatchCsv(csv).map((row) => [row.title, row.imageUrl])).toEqual([
      ["A", null],
      ["B", null],
    ]);
  });

  it("needs a header naming the columns", () => {
    expect(() => parseBatchCsv("Poussette,Britax\n")).toThrow(BatchInputError);
  });

  it("needs at least one listing", () => {
    expect(() => parseBatchCsv("title,description,image_url\n")).toThrow("no listings");
  });

  it(`caps a batch at ${MAX_BATCH_ROWS} listings`, () => {
    const csv = ["title", ...Array.from({ length: MAX_BATCH_ROWS + 1 }, (_, i) => `Item ${i}`)].join("\n");
    expect(() => parseBatchCsv(csv)).toThrow(`at most ${MAX_BATCH_ROWS}`);
    expect(parseBatchCsv(csv.split("\n").slice(0, MAX_BATCH_ROWS + 1).join("\n"))).toHaveLength(MAX_BATCH_ROWS);
  });
});
