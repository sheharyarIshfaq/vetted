import { describe, expect, it } from "vitest";
import type { Recall } from "../../db/schema";
import type { PanelSummary } from "./panel";
import { PLATFORM_ACTIONS, platformResponse } from "./platform";

const hamax = {
  id: "rc:23843",
  source: "rappelconso",
  url: "https://rappel.conso.gouv.fr/fiche-rappel/23843/interne",
  publishedAt: "2026-10-19",
  brand: "Hamax",
  models: ["buddy"],
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

const base = { listingId: "ad-42", recall: hamax, panel, panelFr, checkUrl: "https://vetted.example/check/1" };

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
        model: "buddy",
        risk: "choking",
        published_at: "2026-10-19",
        notice_url: "https://rappel.conso.gouv.fr/fiche-rappel/23843/interne",
      },
      reason: "Only some units of this model are recalled. On the label: Recalled if made between 01/2022 and 08/2026.",
      suggested_action: "ask_seller_for_label",
      seller_message: { fr: panelFr.sellerMessage, en: panel.sellerMessage },
      check_url: "https://vetted.example/check/1",
    });
  });

  it("recalled: no seller message", () => {
    const response = platformResponse({ ...base, verdict: "recalled", panel: { ...panel, line: "This item matches the recalled units." } });
    expect(response).toMatchObject({ verdict: "recalled", reason: "This item matches the recalled units.", seller_message: null });
    expect(response.recall?.id).toBe("rc:23843");
  });

  it("no_recall_found: never reports the closest recall as the recall", () => {
    const response = platformResponse({ ...base, verdict: "clear", listingId: null });
    expect(response).toMatchObject({ listing_id: null, verdict: "no_recall_found", recall: null, seller_message: null });
  });
});
