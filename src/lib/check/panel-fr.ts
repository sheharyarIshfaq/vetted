import type { Recall } from "../../db/schema";
import { PART_OF_MODEL, recallLimits } from "../verdict";
import { capitalize, itemName, monthNumber, sellerMessage } from "./copy";
import { MAX_CODES, SOURCE_NAMES, type PanelInput, type PanelSummary } from "./panel";

// The extension panel in French, the default on Leboncoin and Vinted. Remedies, batches and the risk are the
// notice's own French words; the reasons behind a near miss are only written in English, so they get a short line.

const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function madePhrase(from: string | null, to: string | null) {
  if (from && to) return `Rappelé si fabriqué entre ${monthNumber(from)} et ${monthNumber(to)}`;
  if (from) return `Rappelé si fabriqué en ${monthNumber(from)} ou après`;
  if (to) return `Rappelé si fabriqué en ${monthNumber(to)} ou avant`;
  return null;
}

function codesPhrase(label: string, codes: readonly string[]) {
  if (codes.length === 0) return null;
  const more = codes.length - MAX_CODES;
  return `${label} ${codes.slice(0, MAX_CODES).join(" / ")}${more > 0 ? ` et ${more} autres` : ""}`;
}

function labelPlace(recall: Recall) {
  const identification = (recall.raw as { identification_produits?: unknown } | null)?.identification_produits;
  const texts = Array.isArray(identification) ? identification.filter((text): text is string => typeof text === "string") : [];
  const place = texts.map((text) => /\((visibles? [^)]+)\)/i.exec(text)?.[1]).find(Boolean);
  return place ? `La fiche indique que le numéro est « ${place} »` : null;
}

function sourcesPhrase(sources: readonly string[]) {
  const names = [sources.includes("rappelconso") && "français", sources.includes("safetygate") && "européens"].filter(Boolean);
  return names.length ? names.join(" et ") : "officiels";
}

function sourceOf(recall: Recall) {
  return { label: `${SOURCE_NAMES[recall.source] ?? recall.source} · ${DAY.format(new Date(`${recall.publishedAt.slice(0, 10)}T00:00:00Z`))}`, url: recall.url };
}

export function panelSummaryFr(input: PanelInput): PanelSummary {
  const { verdict, recall, extracted, listingTitle, searched } = input;
  const name = itemName(extracted);
  const title = name ?? (recall ? capitalize(recall.productName) : listingTitle);

  if (verdict === "clear" || !recall) {
    const close = recall && input.evidence?.some((item) => !item.matched && item.fact.startsWith("Not this recall: "));
    const part = input.evidence?.some((item) => item.fact.startsWith(PART_OF_MODEL));
    const searchedLine = `Vetted a cherché ${name ? `« ${name} »` : "cette annonce"} parmi ${searched.total.toLocaleString("fr-FR")} rappels ${sourcesPhrase(searched.sources)} sans trouver de correspondance. Cela ne prouve pas que le produit est sûr.`;
    return {
      title,
      line: recall && close
        ? `Un rappel pour « ${capitalize(recall.productName)} » est proche, ${part ? "mais il concerne un autre élément du même modèle : s'il est fourni avec l'annonce, vérifiez son étiquette." : "mais il ne correspond pas à cette annonce."}`
        : searchedLine,
      risk: null,
      source: recall && close ? sourceOf(recall) : null,
      lookFor: [],
      whatToDo: [],
      sellerMessage: null,
    };
  }

  const limits = recallLimits({ ...extracted, title: listingTitle }, recall);
  const refs = limits.refs.filter((ref) => !recall.gtins.includes(ref));
  return {
    title,
    line:
      verdict === "recalled"
        ? "Cet article correspond aux unités rappelées."
        : "Seules certaines unités de ce modèle sont rappelées.",
    risk: recall.risk && recall.risk.length <= 60 ? `Risque : ${recall.risk.toLowerCase()}` : null,
    source: sourceOf(recall),
    lookFor: [
      madePhrase(limits.from, limits.to),
      codesPhrase("Lots :", limits.batches),
      codesPhrase("Codes", refs),
      refs.length === 0 ? codesPhrase("Codes-barres", recall.gtins) : null,
      labelPlace(recall),
    ].filter((line): line is string => line !== null),
    whatToDo: verdict === "recalled" ? (recall.whatToDo ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map(capitalize) : [],
    sellerMessage: verdict === "check_label" ? sellerMessage("check_label", name ?? listingTitle, limits, recall.url) : null,
  };
}
