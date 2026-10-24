import { describe, expect, it } from "vitest";
import { parseOpenGraph } from "./listing-page";

describe("parseOpenGraph", () => {
  it("reads og:title, og:description and og:image in any attribute order", () => {
    const html = `<html><head>
      <meta property="og:title" content="Poussette Britax R&#246;mer Smile III &amp; si&#xE8;ge">
      <meta content='Très bon état, achetée en 2020' property='og:description' />
      <meta name="og:image" content="https://img.example.fr/a.jpg">
      <meta property="og:site_name" content="leboncoin">
    </head></html>`;
    expect(parseOpenGraph(html)).toEqual({
      title: "Poussette Britax Römer Smile III & siège",
      description: "Très bon état, achetée en 2020",
      image: "https://img.example.fr/a.jpg",
    });
  });

  it("keeps the first value of each tag", () => {
    const html = `<meta property="og:title" content="First"><meta property="og:title" content="Second">`;
    expect(parseOpenGraph(html).title).toBe("First");
  });

  it("returns nulls when tags are missing and ignores relative images", () => {
    expect(parseOpenGraph(`<meta property="og:image" content="/img.jpg"><title>x</title>`)).toEqual({
      title: null,
      description: null,
      image: null,
    });
  });
});
