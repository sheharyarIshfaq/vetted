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

type Strings = {
  checking: string;
  steps: [string, string, string];
  tag: Record<Verdict, string>;
  headline: Record<Verdict, string>;
  lookFor: string;
  whatToDo: string;
  officialNotice: string;
  closestNotice: string;
  readNotice: string;
  copy: string;
  copied: string;
  copyFailed: string;
  searched: string;
  details: string;
  minimise: string;
  language: string;
  retry: string;
};

export const STRINGS: Record<Lang, Strings> = {
  en: {
    checking: "Checking this listing…",
    steps: ["Reading the listing", "Searching the official recall lists", "Comparing photos"],
    tag: { recalled: "RECALLED", check_label: "CHECK THE LABEL", clear: "NO RECALL FOUND" },
    headline: { recalled: "Don't buy it as it is.", check_label: "Ask for the label first.", clear: "No recall found." },
    lookFor: "On the label, look for",
    whatToDo: "What the notice says to do",
    officialNotice: "Official notice",
    closestNotice: "Closest notice",
    readNotice: "Read the notice",
    copy: "Copy message for seller",
    copied: "Message copied",
    copyFailed: "Copy failed, open Details",
    searched: "See what we searched",
    details: "Details",
    minimise: "Minimise",
    language: "Afficher en français",
    retry: "Try again",
  },
  fr: {
    checking: "Vérification de l'annonce…",
    steps: ["Lecture de l'annonce", "Recherche dans les listes officielles de rappels", "Comparaison des photos"],
    tag: { recalled: "RAPPELÉ", check_label: "VÉRIFIEZ L'ÉTIQUETTE", clear: "AUCUN RAPPEL TROUVÉ" },
    headline: { recalled: "Ne l'achetez pas en l'état.", check_label: "Demandez d'abord l'étiquette.", clear: "Aucun rappel trouvé." },
    lookFor: "Sur l'étiquette, cherchez",
    whatToDo: "Ce que dit la fiche de rappel",
    officialNotice: "Fiche officielle",
    closestNotice: "Fiche la plus proche",
    readNotice: "Lire la fiche",
    copy: "Copier le message pour le vendeur",
    copied: "Message copié",
    copyFailed: "Échec de la copie, ouvrez Détails",
    searched: "Voir ce qui a été cherché",
    details: "Détails",
    minimise: "Réduire",
    language: "Show in English",
    retry: "Réessayer",
  },
};

export function panelFor(result: CheckResult, lang: Lang) {
  return lang === "fr" ? (result.panelFr ?? result.panel) : result.panel;
}

export type ListingPayload = { pageUrl: string; title: string; description: string; imageUrls: string[] };

// One finished check as the popup lists it, kept in chrome.storage.local only.
export type SavedCheck = {
  id: string;
  verdict: Verdict;
  title: string;
  headline: string;
  image: string | null;
  pageUrl: string;
  host: string;
};

export const MAX_SAVED_CHECKS = 10;

export function savedCheck(result: CheckResult, payload: ListingPayload): SavedCheck {
  return {
    id: result.id,
    verdict: result.verdict,
    title: result.panel?.title ?? payload.title,
    headline: STRINGS.en.headline[result.verdict],
    image: payload.imageUrls[0] ?? null,
    pageUrl: payload.pageUrl,
    host: new URL(payload.pageUrl).hostname.replace(/^www\./, ""),
  };
}

// The newest check first, one entry per listing.
export function addToHistory(history: SavedCheck[], check: SavedCheck) {
  return [check, ...history.filter((entry) => entry.pageUrl !== check.pageUrl)].slice(0, MAX_SAVED_CHECKS);
}

export function isSavedCheck(value: unknown): value is SavedCheck {
  const check = value as SavedCheck | null;
  return typeof check?.id === "string" && typeof check.title === "string" && check.verdict in VERDICT_LABELS;
}

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

export function resultUrl(result: { id: string }) {
  return `${__TIKO_API_BASE_URL__}/check/${encodeURIComponent(result.id)}`;
}
