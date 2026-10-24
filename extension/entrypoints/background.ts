import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { isCheckResult, type CheckResponse, type ListingPayload, type Verdict } from "../utils/check";

const colors: Record<Verdict, string> = {
  recalled: "#C2362B",
  check_label: "#B86A00",
  clear: "#1E7F55",
};

function icon(verdict: Verdict): ImageData {
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

async function check(payload: ListingPayload): Promise<CheckResponse> {
  let response: Response;
  try {
    response = await fetch(`${__TIKO_API_BASE_URL__}/api/extension/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: "Vetted can't be reached right now. Check your connection and try again." };
  }
  const data: unknown = await response.json().catch(() => null);
  if (response.ok && isCheckResult(data)) return { ok: true, result: data };
  const message = (data as { error?: unknown } | null)?.error;
  return { ok: false, error: typeof message === "string" && message ? message : "The check failed. Please try again." };
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message?.type === "TIKO_RUN_CHECK") {
      const outcome = await check(message.payload as ListingPayload);
      const tabId = sender.tab?.id;
      if (outcome.ok && tabId !== undefined) {
        await browser.action.setIcon({ tabId, imageData: { 16: icon(outcome.result.verdict), 32: icon(outcome.result.verdict) } });
        await browser.storage.local.set({ [`result:${tabId}`]: outcome.result });
      }
      return outcome;
    }

    if (message?.type === "TIKO_GET_RESULT") {
      const key = `result:${message.tabId}`;
      return (await browser.storage.local.get(key))[key] ?? null;
    }
  });
});
