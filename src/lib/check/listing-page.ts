import { safeFetch } from "./safe-fetch";

export type ListingPage = { title: string | null; description: string | null; image: string | null };

const MAX_PAGE_BYTES = 2 * 1024 * 1024;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function attribute(tag: string, name: string) {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return match ? (match[2] ?? match[3]) : null;
}

// Reads only og:title, og:description and og:image from the page.
export function parseOpenGraph(html: string): ListingPage {
  const found: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attribute(tag, "property") ?? attribute(tag, "name"))?.toLowerCase();
    const content = attribute(tag, "content");
    if (key && content && ["og:title", "og:description", "og:image"].includes(key) && !(key in found)) {
      found[key] = decodeEntities(content).trim();
    }
  }
  return {
    title: found["og:title"] || null,
    description: found["og:description"] || null,
    image: found["og:image"]?.startsWith("http") ? found["og:image"] : null,
  };
}

export async function readListingPage(url: string) {
  const { body } = await safeFetch(url, { timeoutMs: 5000, maxBytes: MAX_PAGE_BYTES });
  const page = parseOpenGraph(new TextDecoder().decode(body));
  if (!page.title && !page.description) throw new Error("No Open Graph tags on the page");
  return page;
}
