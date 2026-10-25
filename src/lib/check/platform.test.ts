import { describe, expect, it } from "vitest";
import type { Recall } from "../../db/schema";
import type { PanelSummary } from "./panel";
import { displayModel, PLATFORM_ACTIONS, platformResponse } from "./platform";

const hamax = {
  id: "rc:23843",
  source: "rappelconso",
  url: "https://rappel.conso.gouv.fr/fiche-rappel/23843/interne",
  publishedAt: "2026-10-19",
  brand: "hamax",
  productName: "porte-bébé hamax buddy",
  models: ["buddy"],
  reason: "risque d'étouffement",
  risk: "étouffement",
} as unknown as Recall;

const panel: PanelSummary = {
  title: "Hamax Buddy child bike seat",
  line: "Only some units of this model are recalled.",
  risk: "Risk: choking",
  source: { label: "RappelConso · 19 Oct 2026", url: hamax.url },
  lookFor: ["Recalled if made between 01/2022 and 08/2026"],
  whatToDo: [],
  sellerMessage: "Hello, could you send a photo of the label?",
};
const panelFr: PanelSummary = { ...panel, sellerMessage: "Bonjour, pourriez-vous envoyer une photo de l'étiquette ?" };

const base = {
  listingId: "ad-42",
  recall: hamax,
  extracted: { model: "Buddy", modelVariant: null, productionDate: null, batch: null },
  limits: { from: "2022-01-01", to: "2026-08-06", batches: [], refs: [], model: null },
  reasonEn: "A label can come loose and a child could choke on it.",
  panel,
  panelFr,
  checkUrl: "https://vetted.example/check/1",
};

describe("platformResponse", () => {
  it("maps each verdict to one action", () => {
    expect(PLATFORM_ACTIONS).toEqual({ recalled: "hold_listing", check_label: "ask_seller_for_label", clear: "publish" });
    expect(platformResponse({ ...base, verdict: "recalled" }).suggested_action).toBe("hold_listing");
    expect(platformResponse({ ...base, verdict: "clear" }).suggested_action).toBe("publish");
  });

  it("check_label: the recall, the label to check and the seller message in both languages", () => {
    expect(platformResponse({ ...base, verdict: "check_label" })).toEqual({
      listing_id: "ad-42",
      verdict: "check_label",
      recall: {
        id: "rc:23843",
        source: "rappelconso",
        brand: "Hamax",
        model: "Buddy",
        risk: "choking",
        published_at: "2026-10-19",
        notice_url: "https://rappel.conso.gouv.fr/fiche-rappel/23843/interne",
      },
      reason:
        "Hamax recalled the Buddy because a label can come loose and a child could choke on it. Only units made between January 2022 and August 2026 are affected, and the listing doesn't say when this one was made.",
      suggested_action: "ask_seller_for_label",
      seller_message: { fr: panelFr.sellerMessage, en: panel.sellerMessage },
      check_url: "https://vetted.example/check/1",
    });
  });

  it("recalled: the official reason and which units, and no seller message", () => {
    const acer = {
      ...hamax,
      id: "rc:21110",
      brand: "acer",
      productName: "trottinette électrique acer es series 5 (aes015)",
      models: ["trottinette électrique es series 5 (aes015)"],
    } as unknown as Recall;
    const response = platformResponse({
      ...base,
      verdict: "recalled",
      recall: acer,
      extracted: { ...base.extracted, model: "ES Series 5" },
      limits: { from: null, to: null, batches: [], refs: [], model: null },
      reasonEn: "A screw may not have been tightened enough during production and could come loose during normal use.",
    });
    expect(response).toMatchObject({
      verdict: "recalled",
      recall: { id: "rc:21110", brand: "Acer", model: "ES Series 5 (AES015)" },
      reason:
        "Acer recalled the ES Series 5 (AES015) because a screw may not have been tightened enough during production and could come loose during normal use. Every unit is affected.",
      seller_message: null,
    });
  });

  it("names the recall's model in the listing's casing, else title case", () => {
    expect(displayModel({ productName: "porte-bébé hamax buddy", brand: "hamax", models: ["buddy"] }, null)).toBe("Buddy");
    expect(displayModel({ productName: "hoverboard tilboard", brand: "tilgreen", models: ["tilboard"] }, "TilBoard")).toBe("TilBoard");
    expect(displayModel({ productName: "Machine de karaoké", brand: "Fede", models: [] }, "K36")).toBeNull();
  });

  it("no_recall_found: never reports the closest recall as the recall", () => {
    const response = platformResponse({ ...base, verdict: "clear", listingId: null });
    expect(response).toMatchObject({ listing_id: null, verdict: "no_recall_found", recall: null, seller_message: null });
  });
});
