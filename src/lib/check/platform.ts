import type { Recall } from "../../db/schema";
import { risksInEnglish } from "../official-text";
import type { Verdict } from "../verdict";
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
  panel: PanelSummary;
  panelFr: PanelSummary;
  checkUrl: string;
};

// The check as a marketplace's server reads it: the verdict, the recall behind it, and what to do with the listing.
export function platformResponse({ listingId, verdict, recall, panel, panelFr, checkUrl }: PlatformInput): PlatformResponse {
  const flagged = verdict !== "clear" && recall !== null;
  const onLabel = verdict === "check_label" && panel.lookFor.length > 0 ? ` On the label: ${panel.lookFor.join("; ")}.` : "";
  return {
    listing_id: listingId,
    verdict: PLATFORM_VERDICTS[verdict],
    recall: flagged
      ? {
          id: recall.id,
          source: recall.source,
          brand: recall.brand,
          model: recall.models.length > 0 ? recall.models.join(", ") : null,
          risk: recall.risk ? risksInEnglish(recall.risk).join(", ") : null,
          published_at: recall.publishedAt,
          notice_url: recall.url,
        }
      : null,
    reason: `${panel.line}${onLabel}`,
    suggested_action: PLATFORM_ACTIONS[verdict],
    seller_message:
      verdict === "check_label" && panel.sellerMessage && panelFr.sellerMessage
        ? { fr: panelFr.sellerMessage, en: panel.sellerMessage }
        : null,
    check_url: checkUrl,
  };
}
