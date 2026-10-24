import { describe, expect, it } from "vitest";
import type { RecallLimits } from "../verdict";
import {
  capitalize,
  checkLabelSummary,
  dayName,
  eyebrow,
  headline,
  labelTargets,
  listsPhrase,
  madeLabel,
  numericDate,
  rangePhrase,
  recalledSummary,
  regionsPhrase,
  riskLabel,
  riskWord,
  searchedSummary,
  sellerMessage,
  shortDay,
  sourceSplitPhrase,
  titleCase,
} from "./copy";

const smileIII: RecallLimits = { from: "2019-09-01", to: "2020-05-31", batches: [], refs: [], model: "smile iii" };
const buddy: RecallLimits = { from: "2022-01-01", to: null, batches: [], refs: ["4091054", "8591602"], model: null };
const batchesOnly: RecallLimits = { from: null, to: null, batches: ["L2024-118"], refs: [], model: null };

describe("labels", () => {
  it("maps French risks to short English labels", () => {
    expect(riskLabel("blessures")).toBe("injury risk");
    expect(riskLabel("étouffement")).toBe("choking risk");
    expect(riskLabel("risque inconnu")).toBeNull();
    expect(eyebrow("recalled", "blessures")).toBe("Recalled · injury risk");
    expect(eyebrow("check_label", "étouffement")).toBe("Possibly recalled · choking risk");
    expect(eyebrow("check_label", null)).toBe("Possibly recalled");
  });

  it("writes headlines from the category", () => {
    expect(headline("recalled", "Stroller")).toBe("Don't buy this stroller as it is.");
    expect(headline("clear", null)).toBe("No recall matches this item.");
  });

  it("formats dates and ranges", () => {
    expect(dayName("2026-10-19")).toBe("19 Oct 2026");
    expect(shortDay("2026-10-19")).toBe("19 Oct");
    expect(riskWord("étouffement")).toBe("choking");
    expect(riskWord(null)).toBeNull();
    expect(rangePhrase("2019-09-01", "2020-05-31")).toBe("between September 2019 and May 2020");
    expect(rangePhrase("2022-01-01", null)).toBe("from January 2022 onwards");
    expect(rangePhrase(null, "2020-05-31")).toBe("up to May 2020");
    expect(madeLabel("2020-03", "label_photo")).toBe("03/2020 · from label");
    expect(titleCase("britax römer")).toBe("Britax Römer");
    expect(capitalize("châssis de poussette smile iii")).toBe("Châssis de poussette smile iii");
    expect(capitalize("")).toBe("");
  });
});

describe("source phrases", () => {
  it("names only the lists that are loaded", () => {
    expect(regionsPhrase(["rappelconso"])).toBe(" of France");
    expect(regionsPhrase(["rappelconso", "safetygate"])).toBe(" of France and the EU");
    expect(regionsPhrase([])).toBe("");
    expect(listsPhrase(["rappelconso"])).toBe("RappelConso for France");
    expect(listsPhrase(["safetygate", "rappelconso"])).toBe("RappelConso for France and EU Safety Gate");
    expect(listsPhrase([])).toBe("Official recall lists");
  });
});

describe("summaries", () => {
  it("summarises a recalled item from the official data", () => {
    expect(
      recalledSummary({
        brand: "britax römer",
        productLabel: "Smile III",
        publishedAt: "2026-06-23",
        limits: smileIII,
        item: { productionDate: "2020-03", batch: null },
      }),
    ).toBe(
      "Britax Römer recalled the Smile III on 23 Jun 2026. Units made between September 2019 and May 2020 are affected. This one was made in March 2020.",
    );
  });

  it("explains what is missing for check the label", () => {
    expect(checkLabelSummary({ brand: "hamax", productLabel: "Buddy", publishedAt: "2026-10-19", limits: buddy })).toBe(
      "Hamax recalled the Buddy on 19 Oct 2026. Only units made from January 2022 onwards are affected, and the listing doesn't say when this one was made.",
    );
    expect(checkLabelSummary({ brand: "vtech", productLabel: "hochet", publishedAt: "2026-01-02", limits: batchesOnly })).toContain(
      "Only some batches are affected",
    );
  });

  it("says exactly what was searched for a clear result", () => {
    expect(searchedSummary({ total: 2935, sources: ["rappelconso"], searchedFor: "Ikea Antilop" })).toBe(
      "Tiko searched 2,935 French recall entries for Ikea Antilop and found no match. That doesn't prove an item is safe, so still check its condition before buying.",
    );
    expect(searchedSummary({ total: 3200, sources: ["rappelconso", "safetygate"], searchedFor: null })).toContain(
      "French and EU recall entries for this listing",
    );
  });
});

describe("label targets and seller messages", () => {
  it("lists what to look for on the label", () => {
    expect(labelTargets(buddy)).toBe("Code 4091054 or 8591602 · production date");
    expect(labelTargets(batchesOnly)).toBe("batch number");
  });

  it("uses the approved French wording", () => {
    expect(sellerMessage("check_label", "Hamax Buddy", buddy, "https://x")).toBe(
      "Bonjour, votre Hamax Buddy m'intéresse. Ce modèle fait l'objet d'un rappel pour certaines dates de fabrication. Pourriez-vous m'envoyer une photo de l'étiquette avec la date de fabrication ? Merci !",
    );
    expect(sellerMessage("check_label", "hochet", batchesOnly, "https://x")).toContain("numéro de lot");
    expect(sellerMessage("recalled", "Smile III", smileIII, "https://rappel.conso.gouv.fr/fiche-rappel/22625/interne")).toContain(
      "https://rappel.conso.gouv.fr/fiche-rappel/22625/interne",
    );
  });
});

describe("batch and date limits together", () => {
  const both: RecallLimits = { from: "2017-01-01", to: "2017-12-31", batches: ["oc15"], refs: [], model: null };

  it("asks for the batch, since the batch decides", () => {
    expect(labelTargets(both)).toBe("batch number");
    expect(checkLabelSummary({ brand: "oli&carol", productLabel: "Cathy", publishedAt: "2017-10-19", limits: both })).toContain(
      "Only some batches are affected",
    );
    expect(sellerMessage("check_label", "Cathy", both, "https://x")).toContain("numéro de lot");
  });
});

describe("sourceSplitPhrase", () => {
  it("names only the loaded sources", () => {
    expect(sourceSplitPhrase({ rappelconso: 2935, safetygate: 11498 })).toBe("2,935 from France and 11,498 from the EU");
    expect(sourceSplitPhrase({ rappelconso: 2935 })).toBe("2,935 from France");
    expect(sourceSplitPhrase({})).toBe("");
  });
});

describe("numericDate", () => {
  it("formats an ISO date the French way", () => {
    expect(numericDate("2026-06-23")).toBe("23/06/2026");
  });
});

describe("titleCase", () => {
  it("writes Roman numerals in capitals", () => {
    expect(titleCase("smile iii")).toBe("Smile III");
    expect(titleCase("britax römer")).toBe("Britax Römer");
    expect(titleCase("vivid ivory")).toBe("Vivid Ivory");
  });
});

describe("label-only checks", () => {
  it("asks the owner for their label instead of blaming the listing", () => {
    expect(checkLabelSummary({ brand: "hamax", productLabel: "Buddy", publishedAt: "2026-10-19", limits: buddy, fromRecall: true })).toBe(
      "Hamax recalled the Buddy on 19 Oct 2026. Only units made from January 2022 onwards are affected. A photo of your item's label shows whether yours is one of them.",
    );
  });

  it("looks for a barcode or code when nothing else limits the recall", () => {
    expect(labelTargets({ from: null, to: null, batches: [], refs: [], model: null })).toBe("Barcode or reference code");
  });
});
