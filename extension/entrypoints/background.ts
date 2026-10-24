import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { addToHistory, isCheckResult, isSavedCheck, savedCheck, type CheckResponse, type ListingPayload, type Verdict } from "../utils/check";
import { INK, MARKS, PALETTE, TAG_HOLE, TAG_OUTLINE } from "../utils/tag";

// The toolbar icon becomes the verdict's tag.
function icon(verdict: Verdict, size: number): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not draw the toolbar icon");
  const scale = size / 120;
  context.translate(0, (size - 80 * scale) / 2);
  context.scale(scale, scale);
  context.translate(60, 40);
  context.rotate((-10 * Math.PI) / 180);
  context.translate(-60, -40);
  context.fillStyle = PALETTE[verdict].color;
  context.fill(new Path2D(`${TAG_OUTLINE} ${TAG_HOLE}`), "evenodd");
  const mark = MARKS[verdict];
  context.strokeStyle = INK;
  context.lineWidth = mark.width + 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke(new Path2D(mark.d));
  if (mark.dot) {
    context.fillStyle = INK;
    context.beginPath();
    context.arc(73, 60, 6.5, 0, Math.PI * 2);
    context.fill();
  }
  return context.getImageData(0, 0, size, size);
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
      const payload = message.payload as ListingPayload;
      const outcome = await check(payload);
      const tabId = sender.tab?.id;
      if (outcome.ok && tabId !== undefined) {
        const saved = savedCheck(outcome.result, payload);
        const { history } = await browser.storage.local.get("history");
        await browser.action.setIcon({ tabId, imageData: { 16: icon(outcome.result.verdict, 16), 32: icon(outcome.result.verdict, 32) } });
        await browser.storage.local.set({
          [`result:${tabId}`]: saved,
          history: addToHistory(Array.isArray(history) ? history.filter(isSavedCheck) : [], saved),
        });
      }
      return outcome;
    }

    if (message?.type === "TIKO_GET_RESULT") {
      const key = `result:${message.tabId}`;
      return (await browser.storage.local.get(key))[key] ?? null;
    }
  });
});
