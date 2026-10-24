import { z } from "zod";
import { alertSchema, politeFetch, type SafetyGateAlert } from "./safetygate-alert";

// Alerts are published one by one before the weekly report that collects them; these endpoints show them first.
const API = "https://ec.europa.eu/safety-gate-alerts/public/api/notification";
const ALERT_PAGE = "https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail";
const MAX_PAGES = 10;

const carouselSchema = z.object({
  totalPages: z.number(),
  content: z.array(z.object({ id: z.number(), reference: z.string() })),
});

const keyed = z.object({ key: z.string(), name: z.string().nullish() });
const frVersion = z.looseObject({ language: z.object({ key: z.string() }) });

const detailSchema = z.object({
  id: z.number(),
  reference: z.string(),
  publicationDate: z.string(),
  country: z.object({ name: z.string() }).nullish(),
  product: z.object({
    productCategory: keyed.nullish(),
    productCategoryOther: z.string().nullish(),
    professionalProduct: z.boolean().nullish(),
    nameSpecific: z.string().nullish(),
    brands: z.array(z.object({ brand: z.string() })).nullish(),
    modelTypes: z.array(z.object({ modelType: z.string() })).nullish(),
    batchNumbers: z.array(z.unknown()).nullish(),
    barcodes: z.array(z.unknown()).nullish(),
    photos: z.array(z.object({ id: z.number(), published: z.boolean().nullish() })).nullish(),
    versions: z.array(frVersion.extend({ name: z.string().nullish(), description: z.string().nullish() })).nullish(),
  }),
  risk: z
    .object({
      riskType: z.array(keyed).nullish(),
      versions: z.array(frVersion.extend({ riskDescription: z.string().nullish() })).nullish(),
    })
    .nullish(),
  measureTaken: z.object({ measures: z.array(z.object({ measureCategory: keyed })).nullish() }).nullish(),
});

type Detail = z.infer<typeof detailSchema>;

// The weekly reports name categories in French; the API gives keys. Matched in order, lighting chains before lighting.
const CATEGORIES: [RegExp, string][] = [
  [/childcare/, "Articles de puériculture et équipement pour enfants"],
  [/toys?\b/, "Jouets"],
  [/electrical/, "Appareils et équipements électriques"],
  [/clothing|textile/, "Vêtements, textiles et articles de mode"],
  [/jewel/, "Bijoux"],
  [/protective/, "Équipements de protection"],
  [/lighting\.chain/, "Guirlandes lumineuses"],
  [/lighting/, "Appareils d'éclairage"],
  [/hobby|sport/, "Équipements de loisirs/sport"],
  [/decorati/, "Articles de décoration"],
  [/furniture/, "Meubles"],
  [/laser/, "Pointeurs laser"],
  [/gadget/, "Gadgets"],
  [/hand\.tool/, "Outils à main"],
  [/communication|multimedia/, "Équipement de communication et multimédia"],
  [/gas/, "Appareils fonctionnant au gaz et éléments de fabrication de ces appareils"],
  [/recreational\.craft/, "Bateaux de plaisance"],
  [/stationery/, "Papeterie"],
  [/motor\.vehicle/, "Véhicules à moteur"],
  [/cosmetic/, "Produits cosmétiques"],
  [/chemical/, "Produits chimiques"],
  [/kitchen/, "Accessoires de cuisine"],
  [/machinery/, "Machines"],
  [/pyrotechnic/, "Articles pyrotechniques"],
  [/explosive/, "Appareils destinés à être utilisés en atmosphères explosives"],
  [/pressure/, "Équipements sous pression"],
  [/measuring/, "Appareils de mesure"],
  [/construction/, "Produits de construction"],
  [/lighter/, "Briquets"],
];

const RISKS: Record<string, string> = {
  injuries: "Blessures",
  choking: "Étouffement",
  suffocation: "Suffocation",
  strangulation: "Étranglement",
  entrapment: "Piégeage",
  burns: "Brûlures",
  "electric.shock": "Choc électrique",
  fire: "Incendie",
  chemical: "Chimique",
  cuts: "Coupures",
  drowning: "Noyade",
  damage: "Dommages",
};

const MEASURES: Record<string, string> = {
  "recall.of.product.from.consumers": "Rappel du produit auprès des consommateurs",
  "withdrawal.of.product.from.market": "Retrait du produit du marché",
  "ban.on.the.marketing.of.the.product.and.any.accompanying.measures": "Interdiction de la mise sur le marché",
  "destruction.of.the.product": "Destruction du produit",
  "import.rejected.at.border": "Importation refusée à la frontière",
};

const fr = <T extends { language: { key: string } }>(versions: readonly T[] | null | undefined) =>
  versions?.find((version) => version.language.key === "FR") ?? versions?.[0];

// Barcode and batch entries are objects whose shape isn't documented; their text values are kept.
function values(entries: readonly unknown[] | null | undefined) {
  return (entries ?? []).flatMap((entry) =>
    typeof entry === "string" ? [entry] : entry && typeof entry === "object" ? Object.values(entry).filter((value) => typeof value === "string") : [],
  );
}

function category(detail: Detail, productName: string) {
  const key = detail.product.productCategory?.key ?? "";
  const known = CATEGORIES.find(([pattern]) => pattern.test(key))?.[1];
  return known ?? `Autres - ${detail.product.productCategoryOther || productName}`;
}

// The API's alert in the same shape as a weekly report entry, so both go through the same rules.
export function toAlert(detail: Detail): SafetyGateAlert | null {
  const product = fr(detail.product.versions);
  const productName = product?.name?.trim() || detail.product.nameSpecific?.trim() || "";
  const parsed = alertSchema.safeParse({
    caseNumber: detail.reference,
    reference: `${ALERT_PAGE}/${detail.id}`,
    category: category(detail, productName),
    product: productName,
    brand: (detail.product.brands ?? []).map((entry) => entry.brand).join(", "),
    name: detail.product.nameSpecific ?? "",
    type_numberOfModel: (detail.product.modelTypes ?? []).map((entry) => entry.modelType).join(", "),
    batchNumber: values(detail.product.batchNumbers).join(", "),
    barcode: values(detail.product.barcodes).join(", "),
    riskType: (detail.risk?.riskType ?? []).map((risk) => RISKS[risk.key.replace(/^riskType\./, "")] ?? risk.name ?? "").filter(Boolean).join(", "),
    danger: fr(detail.risk?.versions)?.riskDescription ?? "",
    measures: (detail.measureTaken?.measures ?? [])
      .map(({ measureCategory }) => MEASURES[measureCategory.key.replace(/^measure\.category\./, "")] ?? measureCategory.name ?? "")
      .filter(Boolean)
      .join(", "),
    description: product?.description ?? "",
    notifyingCountry: detail.country?.name ?? "",
    type: detail.product.professionalProduct ? "Professionnel" : "Consommateur",
    level: "",
    pictures: (detail.product.photos ?? []).filter((photo) => photo.published !== false).map((photo) => `${API}/image/${photo.id}`).join(" "),
    companyRecallCode: "",
    productionDates: "",
  });
  return parsed.success ? { ...parsed.data, reportId: "", publishedAt: detail.publicationDate.slice(0, 10) } : null;
}

// The newest alerts that no weekly report holds yet. Pages run newest first; a page with nothing new ends the walk.
export async function fetchLatestAlerts({
  known,
  userAgent,
  log,
}: {
  known: ReadonlySet<string>;
  userAgent: string;
  log: (message: string) => void;
}) {
  const ids: number[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await politeFetch(`${API}/carousel/`, userAgent, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ language: "fr", page: String(page) }),
    });
    const carousel = carouselSchema.parse(JSON.parse(body));
    const fresh = carousel.content.filter((item) => !known.has(item.reference));
    ids.push(...fresh.map((item) => item.id));
    if (fresh.length === 0 || page + 1 >= carousel.totalPages) break;
  }

  const alerts: SafetyGateAlert[] = [];
  for (const id of ids) {
    const body = await politeFetch(`${API}/${id}?language=fr`, userAgent, { headers: { Accept: "application/json" } });
    const detail = detailSchema.safeParse(JSON.parse(body));
    const alert = detail.success ? toAlert(detail.data) : null;
    if (alert) alerts.push(alert);
    else log(`Skipped Safety Gate alert ${id}: unexpected fields`);
  }
  log(`Read ${alerts.length} alerts not yet in a weekly report`);
  return alerts;
}
