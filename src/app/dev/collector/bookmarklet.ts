// Runs on the listing page the user is viewing. It reads only the page URL, og tags, the description
// and the listing's photos, then opens Tiko's local receive page with them in the URL fragment,
// which never leaves the browser and isn't affected by the marketplace's CSP.
// Photos come from Leboncoin's page data (only ad.images, never the seller), else from the rendered gallery:
// Leboncoin's images have alt "<title> (image 2)" and a "classified" size, Vinted's sit in item-photo.
// No comments inside SOURCE: it is joined into one line.
const SOURCE = `(() => {
  const meta = (key) => document.querySelector('meta[property="' + key + '"],meta[name="' + key + '"]')?.content?.trim() || "";
  const text = (selectors) => {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.innerText.trim()) return element.innerText.trim();
    }
    return "";
  };
  const embedded = () => {
    try {
      const urls = JSON.parse(document.getElementById("__NEXT_DATA__")?.textContent || "{}")?.props?.pageProps?.ad?.images?.urls_large;
      return Array.isArray(urls) ? urls : [];
    } catch {
      return [];
    }
  };
  const gallery = [
    'img[alt$=")"][src*="rule=classified"]',
    '[data-testid*="item-photo"] img',
    '[data-testid*="gallery"] img',
  ];
  const rendered = [...document.querySelectorAll(gallery.join(","))]
    .filter((image) => image.naturalWidth >= 400)
    .map((image) => image.currentSrc || image.src);
  const photos = embedded().length ? embedded() : rendered;
  const payload = {
    url: location.href,
    title: meta("og:title") || document.title,
    ogDescription: meta("og:description"),
    description: text(['[data-qa-id="adview_description_container"]', '[data-testid="item-description"]', '[itemprop="description"]']),
    images: [...new Set(photos.length ? photos : [meta("og:image")])].filter((url) => typeof url === "string" && url.startsWith("https://")).slice(0, 12),
  };
  window.open("__ORIGIN__/dev/collector/receive#" + encodeURIComponent(JSON.stringify(payload)), "tiko-collect", "width=480,height=560");
})();`;

export function bookmarklet(origin: string) {
  const compact = SOURCE.replace(/\n\s*/g, " ").replace("__ORIGIN__", origin);
  return `javascript:${encodeURIComponent(compact)}`;
}
