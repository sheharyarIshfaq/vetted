import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { defaultLang, isListingUrl, toCheckResponse, type CheckResponse, type Lang, type ListingPayload } from "../utils/check";
import { PANEL_CSS, photoTag, renderPanel, type PanelState } from "../utils/panel";

export default defineContentScript({
  matches: ["https://www.leboncoin.fr/ad/*", "https://www.vinted.fr/items/*"],
  main() {
const meta = (name: string) =>
  document.querySelector<HTMLMetaElement>(`meta[property="${name}"],meta[name="${name}"]`)?.content?.trim() || "";

// Leboncoin's page data keeps describing the first listing after in-app navigation, so it's used only for this one.
function leboncoinImages() {
  try {
    const ad = JSON.parse(document.getElementById("__NEXT_DATA__")?.textContent || "{}")?.props?.pageProps?.ad;
    if (!ad || !location.pathname.endsWith(`/${ad.list_id}`)) return [];
    const urls: unknown = ad.images?.urls_large;
    return Array.isArray(urls) ? urls.filter((url): url is string => typeof url === "string" && url.startsWith("https://")) : [];
  } catch {
    return [];
  }
}

function listingImages() {
  const fromData = leboncoinImages();
  if (fromData.length) return fromData;

  const selectors = [
    'img[alt$=")"][src*="rule=classified"]',
    '[data-testid*="item-photo"] img',
    '[data-testid*="gallery"] img',
  ];
  const images = [...document.querySelectorAll<HTMLImageElement>(selectors.join(","))]
    .filter((image) => image.naturalWidth >= 200)
    .map((image) => image.currentSrc || image.src)
    .filter((url) => url.startsWith("https://"));
  if (images.length) return [...new Set(images)];
  const ogImage = meta("og:image");
  return ogImage.startsWith("https://") ? [ogImage] : [];
}

// The listing as shown, once the page's tags describe this URL; photos are optional, the text is enough to check.
function readPage(): ListingPayload | null {
  if (!isListingUrl(location.href)) return null;
  const title = meta("og:title");
  const ogUrl = meta("og:url");
  if (!title || (ogUrl && new URL(ogUrl, location.href).pathname !== location.pathname)) return null;
  const imageUrls = [...new Set(listingImages())].slice(0, 12);
  return { pageUrl: location.href, title, description: meta("og:description"), imageUrls };
}

async function waitForPage(timeoutMs = 6000) {
  for (let waited = 0; ; waited += 300) {
    const page = readPage();
    if (page || waited >= timeoutMs) return page;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

const host = document.createElement("div");
host.style.all = "initial";
host.style.position = "relative";
host.style.zIndex = "2147483647";
document.documentElement.append(host);
const shadow = host.attachShadow({ mode: "closed" });

const style = document.createElement("style");
style.textContent = PANEL_CSS;
shadow.append(style);

let lang: Lang = defaultLang(location.hostname);
let state: PanelState | null = null;
let tagListeners: AbortController | null = null;

function clear() {
  shadow.querySelectorAll(".panel, .photo-tag").forEach((node) => node.remove());
  tagListeners?.abort();
  tagListeners = null;
}

function show(next: PanelState) {
  state = next;
  clear();
  shadow.append(
    renderPanel(next, lang, {
      onLang: () => {
        lang = lang === "fr" ? "en" : "fr";
        if (state) show(state);
      },
      onClose: minimise,
      onRetry: () => void runCheck(),
    }),
  );
  if (next.kind === "result") hangTag(next);
}

// The panel goes, the tag on the photo stays and opens it again.
function minimise() {
  shadow.querySelector(".panel")?.remove();
}

const PHOTO = 'img[alt$=")"][src*="rule=classified"], [data-testid*="item-photo"] img, [data-testid*="gallery"] img';

function hangTag(result: Extract<PanelState, { kind: "result" }>) {
  const image = document.querySelector<HTMLImageElement>(PHOTO);
  if (!image) return;
  const tag = photoTag(result.result.verdict, lang, () => {
    if (!shadow.querySelector(".panel")) show(result);
  });
  const position = () => {
    const rect = image.getBoundingClientRect();
    tag.hidden = rect.width < 100 || rect.height < 100 || rect.bottom < 0 || rect.top > innerHeight;
    tag.style.left = `${rect.right - tag.offsetWidth - 24}px`;
    tag.style.top = `${rect.top}px`;
  };
  shadow.append(tag);
  position();
  tagListeners = new AbortController();
  window.addEventListener("scroll", position, { passive: true, signal: tagListeners.signal });
  window.addEventListener("resize", position, { signal: tagListeners.signal });
}

// Only the latest run may draw: a slow answer for a listing the user has left is dropped.
let latestRun = 0;

async function runCheck(): Promise<CheckResponse> {
  const run = ++latestRun;
  show({ kind: "loading", withPhotos: listingImages().length > 0 });
  const page = await waitForPage();
  let outcome: CheckResponse;
  if (!page) {
    outcome = { ok: false, error: "Vetted couldn't read this listing. Try again once the page has loaded." };
  } else {
    try {
      outcome = toCheckResponse(await browser.runtime.sendMessage({ type: "TIKO_RUN_CHECK", payload: page }), "The check failed. Please try again.");
    } catch {
      outcome = { ok: false, error: "Vetted stopped responding. Reload the page and try again." };
    }
  }
  if (run !== latestRun) return outcome;
  show(outcome.ok ? { kind: "result", result: outcome.result } : { kind: "error", message: outcome.error });
  return outcome;
}

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "TIKO_CHECK_PAGE") return runCheck();
});

// Both sites change listings without a page load, so a new URL starts a new check.
let shownUrl = location.href;
setInterval(() => {
  if (location.href === shownUrl) return;
  shownUrl = location.href;
  if (isListingUrl(shownUrl)) void runCheck();
  else {
    latestRun++;
    state = null;
    clear();
  }
}, 1000);

void runCheck();
  },
});
