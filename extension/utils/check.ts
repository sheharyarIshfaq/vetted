export type Verdict = "recalled" | "check_label" | "clear";

// What the panel shows, written by the server from the recall's own data.
export type PanelSummary = {
  title: string;
  line: string;
  risk: string | null;
  source: { label: string; url: string } | null;
  lookFor: string[];
  whatToDo: string[];
  sellerMessage: string | null;
};

export type CheckResult = {
  id: string;
  verdict: Verdict;
  evidence: { fact: string; matched: boolean; source: string }[];
  recall: { productName: string; url: string; sourceRef: string } | null;
  panel?: PanelSummary; // absent on results saved before the panel summary
  panelFr?: PanelSummary;
};

export type Lang = "fr" | "en";

// Both supported sites are French, so the panel starts in French; the switch in its header changes it.
export function defaultLang(hostname: string): Lang {
  return hostname.endsWith(".fr") ? "fr" : "en";
}

export const STRINGS: Record<Lang, Record<"checking" | "lookFor" | "whatToDo" | "copy" | "copied" | "copyFailed" | "full" | "notice" | "close" | "retry" | Verdict, string>> = {
  en: {
    checking: "Tiko is checking this listing against official recalls…",
    lookFor: "What to look for",
    whatToDo: "What the notice says to do",
    copy: "Copy a message for the seller",
    copied: "Message copied",
    copyFailed: "Copy failed, open the full result",
    full: "Full result",
    notice: "Open the official notice",
    close: "Close panel",
    retry: "Try again",
    recalled: "recalled",
    check_label: "possibly recalled",
    clear: "no recall found",
  },
  fr: {
    checking: "Tiko compare cette annonce aux rappels officiels…",
    lookFor: "À vérifier",
    whatToDo: "Ce que dit la fiche de rappel",
    copy: "Copier un message pour le vendeur",
    copied: "Message copié",
    copyFailed: "Échec de la copie, ouvrez le résultat complet",
    full: "Résultat complet",
    notice: "Ouvrir la fiche officielle",
    close: "Fermer",
    retry: "Réessayer",
    recalled: "rappelé",
    check_label: "peut-être rappelé",
    clear: "aucun rappel trouvé",
  },
};

export function panelFor(result: CheckResult, lang: Lang) {
  return lang === "fr" ? (result.panelFr ?? result.panel) : result.panel;
}

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
