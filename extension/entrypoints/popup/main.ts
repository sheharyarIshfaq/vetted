import { browser } from "wxt/browser";

type CheckResult = { id: string; verdict: "recalled" | "check_label" | "clear" };

const app = document.querySelector<HTMLDivElement>("#app")!;
const style = document.createElement("style");
style.textContent = `*{box-sizing:border-box}body{margin:0;width:320px;background:#F7F8F6;color:#16202B;font:14px/1.5 Onest,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{padding:18px}.brand{font-size:18px;font-weight:800;letter-spacing:-.04em;color:#0F6B4F}.sub{margin:3px 0 16px;color:#6B7684}.button,a{display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;border-radius:10px;font:600 14px Onest,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-decoration:none;cursor:pointer}.button{border:0;background:#16202B;color:#fff}.button:disabled{opacity:.6;cursor:wait}a{margin-top:9px;border:1px solid #CBD2CC;background:white;color:#16202B}.status{margin-top:12px;padding:10px;border-radius:9px;background:#fff;color:#3A4552}.status[hidden]{display:none}`;
app.append(style);

const main = document.createElement("main");
const brand = document.createElement("div"); brand.className = "brand"; brand.textContent = "tiko";
const subtitle = document.createElement("p"); subtitle.className = "sub"; subtitle.textContent = "Check this listing against official recalls.";
const button = document.createElement("button"); button.className = "button"; button.textContent = "Check this page";
const resultLink = document.createElement("a"); resultLink.hidden = true; resultLink.target = "_blank"; resultLink.rel = "noopener noreferrer"; resultLink.textContent = "Open full result";
const statusMessage = document.createElement("div"); statusMessage.className = "status"; statusMessage.hidden = true;
main.append(brand, subtitle, button, statusMessage, resultLink); app.append(main);

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

const tab = await activeTab();
if (tab?.id !== undefined) {
  try {
    const oldResult = await browser.runtime.sendMessage({ type: "TIKO_GET_RESULT", tabId: tab.id }) as CheckResult | null;
    if (oldResult) {
      resultLink.href = `${__TIKO_API_BASE_URL__}/check/${encodeURIComponent(oldResult.id)}`;
      resultLink.hidden = false;
      statusMessage.textContent = `Last verdict: ${oldResult.verdict.replace("_", " ")}`;
      statusMessage.hidden = false;
    }
  } catch {
    // A new tab has no saved result yet.
  }
}

button.addEventListener("click", async () => {
  button.disabled = true;
  button.textContent = "Checking…";
  statusMessage.hidden = false;
  statusMessage.textContent = "Reading this listing…";
  try {
    if (!tab?.id) throw new Error("Open a Leboncoin or Vinted listing first.");
    const result = await browser.tabs.sendMessage(tab.id, { type: "TIKO_CHECK_PAGE" }) as CheckResult;
    resultLink.href = `${__TIKO_API_BASE_URL__}/check/${encodeURIComponent(result.id)}`;
    resultLink.hidden = false;
    statusMessage.textContent = `Verdict: ${result.verdict.replace("_", " ")}`;
  } catch (error) {
    statusMessage.textContent = error instanceof Error ? error.message : "Could not check this page.";
  } finally {
    button.disabled = false;
    button.textContent = "Check this page";
  }
});

export {};
