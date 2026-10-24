// Runs on the listing page the user is viewing. It reads only the page URL, og tags, the description
// and the gallery photos, then opens Tiko's local receive page with them in the URL fragment,
// which never leaves the browser and isn't affected by the marketplace's CSP.
const SOURCE = `(() => {
  const meta = (key) => document.querySelector('meta[property="' + key + '"],meta[name="' + key + '"]')?.content?.trim() || "";
  const text = (selectors) => {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.innerText.trim()) return element.innerText.trim();
    }
    return "";
  };
  const gallery = [
    '[data-qa-id*="adview_spotlight"] img',
    '[data-qa-id*="slideshow"] img',
    '[data-testid*="item-photo"] img',
    '[data-testid*="gallery"] img',
  ];
  const photos = [...document.querySelectorAll(gallery.join(","))]
    .filter((image) => image.naturalWidth >= 400)
    .map((image) => image.currentSrc || image.src);
  const payload = {
    url: location.href,
    title: meta("og:title") || document.title,
    ogDescription: meta("og:description"),
    description: text(['[data-qa-id="adview_description_container"]', '[data-testid="item-description"]', '[itemprop="description"]']),
    images: [...new Set([meta("og:image"), ...photos])].filter((url) => url.startsWith("https://")).slice(0, 12),
  };
  window.open("__ORIGIN__/dev/collector/receive#" + encodeURIComponent(JSON.stringify(payload)), "tiko-collect", "width=480,height=560");
})();`;

export function bookmarklet(origin: string) {
  const compact = SOURCE.replace(/\n\s*/g, " ").replace("__ORIGIN__", origin);
  return `javascript:${encodeURIComponent(compact)}`;
}
