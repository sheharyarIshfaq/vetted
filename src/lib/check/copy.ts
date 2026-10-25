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
const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function riskLabel(risk: string | null) {
  if (!risk) return null;
  return RISKS.find(([pattern]) => pattern.test(risk))?.[1] ?? null;
}

// "choking risk" -> "choking", for compact card meta.
export function riskWord(risk: string | null) {
  return riskLabel(risk)?.replace(/ risk$/, "") ?? null;
}

// "2020-03" or "2020-03-15" -> "March 2020"
export function monthName(date: string) {
  return MONTH.format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));
}

// "2026-10-19" -> "19 Oct 2026"
export function dayName(date: string) {
  return DAY.format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

// "2026-10-19" -> "19 Oct"
// "2026-06-23" -> "23/06/2026"
export function numericDate(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function shortDay(date: string) {
  return SHORT_DAY.format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
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

// "smile iii" -> "Smile III": first letters upper case, Roman numerals in full.
// Codes mixing letters and digits ("aes015", "xt800") are written in capitals.
export function titleCase(value: string) {
  return value
    .replace(/(^|[\s-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase())
    .replace(/\b(?:Ii|Iii|Iv|Vi|Vii|Viii|Ix)\b/g, (numeral) => numeral.toUpperCase())
    .replace(/\b(?=[a-z]*\d)(?=\d*[a-z])[a-z\d]+\b/gi, (code) => code.toUpperCase());
}

// A name as the seller cased it, unless it is all lower or all upper case: "acer ES Series 5" -> "Acer ES Series 5".
export function nameCase(value: string) {
  if (value === value.toLowerCase() || value === value.toUpperCase()) return titleCase(value.toLowerCase());
  return value.replace(/(^|\s)(\p{Ll})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase());
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

// From a listing, the label is what's missing; from a recall page, the owner's label decides.
export function checkLabelSummary({
  brand,
  productLabel,
  publishedAt,
  limits,
  fromRecall = false,
}: Omit<Summary, "item"> & { fromRecall?: boolean }) {
  const recalled = `${brand ? `${titleCase(brand)} recalled` : "Recalled:"} the ${productLabel} on ${dayName(publishedAt)}.`;
  const range = limits.batches.length ? null : rangePhrase(limits.from, limits.to);
  if (fromRecall) {
    const which = range ? `Only units made ${range} are affected.` : limits.batches.length ? "Only some batches are affected." : null;
    return [recalled, which, "A photo of your item's label shows whether yours is one of them."].filter(Boolean).join(" ");
  }
  if (range) return `${recalled} Only units made ${range} are affected, and the listing doesn't say when this one was made.`;
  return `${recalled} Only some batches are affected, and the listing doesn't give the batch number.`;
}

type Source = "rappelconso" | "safetygate";

// "HAMAX BUDDY" or "hamax buddy" -> "Hamax Buddy": the brand and model as read, cased for display.
export function itemName(item: { brand: string | null; model: string | null; modelVariant: string | null }) {
  const name = [item.brand, item.model, item.modelVariant].filter(Boolean).join(" ").trim();
  return name ? nameCase(name) : null;
}

// "RappelConso for France and EU Safety Gate", naming only the lists that are loaded.
export function listsPhrase(sources: readonly Source[]) {
  const lists = [sources.includes("rappelconso") && "RappelConso for France", sources.includes("safetygate") && "EU Safety Gate"].filter(Boolean);
  return lists.length ? lists.join(" and ") : "Official recall lists";
}

export function sourcesLabel(sources: readonly string[]) {
  const names = [sources.includes("rappelconso") && "French", sources.includes("safetygate") && "EU"].filter(Boolean);
  return names.length ? names.join(" and ") : "official";
}

export function searchedSummary({ total, sources, searchedFor }: { total: number; sources: string[]; searchedFor: string | null }) {
  const target = searchedFor ? `for ${searchedFor}` : "for this listing";
  return `Vetted searched ${total.toLocaleString("en-GB")} ${sourcesLabel(sources)} recall entries ${target} and found no match. That doesn't prove an item is safe, so still check its condition before buying.`;
}

// What to look for on the label, from the recall's own codes and limits.
export function labelTargets(limits: RecallLimits) {
  const targets: string[] = [];
  if (limits.refs.length) targets.push(`Code ${limits.refs.slice(0, 3).join(" or ")}`);
  if (limits.batches.length) targets.push("batch number");
  else if (limits.from || limits.to) targets.push("production date");
  return targets.join(" · ") || "Barcode or reference code";
}

// Messages to the seller, in French, following the approved CheckLabel wording.
// When the open question is which model it is, the label has to show the model, not a date or batch.
export function sellerMessage(verdict: Verdict, productLabel: string, limits: RecallLimits, noticeUrl: string, whichModel = false) {
  if (verdict === "recalled") {
    return `Bonjour, votre ${productLabel} m'intéresse, mais ce modèle fait l'objet d'un rappel officiel : ${noticeUrl}. Pourriez-vous vérifier ce rappel avant la vente ? Merci !`;
  }
  if (whichModel) {
    return `Bonjour, votre ${productLabel} m'intéresse. Un modèle de cette marque fait l'objet d'un rappel officiel. Pourriez-vous m'envoyer une photo de l'étiquette où l'on voit le modèle exact ? Merci !`;
  }
  if (!limits.batches.length && (limits.from || limits.to)) {
    return `Bonjour, votre ${productLabel} m'intéresse. Ce modèle fait l'objet d'un rappel pour certaines dates de fabrication. Pourriez-vous m'envoyer une photo de l'étiquette avec la date de fabrication ? Merci !`;
  }
  return `Bonjour, votre ${productLabel} m'intéresse. Ce modèle fait l'objet d'un rappel pour certains numéros de lot. Pourriez-vous m'envoyer une photo de l'étiquette avec le numéro de lot ? Merci !`;
}

// The same request in English, for buyers who read the panel in English.
export function sellerMessageEnglish(verdict: Verdict, productLabel: string, limits: RecallLimits, noticeUrl: string, whichModel = false) {
  if (verdict === "recalled") {
    return `Hello, I'm interested in your ${productLabel}, but this model has an official recall: ${noticeUrl}. Could you check it before selling? Thanks!`;
  }
  if (whichModel) {
    return `Hello, I'm interested in your ${productLabel}. A model from this brand has an official recall. Could you send me a photo of the label showing the exact model? Thanks!`;
  }
  if (!limits.batches.length && (limits.from || limits.to)) {
    return `Hello, I'm interested in your ${productLabel}. Some production dates of this model are recalled. Could you send me a photo of the label showing the production date? Thanks!`;
  }
  return `Hello, I'm interested in your ${productLabel}. Some batches of this model are recalled. Could you send me a photo of the label showing the batch number? Thanks!`;
}

const SOURCE_LABELS: Record<EvidenceSource, string> = {
  listing_text: "listing text",
  listing_photo: "listing photo",
  label_photo: "label photo",
  barcode: "barcode",
  official_data: "official data",
};

// A check started from a recall page has no listing: its brand and model are the recall the owner picked.
export function sourceLabel(source: EvidenceSource, fromRecall = false) {
  return fromRecall && source === "listing_text" ? "recall you picked" : SOURCE_LABELS[source];
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
