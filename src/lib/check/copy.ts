import type { EvidenceSource, RecallLimits, Verdict } from "../verdict";

// RappelConso writes risks in French; these map the common ones to a short English label.
const RISKS: [RegExp, string][] = [
  [/[ée]touff|suffoca/i, "choking risk"],
  [/[ée]trangl/i, "strangulation risk"],
  [/blessure|injur/i, "injury risk"],
  [/[ée]lectri|electric/i, "electric shock risk"],
  [/br[uû]lure|burn/i, "burn risk"],
  [/incendie|fire/i, "fire risk"],
  [/chimique|toxique|intoxication|chemical/i, "chemical risk"],
  [/coupure|cuts?\b/i, "cut risk"],
  [/coincement|pi[ée]geage|entrapment/i, "entrapment risk"],
  [/chute|fall/i, "fall risk"],
  [/noyade|drowning/i, "drowning risk"],
];

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function riskLabel(risk: string | null) {
  if (!risk) return null;
  return RISKS.find(([pattern]) => pattern.test(risk))?.[1] ?? null;
}

// "2020-03" or "2020-03-15" -> "March 2020"
export function monthName(date: string) {
  return MONTH.format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));
}

// "2026-10-19" -> "19 Oct 2026"
export function dayName(date: string) {
  return DAY.format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

// "2020-03" -> "03/2020"
export function monthNumber(date: string) {
  return `${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

export function rangePhrase(from: string | null, to: string | null) {
  if (from && to) return `between ${monthName(from)} and ${monthName(to)}`;
  if (from) return `from ${monthName(from)} onwards`;
  if (to) return `up to ${monthName(to)}`;
  return null;
}

// Official product names are stored in lower case; only the display gets a capital.
export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function titleCase(value: string) {
  return value.replace(/(^|[\s-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase());
}

export function eyebrow(verdict: Verdict, risk: string | null) {
  const label = riskLabel(risk);
  if (verdict === "recalled") return label ? `Recalled · ${label}` : "Recalled";
  if (verdict === "check_label") return label ? `Possibly recalled · ${label}` : "Possibly recalled";
  return "No recall found";
}

export function headline(verdict: Verdict, category: string | null) {
  const noun = category?.trim().toLowerCase() || "item";
  if (verdict === "recalled") return `Don't buy this ${noun} as it is.`;
  if (verdict === "check_label") return "Check the label before you buy.";
  return `No recall matches this ${noun}.`;
}

type Summary = {
  brand: string | null;
  productLabel: string;
  publishedAt: string;
  limits: RecallLimits;
  item: { productionDate: string | null; batch: string | null };
};

export function recalledSummary({ brand, productLabel, publishedAt, limits, item }: Summary) {
  const sentences = [`${brand ? `${titleCase(brand)} recalled` : "Recalled:"} the ${productLabel} on ${dayName(publishedAt)}.`];
  const range = rangePhrase(limits.from, limits.to);
  if (range) sentences.push(`Units made ${range} are affected.`);
  if (item.productionDate && range) sentences.push(`This one was made in ${monthName(item.productionDate)}.`);
  if (item.batch && limits.batches.length) sentences.push(`This one is from batch ${item.batch}, which is listed.`);
  return sentences.join(" ");
}

export function checkLabelSummary({ brand, productLabel, publishedAt, limits }: Omit<Summary, "item">) {
  const recalled = `${brand ? `${titleCase(brand)} recalled` : "Recalled:"} the ${productLabel} on ${dayName(publishedAt)}.`;
  const range = limits.batches.length ? null : rangePhrase(limits.from, limits.to);
  if (range) return `${recalled} Only units made ${range} are affected, and the listing doesn't say when this one was made.`;
  return `${recalled} Only some batches are affected, and the listing doesn't give the batch number.`;
}

export function sourcesLabel(sources: readonly string[]) {
  const names = [sources.includes("rappelconso") && "French", sources.includes("safetygate") && "EU"].filter(Boolean);
  return names.length ? names.join(" and ") : "official";
}

export function searchedSummary({ total, sources, searchedFor }: { total: number; sources: string[]; searchedFor: string | null }) {
  const target = searchedFor ? `for ${searchedFor}` : "for this listing";
  return `Tiko searched ${total.toLocaleString("en-GB")} ${sourcesLabel(sources)} recall entries ${target} and found no match. That doesn't prove an item is safe, so still check its condition before buying.`;
}

// What to look for on the label, from the recall's own codes and limits.
export function labelTargets(limits: RecallLimits) {
  const targets: string[] = [];
  if (limits.refs.length) targets.push(`Code ${limits.refs.slice(0, 3).join(" or ")}`);
  if (limits.batches.length) targets.push("batch number");
  else if (limits.from || limits.to) targets.push("production date");
  return targets.join(" · ");
}

// Messages to the seller, in French, following the approved CheckLabel wording.
export function sellerMessage(verdict: Verdict, productLabel: string, limits: RecallLimits, noticeUrl: string) {
  if (verdict === "recalled") {
    return `Bonjour, votre ${productLabel} m'intéresse, mais ce modèle fait l'objet d'un rappel officiel : ${noticeUrl}. Pourriez-vous vérifier ce rappel avant la vente ? Merci !`;
  }
  if (!limits.batches.length && (limits.from || limits.to)) {
    return `Bonjour, votre ${productLabel} m'intéresse. Ce modèle fait l'objet d'un rappel pour certaines dates de fabrication. Pourriez-vous m'envoyer une photo de l'étiquette avec la date de fabrication ? Merci !`;
  }
  return `Bonjour, votre ${productLabel} m'intéresse. Ce modèle fait l'objet d'un rappel pour certains numéros de lot. Pourriez-vous m'envoyer une photo de l'étiquette avec le numéro de lot ? Merci !`;
}

const SOURCE_LABELS: Record<EvidenceSource, string> = {
  listing_text: "listing text",
  listing_photo: "listing photo",
  label_photo: "label photo",
  barcode: "barcode",
  official_data: "official data",
};

export function sourceLabel(source: EvidenceSource) {
  return SOURCE_LABELS[source];
}

const MADE_FROM: Partial<Record<EvidenceSource, string>> = {
  listing_text: "from listing",
  listing_photo: "from photo",
  label_photo: "from label",
};

// "03/2020 · from label"
export function madeLabel(productionDate: string, source: EvidenceSource | undefined) {
  const from = source && MADE_FROM[source];
  return from ? `${monthNumber(productionDate)} · ${from}` : monthNumber(productionDate);
}
