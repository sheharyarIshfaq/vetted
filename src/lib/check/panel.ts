import type { Recall } from "../../db/schema";
import { modelInDoubt, PART_OF_MODEL, recallLimits, type Evidence, type Verdict } from "../verdict";
import { capitalize, dayName, itemName, monthNumber, riskWord, sellerMessageEnglish, sourcesLabel } from "./copy";
import { batchInEnglish, remedyInEnglish } from "../official-text";
import type { ExtractedItem } from "./extract";

export const SOURCE_NAMES: Record<string, string> = { rappelconso: "RappelConso", safetygate: "EU Safety Gate" };
export const MAX_CODES = 3;

export type PanelSummary = {
  title: string;
  line: string;
  risk: string | null;
  source: { label: string; url: string } | null;
  lookFor: string[];
  whatToDo: string[];
  sellerMessage: string | null;
};

export type PanelInput = {
  verdict: Verdict;
  recall: Recall | null; // the recall behind the verdict, or the closest one on a clear verdict
  evidence?: Evidence[];
  extracted: ExtractedItem;
  listingTitle: string;
  searched: { total: number; sources: string[] };
};

// "Hamax Buddy child bike seat": the brand and model as read, in title case, then the product type.
export function productTitle(extracted: ExtractedItem, recall: Recall | null, listingTitle: string) {
  const name = itemName(extracted);
  if (name) return [name, extracted.category?.trim().toLowerCase()].filter(Boolean).join(" ");
  return recall ? capitalize(recall.productName) : listingTitle;
}

function madePhrase(from: string | null, to: string | null) {
  if (from && to) return `Recalled if made between ${monthNumber(from)} and ${monthNumber(to)}`;
  if (from) return `Recalled if made in ${monthNumber(from)} or later`;
  if (to) return `Recalled if made in ${monthNumber(to)} or earlier`;
  return null;
}

function codesPhrase(label: string, codes: readonly string[]) {
  if (codes.length === 0) return null;
  const more = codes.length - MAX_CODES;
  return `${label} ${codes.slice(0, MAX_CODES).join(" / ")}${more > 0 ? ` and ${more} more` : ""}`;
}

// Where the notice says the number is, quoted as published: RappelConso writes "(visible sur …)" next to it.
export function labelPlace(recall: Recall) {
  const identification = (recall.raw as { identification_produits?: unknown } | null)?.identification_produits;
  const texts = Array.isArray(identification) ? identification.filter((text): text is string => typeof text === "string") : [];
  const place = texts.map((text) => /\((visibles? [^)]+)\)/i.exec(text)?.[1]).find(Boolean);
  return place ? `The notice says the number is "${place}"` : null;
}

// What to check on the item, only from the recall's own data.
function lookFor(input: PanelInput, recall: Recall) {
  const limits = recallLimits({ ...input.extracted, title: input.listingTitle }, recall);
  const refs = limits.refs.filter((ref) => !recall.gtins.includes(ref));
  return [
    madePhrase(limits.from, limits.to),
    codesPhrase("Batches:", limits.batches.map(batchInEnglish)),
    codesPhrase("Codes", refs),
    refs.length === 0 ? codesPhrase("Barcodes", recall.gtins) : null,
    labelPlace(recall),
  ].filter((line): line is string => line !== null);
}

function sourceOf(recall: Recall) {
  return { label: `${SOURCE_NAMES[recall.source] ?? recall.source} · ${dayName(recall.publishedAt)}`, url: recall.url };
}

export function panelSummary(input: PanelInput): PanelSummary {
  const { verdict, recall, extracted, listingTitle, searched } = input;
  const title = productTitle(extracted, recall, listingTitle);

  if (verdict === "clear" || !recall) {
    const category = extracted.category?.trim().toLowerCase();
    const target = itemName(extracted) ?? (category ? `this ${category}` : "this listing");
    const searchedLine = `Vetted searched ${searched.total.toLocaleString("en-GB")} ${sourcesLabel(searched.sources)} recalls for ${target} and found no match. That doesn't prove it's safe.`;
    const why = input.evidence?.find((item) => !item.matched && item.fact.startsWith("Not this recall: "));
    const part = input.evidence?.find((item) => item.fact.startsWith(PART_OF_MODEL));
    const close = part ? part.fact : why ? capitalize(why.fact.slice("Not this recall: ".length)) : null;
    return {
      title,
      line: recall && close ? `A recall for ${capitalize(recall.productName)} came close. ${close}.` : searchedLine,
      risk: null,
      source: recall && why ? sourceOf(recall) : null,
      lookFor: [],
      whatToDo: [],
      sellerMessage: null,
    };
  }

  const risk = riskWord(recall.risk);
  return {
    title,
    line:
      verdict === "recalled"
        ? "This item matches the recalled units."
        : "Only some units of this model are recalled.",
    risk: risk ? `Risk: ${risk}` : null,
    source: sourceOf(recall),
    lookFor: lookFor(input, recall),
    whatToDo: verdict === "recalled" ? (recall.whatToDo ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map(remedyInEnglish).map(capitalize) : [],
    sellerMessage:
      verdict === "check_label"
        ? sellerMessageEnglish("check_label", itemName(extracted) ?? listingTitle, recallLimits({ ...extracted, title: listingTitle }, recall), recall.url, modelInDoubt(input.evidence ?? []))
        : null,
  };
}
