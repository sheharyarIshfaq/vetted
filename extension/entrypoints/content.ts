import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { resultUrl, toCheckResponse, type CheckResponse, type CheckResult, type Verdict } from "../utils/check";

export default defineContentScript({
  matches: ["https://www.leboncoin.fr/ad/*", "https://www.vinted.fr/items/*"],
  main() {
const palette = {
  recalled: { color: "#C2362B", soft: "#FBE9E7", text: "#8F2219", title: "Recalled" },
  check_label: { color: "#B86A00", soft: "#FBF1E3", text: "#7A4700", title: "Check the label" },
  clear: { color: "#1E7F55", soft: "#E7F1EC", text: "#145C3E", title: "No recall found" },
};

const meta = (name: string) =>
  document.querySelector<HTMLMetaElement>(`meta[property="${name}"],meta[name="${name}"]`)?.content?.trim() || "";

function listingImages() {
  let lebons = false;
  try {
    const data = JSON.parse(document.getElementById("__NEXT_DATA__")?.textContent || "{}");
    const urls = data?.props?.pageProps?.ad?.images?.urls_large;
    if (Array.isArray(urls)) {
      lebons = urls.length > 0;
      if (lebons) return urls.filter((url: unknown): url is string => typeof url === "string" && url.startsWith("https://"));
    }
  } catch {
    // Fall back to the rendered gallery when the page data is unavailable.
  }

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

function readPage() {
  const url = new URL(location.href);
  const supported =
    (url.hostname === "www.leboncoin.fr" && /^\/ad\//.test(url.pathname)) ||
    (url.hostname === "www.vinted.fr" && /^\/items\//.test(url.pathname));
  if (!supported) return null;
  const title = meta("og:title");
  const description = meta("og:description");
  const imageUrls = listingImages();
  if (!title || imageUrls.length === 0) return null;
  return { pageUrl: location.href, title, description, imageUrls: [...new Set(imageUrls)].slice(0, 12) };
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
  .panel { position: fixed; right: 24px; bottom: 24px; width: min(420px, calc(100vw - 32px)); background: #fff; color: #16202B; border: 2px solid #CBD2CC; border-radius: 16px; box-shadow: 0 12px 40px #16202b2b; overflow: hidden; font: 14px/1.5 Onest, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; z-index: 2147483647; }
  .head { display: flex; gap: 12px; align-items: flex-start; padding: 16px; }
  .sticker { flex: 0 0 44px; width: 44px; height: 44px; }
  .eyebrow { color: var(--text); font: 11px/1.4 "IBM Plex Mono", ui-monospace, monospace; letter-spacing: .06em; text-transform: uppercase; }
  h2 { margin: 3px 0 0; font-size: 17px; line-height: 1.3; font-weight: 700; }
  p { margin: 5px 0 0; color: #3A4552; }
  .body { padding: 12px 16px 16px; border-top: 1px solid #E2E6E1; }
  .fact { margin: 0 0 8px; padding-left: 18px; color: #3A4552; position: relative; }
  .fact::before { content: ""; position: absolute; left: 0; top: .46em; width: 8px; height: 8px; border-radius: 50%; background: var(--color); }
  .actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  a, button { font: 600 13px Onest, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; text-decoration: none; border-radius: 10px; padding: 10px 13px; min-height: 40px; cursor: pointer; }
  a { background: #16202B; color: #fff; }
  button { background: #fff; color: #16202B; border: 1px solid #CBD2CC; }
  .message { padding: 16px 44px 16px 16px; }
  .message p { margin: 0 0 12px; }
  .close { position: absolute; right: 10px; top: 10px; width: 28px; height: 28px; min-height: auto; padding: 0; border: 0; background: transparent; color: #6B7684; font-size: 20px; }
  .fallback { position: fixed; right: 24px; bottom: 24px; z-index: 2147483647; border: 0; border-radius: 10px; padding: 12px 16px; background: #0F6B4F; color: #fff; font: 600 14px Onest, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; box-shadow: 0 4px 16px #16202b33; cursor: pointer; }
  .photo-sticker { position: fixed; width: 32px; height: 32px; pointer-events: none; z-index: 2147483647; filter: drop-shadow(0 2px 6px #16202b33); }
  @media (max-width: 560px) { .panel { right: 12px; bottom: 12px; width: calc(100vw - 24px); } }
`;
shadow.append(style);

function sticker(verdict: Verdict, size: number) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 104 104");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  const group = document.createElementNS(svg.namespaceURI, "g");
  group.setAttribute("transform", "rotate(-8 52 52)");
  const circle = document.createElementNS(svg.namespaceURI, "circle");
  circle.setAttribute("cx", "52"); circle.setAttribute("cy", "52"); circle.setAttribute("r", "46"); circle.setAttribute("fill", palette[verdict].color);
  group.append(circle);
  if (verdict === "clear") {
    const mark = document.createElementNS(svg.namespaceURI, "path");
    mark.setAttribute("d", "M31 53 L45 67 L73 37"); mark.setAttribute("fill", "none"); mark.setAttribute("stroke", "#fff"); mark.setAttribute("stroke-width", "11"); mark.setAttribute("stroke-linecap", "round"); mark.setAttribute("stroke-linejoin", "round"); group.append(mark);
  } else if (verdict === "check_label") {
    const line = document.createElementNS(svg.namespaceURI, "path");
    line.setAttribute("d", "M52 28 L52 58"); line.setAttribute("stroke", "#fff"); line.setAttribute("stroke-width", "11"); line.setAttribute("stroke-linecap", "round"); group.append(line);
    const dot = document.createElementNS(svg.namespaceURI, "circle");
    dot.setAttribute("cx", "52"); dot.setAttribute("cy", "75"); dot.setAttribute("r", "7"); dot.setAttribute("fill", "#fff"); group.append(dot);
  } else {
    const cross = document.createElementNS(svg.namespaceURI, "path");
    cross.setAttribute("d", "M35 35 L69 69 M69 35 L35 69"); cross.setAttribute("fill", "none"); cross.setAttribute("stroke", "#fff"); cross.setAttribute("stroke-width", "11"); cross.setAttribute("stroke-linecap", "round"); group.append(cross);
  }
  svg.append(group);
  return svg;
}

function removeChildren() {
  shadow.querySelectorAll(".panel, .fallback, .photo-sticker").forEach((node) => node.remove());
}

function showFallback() {
  removeChildren();
  const button = document.createElement("button");
  button.className = "fallback";
  button.textContent = "Check this page";
  button.addEventListener("click", () => void runCheck(true));
  shadow.append(button);
}

function showResult(result: CheckResult) {
  removeChildren();
  const colors = palette[result.verdict];
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.setAttribute("aria-label", "Tiko recall check");
  panel.style.borderColor = colors.color;
  const head = document.createElement("div");
  head.className = "head";
  head.style.background = colors.soft;
  head.append(sticker(result.verdict, 44));
  const summary = document.createElement("div");
  summary.style.setProperty("--text", colors.text);
  const eyebrow = document.createElement("div"); eyebrow.className = "eyebrow"; eyebrow.textContent = `tiko · ${colors.title}`;
  const title = document.createElement("h2");
  title.textContent = result.verdict === "recalled" ? "This listing matches a recalled product." : result.verdict === "check_label" ? "Check the label before you buy." : "No recall found for this listing.";
  const description = document.createElement("p");
  description.textContent = result.recall?.productName || "Tiko checked official recall lists from France and the EU.";
  summary.append(eyebrow, title, description);
  head.append(summary);
  head.append(closeButton(panel));
  const body = document.createElement("div"); body.className = "body"; body.style.setProperty("--color", colors.color);
  for (const evidence of result.evidence.slice(0, 2)) {
    const fact = document.createElement("div"); fact.className = "fact"; fact.textContent = evidence.fact; body.append(fact);
  }
  const actions = document.createElement("div"); actions.className = "actions";
  const link = document.createElement("a"); link.href = resultUrl(result); link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Full result";
  actions.append(link);
  const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "Check again"; retry.addEventListener("click", () => void runCheck(true)); actions.append(retry);
  body.append(actions);
  panel.append(head, body);
  shadow.append(panel);
  placePhotoSticker(result.verdict);
}

let photoSticker: HTMLElement | null = null;
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
  window.addEventListener("scroll", position, { passive: true });
  window.addEventListener("resize", position);
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
  const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "Try again"; retry.addEventListener("click", () => void runCheck(true));
  panel.append(text, retry, closeButton(panel));
  shadow.append(panel);
}

async function runCheck(forceFallback = false): Promise<CheckResponse | undefined> {
  const page = readPage();
  if (!page && !forceFallback) {
    showFallback();
    return undefined;
  }
  const payload = page || {
    pageUrl: location.href,
    title: document.title,
    description: meta("og:description"),
    imageUrls: meta("og:image").startsWith("https://") ? [meta("og:image")] : [],
  };
  removeChildren();
  const loading = document.createElement("section"); loading.className = "panel"; loading.textContent = "Checking this listing…"; shadow.append(loading);
  let outcome: CheckResponse;
  try {
    outcome = toCheckResponse(await browser.runtime.sendMessage({ type: "TIKO_RUN_CHECK", payload }), "The check failed. Please try again.");
  } catch {
    outcome = { ok: false, error: "Tiko stopped responding. Reload the page and try again." };
  }
  if (outcome.ok) showResult(outcome.result);
  else showError(outcome.error);
  return outcome;
}

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "TIKO_CHECK_PAGE") return runCheck(true);
});

if (readPage()) void runCheck();
else showFallback();
  },
});
