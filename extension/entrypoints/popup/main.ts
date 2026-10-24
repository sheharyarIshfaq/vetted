import { browser } from "wxt/browser";
import { VERDICT_LABELS, isCheckResult, isListingUrl, resultUrl, toCheckResponse, type CheckResult } from "../../utils/check";
import { PALETTE, sticker } from "../../utils/sticker";

const app = document.querySelector<HTMLDivElement>("#app")!;
const style = document.createElement("style");
style.textContent = `*{box-sizing:border-box}body{margin:0;width:320px;background:#F7F8F6;color:#16202B;font:14px/1.5 Onest,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{padding:18px}.brand{font-size:18px;font-weight:800;letter-spacing:-.04em;color:#0F6B4F}.sub{margin:3px 0 16px;color:#6B7684}.button,a{display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;border-radius:10px;font:600 14px Onest,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-decoration:none;cursor:pointer}.button{border:0;background:#16202B;color:#fff}.button:disabled{opacity:.6;cursor:wait}a{margin-top:9px;border:1px solid #CBD2CC;background:white;color:#16202B}.status{margin-top:12px;padding:10px;border-radius:9px;background:#fff;color:#3A4552}.status.error{background:#FBE9E7;color:#8F2219}[hidden]{display:none!important}.verdict{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px;padding:12px;border:2px solid;border-radius:14px}.verdict svg{flex:0 0 auto}.eyebrow{font:11px/1.4 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase}.verdict strong{display:block;margin-top:2px;font-size:15px;line-height:1.3}.verdict p{margin:3px 0 0;color:#3A4552;font-size:13px}`;
app.append(style);

const main = document.createElement("main");
const brand = document.createElement("div"); brand.className = "brand"; brand.textContent = "vetted";
const subtitle = document.createElement("p"); subtitle.className = "sub"; subtitle.textContent = "Check this listing against official recalls.";
const button = document.createElement("button"); button.className = "button"; button.textContent = "Check this page";
const resultLink = document.createElement("a"); resultLink.hidden = true; resultLink.target = "_blank"; resultLink.rel = "noopener noreferrer"; resultLink.textContent = "Open full result";
const statusMessage = document.createElement("div"); statusMessage.className = "status"; statusMessage.hidden = true; statusMessage.setAttribute("role", "status");
const verdictCard = document.createElement("section"); verdictCard.className = "verdict"; verdictCard.hidden = true; verdictCard.setAttribute("aria-live", "polite");
main.append(brand, subtitle, verdictCard, button, statusMessage, resultLink); app.append(main);

function showStatus(text: string, error = false) {
  statusMessage.textContent = text;
  statusMessage.classList.toggle("error", error);
  statusMessage.hidden = false;
}

function showVerdict(result: CheckResult) {
  const colors = PALETTE[result.verdict];
  const eyebrow = document.createElement("div"); eyebrow.className = "eyebrow"; eyebrow.style.color = colors.text; eyebrow.textContent = VERDICT_LABELS[result.verdict];
  const title = document.createElement("strong"); title.textContent = result.panel?.title ?? result.recall?.productName ?? "This listing";
  const text = document.createElement("div"); text.append(eyebrow, title);
  if (result.panel?.risk) {
    const risk = document.createElement("p"); risk.textContent = result.panel.risk; text.append(risk);
  }
  verdictCard.style.borderColor = colors.color;
  verdictCard.style.background = colors.soft;
  verdictCard.replaceChildren(sticker(result.verdict, 40), text);
  verdictCard.hidden = false;
  statusMessage.hidden = true;
  resultLink.href = resultUrl(result);
  resultLink.hidden = false;
}

const [tab] = await browser.tabs.query({ active: true, currentWindow: true }).catch(() => []);
const onListing = tab?.id !== undefined && isListingUrl(tab.url);

if (!onListing) {
  button.disabled = true;
  showStatus("Open a Leboncoin or Vinted listing to check it.");
} else {
  const saved: unknown = await browser.runtime.sendMessage({ type: "TIKO_GET_RESULT", tabId: tab.id }).catch(() => null);
  if (isCheckResult(saved)) showVerdict(saved);
}

button.addEventListener("click", async () => {
  if (!onListing || tab?.id === undefined) return;
  button.disabled = true;
  button.textContent = "Checking…";
  resultLink.hidden = true;
  verdictCard.hidden = true;
  showStatus("Reading this listing…");
  try {
    const outcome = toCheckResponse(
      await browser.tabs.sendMessage(tab.id, { type: "TIKO_CHECK_PAGE" }),
      "Vetted couldn't check this page. Try again.",
    );
    if (outcome.ok) showVerdict(outcome.result);
    else showStatus(outcome.error, true);
  } catch {
    // The page was open before the extension loaded, so nothing is listening yet.
    showStatus("Reload the listing page, then try again.", true);
  } finally {
    button.disabled = false;
    button.textContent = statusMessage.classList.contains("error") ? "Try again" : "Check this page";
  }
});

export {};
