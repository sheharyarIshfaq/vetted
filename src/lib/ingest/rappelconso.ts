import { z } from "zod";
import type { NewRecall } from "../../db/schema";
import { loadBrandAliases } from "../db/brands";
import { upsertRecalls } from "../db/recalls";
import { isValidGtin } from "../gtin";
import { normalizeBrand, normalizeModelText } from "../text";
import { toIsoDate } from "./dates";
import {
  cacheKey,
  estimateCost,
  needsModel,
  parsePending,
  pendingTexts,
  readCachedDetails,
  validateDetails,
  type RecallDetails,
} from "./parse-details";

const DATASET_URL =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/exports/json";

const MOBILITY = "automobiles et moyens de déplacement";
const ACCESSORIES = "tous types d'accessoires";

// Food and hygiene are out of scope; for mobility only bikes, scooters and their accessories, not cars.
const SOURCES: { category: string; subcategory?: string }[] = [
  { category: "bébés-enfants (hors alimentaire)" },
  { category: "maison-habitat" },
  { category: "appareils électriques, outils" },
  { category: "vêtements, mode, epi" },
  { category: "autres" },
  { category: "sports-loisirs" },
  { category: "equipements de communication" },
  { category: MOBILITY, subcategory: "vélos, bicyclettes, vélos à assistance électrique" },
  { category: MOBILITY, subcategory: "engins de déplacement personnel" },
  { category: MOBILITY, subcategory: "autres moyens de déplacement" },
  { category: MOBILITY, subcategory: ACCESSORIES },
];

// The accessories subcategory mixes car products with helmets and child seats.
const ACCESSORY_KEYWORDS = /v[ée]lo|casque|si[èe]ge|trottinette|enfant|b[ée]b[ée]|cycl/i;


const nullableText = z.string().nullish().transform((value) => value ?? null);

export const rappelConsoRowSchema = z.looseObject({
  id: z.number(),
  numero_fiche: z.string(),
  numero_version: z.number().nullish(),
  date_publication: z.string(),
  categorie_produit: nullableText,
  sous_categorie_produit: nullableText,
  marque_produit: nullableText,
  libelle: nullableText,
  modeles_ou_references: nullableText,
  identification_produits: z.array(z.string()).nullish(),
  informations_complementaires: nullableText,
  date_debut_commercialisation: nullableText,
  date_date_fin_commercialisation: nullableText,
  motif_rappel: nullableText,
  risques_encourus: nullableText,
  conduites_a_tenir_par_le_consommateur: nullableText,
  liens_vers_les_images: nullableText,
  lien_vers_la_fiche_rappel: nullableText,
});

export type RappelConsoRow = z.infer<typeof rappelConsoRowSchema>;

export type RecallGroup = {
  row: RappelConsoRow; // the latest version
  gtins: string[];
  identifiers: string[];
  images: string[];
  rows: RappelConsoRow[];
};

export type IngestPlan = {
  fetched: number;
  recalls: number;
  needModel: number;
  cached: number;
  calls: number;
  estimatedCost: number;
};

type Log = (message: string) => void;

export async function fetchRappelConso({ since, userAgent }: { since?: string; userAgent: string }) {
  const rows: RappelConsoRow[] = [];
  let invalid = 0;
  for (const source of SOURCES) {
    const url = new URL(DATASET_URL);
    url.searchParams.append("refine", `categorie_produit:${source.category}`);
    if (source.subcategory) url.searchParams.append("refine", `sous_categorie_produit:${source.subcategory}`);
    if (since) url.searchParams.set("where", `date_publication >= date'${since}'`);

    const response = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (!response.ok) throw new Error(`RappelConso ${source.category}: HTTP ${response.status}`);
    const body: unknown = await response.json();
    for (const item of z.array(z.unknown()).parse(body)) {
      const parsed = rappelConsoRowSchema.safeParse(item);
      if (!parsed.success) {
        invalid++;
        continue;
      }
      if (source.subcategory === ACCESSORIES && !ACCESSORY_KEYWORDS.test(rowText(parsed.data))) continue;
      rows.push(parsed.data);
    }
  }
  return { rows, invalid };
}

function rowText(row: RappelConsoRow) {
  return [row.libelle, row.modeles_ou_references].filter(Boolean).join(" ");
}

// Entries look like ["4000984-204346, -204377", "non concerné", "|5027148039315", "batch n°10154", ...],
// where "|" starts the next product. Barcodes go to gtins, the rest is kept as text for parsing.
// A barcode inside other text ("r23189 mascot car 8904001231895") counts only with a valid check digit.
export function splitIdentification(entries: readonly string[] | null | undefined) {
  const gtins: string[] = [];
  const identifiers: string[] = [];
  for (const entry of entries ?? []) {
    const value = entry.replace(/^\|/, "").trim();
    if (!value || /^non concern[ée]$/i.test(value)) continue;
    const digits = value.replace(/\s/g, "");
    if (/^\d{8,14}$/.test(digits)) {
      gtins.push(digits);
      continue;
    }
    gtins.push(...(value.match(/(?<!\d)\d{8,14}(?!\d)/g) ?? []).filter(isValidGtin));
    identifiers.push(value);
  }
  return { gtins, identifiers };
}

export function splitImages(value: string | null) {
  return (value ?? "").split(/[|\s]+/).filter((url) => url.startsWith("http"));
}

export function groupByFiche(rows: readonly RappelConsoRow[]): RecallGroup[] {
  const byFiche = new Map<string, RappelConsoRow[]>();
  for (const row of rows) {
    const group = byFiche.get(row.numero_fiche) ?? [];
    group.push(row);
    byFiche.set(row.numero_fiche, group);
  }
  return [...byFiche.values()].map((group) => {
    const latest = group.reduce((best, row) => ((row.numero_version ?? 0) > (best.numero_version ?? 0) ? row : best));
    const split = group.map((row) => splitIdentification(row.identification_produits));
    return {
      row: latest,
      gtins: unique(split.flatMap((part) => part.gtins)),
      identifiers: unique(split.flatMap((part) => part.identifiers)),
      images: unique(group.flatMap((row) => splitImages(row.liens_vers_les_images))),
      rows: group,
    };
  });
}

function unique(values: string[]) {
  return [...new Set(values)];
}

// The free text sent to the model; "¤" is the source's line separator.
export function detailsText(group: RecallGroup) {
  return [group.row.modeles_ou_references, group.identifiers.join("\n"), group.row.informations_complementaires]
    .filter(Boolean)
    .join("\n")
    .replaceAll("¤", "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// Without parsed details, the product name minus the brand stands in for the model.
export function fallbackModels(row: RappelConsoRow) {
  const name = row.libelle?.trim();
  if (!name) return [];
  const brand = row.marque_produit?.trim().toLowerCase();
  const withoutBrand = brand ? name.toLowerCase().replace(brand, " ").replace(/\s+/g, " ").trim() : name;
  return [withoutBrand || name];
}

export function toRecall(group: RecallGroup, details: RecallDetails | null, brandNorm: string | null): NewRecall {
  const { row } = group;
  const productName = row.libelle?.trim() || row.modeles_ou_references?.trim() || row.numero_fiche;
  const models = details?.models.length ? details.models : fallbackModels(row);
  const refs = details?.refs ?? [];
  return {
    id: `rc:${row.id}`,
    source: "rappelconso",
    sourceRef: row.numero_fiche,
    url: row.lien_vers_la_fiche_rappel ?? `https://rappel.conso.gouv.fr/fiche-rappel/${row.id}/interne`,
    publishedAt: toIsoDate(row.date_publication) ?? row.date_publication.slice(0, 10),
    category: row.categorie_produit,
    subcategory: row.sous_categorie_produit,
    brand: row.marque_produit,
    brandNorm,
    productName,
    models,
    refs,
    gtins: group.gtins,
    batches: details?.batches ?? [],
    productionFrom: details?.productionFrom ?? null,
    productionTo: details?.productionTo ?? null,
    modelRanges: details?.modelRanges ?? [],
    soldFrom: toIsoDate(row.date_debut_commercialisation),
    soldTo: toIsoDate(row.date_date_fin_commercialisation),
    risk: row.risques_encourus,
    reason: row.motif_rappel,
    whatToDo: row.conduites_a_tenir_par_le_consommateur?.split("|").join("\n") ?? null,
    images: group.images,
    datesQuote: details?.quote ?? null,
    raw: group.rows.length === 1 ? group.row : group.rows,
    searchText: normalizeModelText([row.marque_produit, productName, ...models, ...refs].filter(Boolean).join(" ")),
  };
}

export async function ingestRappelConso({
  since,
  userAgent,
  confirm,
  log,
}: {
  since?: string;
  userAgent: string;
  confirm: (plan: IngestPlan) => Promise<boolean>;
  log: Log;
}) {
  log(since ? `Fetching RappelConso recalls published since ${since}` : "Fetching all RappelConso recalls in scope");
  const { rows, invalid } = await fetchRappelConso({ since, userAgent });
  if (invalid) log(`Skipped ${invalid} rows that did not match the expected fields`);

  const groups = groupByFiche(rows);
  const texts = groups.map(detailsText);
  const keys = texts.map((text) => (needsModel(text) ? cacheKey(text) : null));
  const cached = await readCachedDetails(keys.filter((key): key is string => key !== null));

  const pending = pendingTexts(keys, texts, cached);
  const plan: IngestPlan = {
    fetched: rows.length,
    recalls: groups.length,
    needModel: keys.filter(Boolean).length,
    cached: cached.size,
    calls: pending.size,
    estimatedCost: estimateCost([...pending.values()]),
  };
  if (!(await confirm(plan))) return null;
  const failed = await parsePending(pending, cached, log);

  const aliases = await loadBrandAliases();
  let dropped = 0;
  const recalls = groups.map((group, i) => {
    const key = keys[i];
    const output = key ? cached.get(key) : undefined;
    const details = output ? validateDetails(texts[i], output) : null;
    if (output && !details) dropped++;
    const brandNorm = group.row.marque_produit ? normalizeBrand(group.row.marque_produit, aliases) : null;
    return toRecall(group, details, brandNorm || null);
  });
  await upsertRecalls(recalls);

  const perCategory = new Map<string, number>();
  for (const recall of recalls) {
    const label = recall.subcategory && recall.category === MOBILITY ? `${recall.category} / ${recall.subcategory}` : recall.category ?? "unknown";
    perCategory.set(label, (perCategory.get(label) ?? 0) + 1);
  }
  return { stored: recalls.length, failed, dropped, perCategory };
}
