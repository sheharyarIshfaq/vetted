export type Verdict = "recalled" | "check_label" | "clear";

export type CheckResult = {
  id: string;
  verdict: Verdict;
  evidence: { fact: string; matched: boolean; source: string }[];
  recall: { productName: string; url: string; sourceRef: string } | null;
};

export type ListingPayload = { pageUrl: string; title: string; description: string; imageUrls: string[] };

// Every message answer has this shape, so no caller ever reads a missing result.
export type CheckResponse = { ok: true; result: CheckResult } | { ok: false; error: string };

export const VERDICT_LABELS: Record<Verdict, string> = {
  recalled: "Recalled",
  check_label: "Check the label",
  clear: "No recall found",
};

export function isListingUrl(rawUrl: string | undefined) {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    return (
      (url.hostname === "www.leboncoin.fr" && url.pathname.startsWith("/ad/")) ||
      (url.hostname === "www.vinted.fr" && url.pathname.startsWith("/items/"))
    );
  } catch {
    return false;
  }
}

export function isCheckResult(value: unknown): value is CheckResult {
  const result = value as CheckResult | null;
  return (
    typeof result?.id === "string" &&
    (result.verdict === "recalled" || result.verdict === "check_label" || result.verdict === "clear") &&
    Array.isArray(result.evidence)
  );
}

// Turns whatever came back from a message into a CheckResponse with a sentence a person can read.
export function toCheckResponse(value: unknown, fallback: string): CheckResponse {
  const response = value as CheckResponse | null | undefined;
  if (response?.ok === true && isCheckResult(response.result)) return response;
  if (response?.ok === false && typeof response.error === "string" && response.error) return response;
  return { ok: false, error: fallback };
}

export function resultUrl(result: CheckResult) {
  return `${__TIKO_API_BASE_URL__}/check/${encodeURIComponent(result.id)}`;
}
