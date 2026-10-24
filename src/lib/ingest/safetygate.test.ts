import { describe, expect, it } from "vitest";
import { barcodesIn, datesText, isConsumerProduct, isInScope, latestByCase, parseReport, splitValues, toRecall } from "./safetygate";

const report = { id: "10000328", reference: "Report-2026-42", year: 2026, publishedAt: "2026-10-23" };

function alertXml(fields: Record<string, string>) {
  const defaults: Record<string, string> = {
    caseNumber: "SR/02933/26",
    reference: "https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/10118690",
    category: "Jouets",
    product: "Ensemble de jouets",
    brand: "",
    name: "12pcs Ensemble de jeu d'archerie",
    type_numberOfModel: "816937989081, LH02, cn1082977006febae",
    batchNumber: "C202432256412",
    barcode: "21828069545",
    riskType: "Étouffement",
    danger: "Le jouet comprend de petites pièces.",
    measures: "",
    description: "Ensemble de jouets Bow.",
    notifyingCountry: "France",
    type: "Consommateur",
    level: "Risque grave",
    companyRecallCode: "",
    productionDates: "",
  };
  const body = Object.entries({ ...defaults, ...fields })
    .map(([tag, value]) => `<${tag}><![CDATA[${value}]]></${tag}>`)
    .join("");
  return `<notifications xsi:type="x">${body}<pictures><picture><![CDATA[https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/11239085]]></picture><picture><![CDATA[https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/11239086]]></picture></pictures></notifications>`;
}

function parse(...alerts: string[]) {
  return parseReport(`<?xml version="1.0"?><Safety-Gate><report_language>fr</report_language>${alerts.join("")}</Safety-Gate>`, report);
}

describe("parseReport", () => {
  it("reads every field as text, keeping leading zeros and pictures", () => {
    const { alerts, invalid } = parse(alertXml({ barcode: "0012345678905" }), alertXml({ caseNumber: "SR/1/26" }));
    expect(invalid).toBe(0);
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toMatchObject({ caseNumber: "SR/02933/26", barcode: "0012345678905", publishedAt: "2026-10-23" });
    expect(alerts[0].pictures).toHaveLength(2);
  });

  it("counts alerts without a case number as invalid", () => {
    expect(parse(alertXml({ caseNumber: "" })).invalid).toBe(1);
  });
});

describe("scope", () => {
  const alert = (fields: Record<string, string>) => parse(alertXml(fields)).alerts[0];

  it("keeps resold categories and drops the skipped ones", () => {
    expect(isInScope(alert({ category: "Jouets" }))).toBe(true);
    expect(isInScope(alert({ category: "Pointeurs laser" }))).toBe(true);
    for (const category of ["Produits cosmétiques", "Substances chimiques", "Articles pyrotechniques", "Briquets", "Machines"]) {
      expect(isInScope(alert({ category })), category).toBe(false);
    }
  });

  it("keeps motor vehicles only for bikes and scooters", () => {
    expect(isInScope(alert({ category: "Véhicules à moteur", product: "Vélo électrique" }))).toBe(true);
    expect(isInScope(alert({ category: "Véhicules à moteur", product: "Trottinette électrique" }))).toBe(true);
    expect(isInScope(alert({ category: "Véhicules à moteur", product: "Motocyclette" }))).toBe(false);
    expect(isInScope(alert({ category: "Véhicules à moteur", product: "Voiture particulière" }))).toBe(false);
  });

  it("drops disposable e-cigarettes", () => {
    expect(isInScope(alert({ category: "Autres - Cigarette électronique jetable" }))).toBe(false);
  });

  it("keeps consumer products only", () => {
    expect(isConsumerProduct(alert({ type: "Consommateur" }))).toBe(true);
    expect(isConsumerProduct(alert({ type: "Professionnels" }))).toBe(false);
  });

  it("keeps the latest version of an alert", () => {
    const older = { ...alert({}), publishedAt: "2026-01-01", productionDates: "old" };
    const newer = { ...alert({}), publishedAt: "2026-02-01", productionDates: "new" };
    expect(latestByCase([newer, older])).toEqual([newer]);
  });
});

describe("field splitting", () => {
  it("splits lists and drops unknown values", () => {
    expect(splitValues("LH02, cn108; 4650")).toEqual(["LH02", "cn108", "4650"]);
    expect(splitValues("Inconnu")).toEqual([]);
    expect(splitValues("unknown, -, AB12")).toEqual(["AB12"]);
  });

  it("keeps pure-digit barcodes and checks the digit inside text", () => {
    expect(barcodesIn(["21828069545", "4250383846504"])).toEqual(["21828069545", "4250383846504"]);
    expect(barcodesIn(["EAN 4250383846504", "ref 12345678"])).toEqual(["4250383846504"]);
  });
});

describe("toRecall", () => {
  const [alert] = parse(alertXml({ brand: "Sans marque" })).alerts;

  it("maps an alert, with batches as sample batches only", () => {
    const recall = toRecall(alert, null, null);
    expect(recall).toMatchObject({
      id: "sg:SR/02933/26",
      source: "safetygate",
      sourceRef: "SR/02933/26",
      url: "https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/10118690",
      publishedAt: "2026-10-23",
      productName: "Ensemble de jouets",
      refs: ["816937989081", "LH02", "cn1082977006febae"],
      batches: [],
      sampleBatches: ["C202432256412"],
      risk: "Étouffement",
      whatToDo: null,
    });
    expect(recall.gtins).toContain("21828069545");
    expect(recall.images).toHaveLength(2);
  });

  it("strips per-model batches so they never limit the recall", () => {
    const details = {
      models: [],
      refs: [],
      batches: [],
      productionFrom: "2023-04-28",
      productionTo: "2024-06-20",
      modelRanges: [{ model: "lh02", from: "2023-04-28", to: "2024-06-20", refs: [], batches: ["C1"] }],
      quote: "28.04.2023 - 20.06.2024",
    };
    expect(toRecall(alert, details, null).modelRanges?.[0]?.batches).toEqual([]);
  });

  it("only sends production dates to the model", () => {
    expect(datesText(alert)).toBeNull();
    expect(datesText({ ...alert, productionDates: "28.04.2023 - 20.06.2024" })).toContain("Dates de production : 28.04.2023 - 20.06.2024");
  });
});
