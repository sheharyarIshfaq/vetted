import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

type ListingPayload = {
  pageUrl: string;
  title: string;
  description: string;
  imageUrls: string[];
};

type CheckResult = {
  id: string;
  verdict: "recalled" | "check_label" | "clear";
  evidence: { fact: string; matched: boolean; source: string }[];
  recall: { productName: string; url: string; sourceRef: string } | null;
};

const colors: Record<CheckResult["verdict"], string> = {
  recalled: "#C2362B",
  check_label: "#B86A00",
  clear: "#1E7F55",
};

function icon(verdict: CheckResult["verdict"]): ImageData {
  const canvas = new OffscreenCanvas(32, 32);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not draw the toolbar icon");
  context.save();
  context.translate(16, 16);
  context.rotate(-0.14);
  context.beginPath();
  context.arc(0, 0, 14, 0, Math.PI * 2);
  context.fillStyle = colors[verdict];
  context.fill();
  context.strokeStyle = "#fff";
  context.lineWidth = 3.5;
  context.lineCap = "round";
  if (verdict === "clear") {
    context.beginPath();
    context.moveTo(-6, 0);
    context.lineTo(-1, 5);
    context.lineTo(7, -5);
    context.stroke();
  } else if (verdict === "check_label") {
    context.beginPath();
    context.moveTo(0, -6);
    context.lineTo(0, 2);
    context.stroke();
    context.beginPath();
    context.arc(0, 8, 1.3, 0, Math.PI * 2);
    context.fillStyle = "#fff";
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(-5, -5);
    context.lineTo(5, 5);
    context.moveTo(5, -5);
    context.lineTo(-5, 5);
    context.stroke();
  }
  context.restore();
  return context.getImageData(0, 0, 32, 32);
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message?.type === "TIKO_RUN_CHECK") {
      const payload = message.payload as ListingPayload;
      const response = await fetch(`${__TIKO_API_BASE_URL__}/api/extension/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The check failed. Please try again.");
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        const result = data as CheckResult;
        await browser.action.setIcon({ tabId, imageData: { 16: icon(result.verdict), 32: icon(result.verdict) } });
        await browser.storage.local.set({ [`result:${tabId}`]: result });
      }
      return data;
    }

    if (message?.type === "TIKO_GET_RESULT") {
      const key = `result:${message.tabId}`;
      return (await browser.storage.local.get(key))[key] ?? null;
    }
  });
});
