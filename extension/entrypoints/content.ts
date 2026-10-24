import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { isListingUrl, resultUrl, toCheckResponse, type CheckResponse, type CheckResult, type ListingPayload, type Verdict } from "../utils/check";
import { PALETTE, sticker } from "../utils/sticker";

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
style.textContent = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel { position: fixed; left: 20px; bottom: 20px; width: min(360px, calc(100vw - 32px)); max-height: min(440px, calc(100vh - 40px)); display: flex; flex-direction: column; background: #fff; color: #16202B; border: 2px solid #CBD2CC; border-radius: 16px; box-shadow: 0 12px 40px #16202b2b; overflow: hidden; font: 13px/1.45 Onest, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; z-index: 2147483647; }
  .head { position: relative; display: flex; gap: 12px; align-items: flex-start; padding: 14px 40px 14px 14px; }
  .head svg { flex: 0 0 auto; }
  .eyebrow { font: 11px/1.4 "IBM Plex Mono", ui-monospace, monospace; letter-spacing: .06em; text-transform: uppercase; }
  h2 { margin: 2px 0 0; font-size: 16px; line-height: 1.3; font-weight: 700; }
  p { margin: 4px 0 0; color: #3A4552; }
  .body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
  .block { background: #F2F4F1; border-radius: 8px; padding: 8px 10px; }
  .block-title { font-weight: 600; margin-bottom: 2px; }
  ul { margin: 0; padding: 0 0 0 16px; color: #3A4552; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 12px; }
  li + li { margin-top: 2px; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 12px; color: #3A4552; font-size: 12px; }
  .risk { font-weight: 600; }
  a.source { padding: 0; min-height: 0; background: none; color: #0F6B4F; font: 500 12px "IBM Plex Mono", ui-monospace, monospace; text-decoration: underline; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  a, button { display: inline-flex; align-items: center; font: 600 13px Onest, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; text-decoration: none; border-radius: 10px; padding: 8px 12px; min-height: 38px; cursor: pointer; }
  .primary { background: #16202B; color: #fff; border: 0; }
  .secondary, button { background: #fff; color: #16202B; border: 1px solid #CBD2CC; }
  .message { padding: 16px 44px 16px 16px; }
  .message p { margin: 0 0 12px; }
  .close { position: absolute; right: 10px; top: 10px; width: 28px; height: 28px; min-height: auto; padding: 0; border: 0; background: transparent; color: #6B7684; font-size: 20px; }
  .loading { display: flex; align-items: center; gap: 10px; padding: 14px 16px; color: #3A4552; }
  .spinner { flex: 0 0 18px; width: 18px; height: 18px; border: 2.5px solid #E2E6E1; border-top-color: #0F6B4F; border-radius: 50%; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
  .photo-sticker { position: fixed; width: 32px; height: 32px; pointer-events: none; z-index: 2147483647; filter: drop-shadow(0 2px 6px #16202b33); }
  @media (max-width: 560px) { .panel { left: 12px; bottom: 12px; width: calc(100vw - 24px); } }
`;
shadow.append(style);

let photoSticker: HTMLElement | null = null;
let stickerListeners: AbortController | null = null;

function removeChildren() {
  shadow.querySelectorAll(".panel, .photo-sticker").forEach((node) => node.remove());
  stickerListeners?.abort();
  stickerListeners = null;
  photoSticker = null;
}

function showLoading() {
  removeChildren();
  const panel = document.createElement("section"); panel.className = "panel loading"; panel.setAttribute("role", "status");
  const spinner = document.createElement("span"); spinner.className = "spinner"; spinner.setAttribute("aria-hidden", "true");
  const text = document.createElement("span"); text.textContent = "Tiko is checking this listing against official recalls…";
  panel.append(spinner, text);
  shadow.append(panel);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function list(heading: string, lines: string[]) {
  const block = element("div", "block");
  block.append(element("div", "block-title", heading));
  const items = element("ul", "");
  for (const line of lines) items.append(element("li", "", line));
  block.append(items);
  return block;
}

function copyButton(message: string) {
  const button = element("button", "primary", "Copy a message for the seller");
  button.type = "button";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(message);
      button.textContent = "Message copied";
    } catch {
      button.textContent = "Copy failed, open the full result";
    }
    setTimeout(() => { button.textContent = "Copy a message for the seller"; }, 2500);
  });
  return button;
}

function showResult(result: CheckResult) {
  removeChildren();
  const colors = PALETTE[result.verdict];
  const summary = result.panel;
  const panel = element("section", "panel");
  panel.setAttribute("aria-label", "Tiko recall check");
  panel.style.borderColor = colors.color;

  const head = element("div", "head");
  head.style.background = colors.soft;
  const text = element("div", "summary");
  const eyebrow = element("div", "eyebrow", `tiko · ${colors.eyebrow}`);
  eyebrow.style.color = colors.text;
  text.append(eyebrow, element("h2", "", summary?.title ?? result.recall?.productName ?? "This listing"));
  text.append(element("p", "", summary?.line ?? result.evidence[0]?.fact ?? ""));
  head.append(sticker(result.verdict, 40), text, closeButton(panel));

  const body = element("div", "body");
  if (summary?.lookFor.length) body.append(list("What to look for", summary.lookFor));
  if (summary?.whatToDo.length) body.append(list("What the notice says to do", summary.whatToDo));
  if (summary?.risk || summary?.source) {
    const meta = element("div", "meta");
    if (summary.risk) meta.append(element("span", "risk", summary.risk));
    if (summary.source) {
      const source = element("a", "source", summary.source.label);
      source.href = summary.source.url; source.target = "_blank"; source.rel = "noopener noreferrer";
      source.title = "Open the official notice";
      meta.append(source);
    }
    body.append(meta);
  }

  const actions = element("div", "actions");
  if (summary?.sellerMessage) actions.append(copyButton(summary.sellerMessage));
  const full = element("a", "secondary", "Full result");
  full.href = resultUrl(result); full.target = "_blank"; full.rel = "noopener noreferrer";
  actions.append(full);
  body.append(actions);

  panel.append(head, body);
  shadow.append(panel);
  placePhotoSticker(result.verdict);
}

function placePhotoSticker(verdict: Verdict) {
  const image = document.querySelector<HTMLImageElement>('img[alt$=")"][src*="rule=classified"], [data-testid*="item-photo"] img, [data-testid*="gallery"] img');
  if (!image) return;
  const position = () => {
    const rect = image.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return;
    if (!photoSticker) {
      photoSticker = document.createElement("div");
      photoSticker.className = "photo-sticker";
      shadow.append(photoSticker);
    }
    photoSticker.replaceChildren(sticker(verdict, 32));
    photoSticker.style.left = `${rect.right - 48}px`;
    photoSticker.style.top = `${rect.top + 16}px`;
  };
  position();
  stickerListeners = new AbortController();
  window.addEventListener("scroll", position, { passive: true, signal: stickerListeners.signal });
  window.addEventListener("resize", position, { signal: stickerListeners.signal });
}

function closeButton(panel: HTMLElement) {
  const close = document.createElement("button"); close.className = "close"; close.type = "button"; close.setAttribute("aria-label", "Close panel"); close.textContent = "×";
  close.addEventListener("click", () => panel.remove());
  return close;
}

function showError(message: string) {
  removeChildren();
  const panel = document.createElement("section"); panel.className = "panel message"; panel.setAttribute("role", "alert");
  const text = document.createElement("p"); text.textContent = message;
  const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "Try again"; retry.addEventListener("click", () => void runCheck());
  panel.append(text, retry, closeButton(panel));
  shadow.append(panel);
}

// Only the latest run may draw: a slow answer for a listing the user has left is dropped.
let latestRun = 0;

async function runCheck(): Promise<CheckResponse> {
  const run = ++latestRun;
  showLoading();
  const page = await waitForPage();
  let outcome: CheckResponse;
  if (!page) {
    outcome = { ok: false, error: "Tiko couldn't read this listing. Try again once the page has loaded." };
  } else {
    try {
      outcome = toCheckResponse(await browser.runtime.sendMessage({ type: "TIKO_RUN_CHECK", payload: page }), "The check failed. Please try again.");
    } catch {
      outcome = { ok: false, error: "Tiko stopped responding. Reload the page and try again." };
    }
  }
  if (run !== latestRun) return outcome;
  if (outcome.ok) showResult(outcome.result);
  else showError(outcome.error);
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
    removeChildren();
  }
}, 1000);

void runCheck();
  },
});
