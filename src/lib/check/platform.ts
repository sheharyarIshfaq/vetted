import type { Recall } from "../../db/schema";
import { risksInEnglish } from "../official-text";
import type { RecallLimits, Verdict } from "../verdict";
import { capitalize, monthName, rangePhrase, titleCase } from "./copy";
import type { ExtractedItem } from "./extract";
import type { PanelSummary } from "./panel";

export const PLATFORM_VERDICTS = { recalled: "recalled", check_label: "check_label", clear: "no_recall_found" } as const;

export const PLATFORM_ACTIONS = {
  recalled: "hold_listing",
  check_label: "ask_seller_for_label",
  clear: "publish",
} as const;

export type PlatformResponse = {
  listing_id: string | null;
  verdict: (typeof PLATFORM_VERDICTS)[Verdict];
  recall: {
    id: string;
    source: string;
    brand: string | null;
    model: string | null;
    risk: string | null;
    published_at: string;
    notice_url: string;
  } | null;
  reason: string;
  suggested_action: (typeof PLATFORM_ACTIONS)[Verdict];
  seller_message: { fr: string; en: string } | null;
  check_url: string;
};

type PlatformInput = {
  listingId: string | null;
  verdict: Verdict;
  recall: Recall | null; // on a clear verdict, the closest recall, which is not reported
  extracted: Pick<ExtractedItem, "model" | "modelVariant" | "productionDate" | "batch">;
  limits: RecallLimits | null;
  reasonEn: string | null; // the official reason in English, when it could be translated
  panel: PanelSummary;
  panelFr: PanelSummary;
  checkUrl: string;
};

// The recall's model as the check page names it: what follows the brand in the official product name,
// in the listing's own casing where the listing wrote the same word ("es series 5 (aes015)" -> "ES Series 5 (AES015)").
export function displayModel(recall: Pick<Recall, "productName" | "brand" | "models">, listingModel: string | null) {
  const name = recall.productName.trim();
  const brand = recall.brand?.trim().toLowerCase();
  const at = brand ? ` ${name.toLowerCase()} `.indexOf(` ${brand} `) : -1;
  const model = at >= 0 ? name.slice(at + brand!.length).trim() : recall.models.join(", ");
  if (!model) return null;
  const seller = new Map((listingModel ?? "").split(/\s+/).filter(Boolean).map((word) => [word.toLowerCase(), word]));
  return model
    .split(/\s+/)
    .map((word) => seller.get(word.toLowerCase()) ?? titleCase(word))
    .join(" ");
}

function lowerFirst(value: string) {
  // "A screw" -> "a screw", but "LED strip" and "USB-C" keep their capitals.
  return /^[A-Z](?![A-Z\d])/.test(value) ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

// Which units the recall covers, and what the listing says about this one, as the check page puts it.
function scope(verdict: Verdict, limits: RecallLimits | null, item: PlatformInput["extracted"]) {
  const range = limits ? rangePhrase(limits.from, limits.to) : null;
  const batches = limits?.batches.length ?? 0;
  if (verdict === "check_label") {
    if (range) return `Only units made ${range} are affected, and the listing doesn't say when this one was made.`;
    if (batches) return "Only some batches are affected, and the listing doesn't give the batch number.";
    return null;
  }
  const sentences = [];
  if (range) sentences.push(`Units made ${range} are affected.`);
  if (range && item.productionDate) sentences.push(`This one was made in ${monthName(item.productionDate)}.`);
  if (batches && item.batch) sentences.push(`This one is from batch ${item.batch}, which is listed.`);
  return sentences.length ? sentences.join(" ") : "Every unit is affected.";
}

// "Acer recalled the ES Series 5 because a screw … Every unit is affected.": only the recall's own data.
function flaggedReason(input: PlatformInput & { recall: Recall }, model: string | null) {
  const { verdict, recall, reasonEn, limits, extracted, panel } = input;
  const product = model ?? capitalize(recall.productName);
  const who = recall.brand ? `${titleCase(recall.brand)} recalled the ${product}` : `The ${product} is recalled`;
  const why = reasonEn ? ` because ${lowerFirst(reasonEn.trim()).replace(/\.$/, "")}` : "";
  return `${who}${why}. ${scope(verdict, limits, extracted) ?? panel.line}`;
}

// The check as a marketplace's server reads it: the verdict, the recall behind it, and what to do with the listing.
export function platformResponse(input: PlatformInput): PlatformResponse {
  const { listingId, verdict, recall, extracted, panel, panelFr, checkUrl } = input;
  const flagged = verdict !== "clear" && recall !== null;
  const model = recall ? displayModel(recall, [extracted.model, extracted.modelVariant].filter(Boolean).join(" ")) : null;
  return {
    listing_id: listingId,
    verdict: PLATFORM_VERDICTS[verdict],
    recall: flagged
      ? {
          id: recall.id,
          source: recall.source,
          brand: recall.brand ? titleCase(recall.brand) : null,
          model,
          risk: recall.risk ? risksInEnglish(recall.risk).join(", ") : null,
          published_at: recall.publishedAt,
          notice_url: recall.url,
        }
      : null,
    reason: flagged ? flaggedReason({ ...input, recall }, model) : panel.line,
    suggested_action: PLATFORM_ACTIONS[verdict],
    seller_message:
      verdict === "check_label" && panel.sellerMessage && panelFr.sellerMessage
        ? { fr: panelFr.sellerMessage, en: panel.sellerMessage }
        : null,
    check_url: checkUrl,
  };
}
