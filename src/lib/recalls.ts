import { z } from "zod";

export type RecallSource = "rappelconso" | "safetygate";

// The /recalls chips group both sources' own categories; RappelConso's broad "bébés-enfants" is split by subcategory.
export const CATEGORY_GROUPS = [
  {
    key: "baby",
    label: "Baby and childcare",
    rappelconso: { subcategories: ["articles pour enfants et puériculture"] },
    safetygate: { categories: ["Articles de puériculture et équipement pour enfants"] },
  },
  {
    key: "toys",
    label: "Toys",
    rappelconso: { subcategories: ["jouets"] },
    safetygate: { categories: ["Jouets"] },
  },
  {
    key: "mobility",
    label: "Bikes and mobility",
    rappelconso: { categories: ["automobiles et moyens de déplacement"] },
    safetygate: { categories: ["Véhicules à moteur"] },
  },
  {
    key: "electronics",
    label: "Electronics",
    rappelconso: { subcategories: ["appareils électriques, électroménager", "equipements de communication, média"] },
    safetygate: {
      categories: [
        "Appareils et équipements électriques",
        "Équipement de communication et multimédia",
        "Appareils d'éclairage",
        "Guirlandes lumineuses",
      ],
    },
  },
] as const;

export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const SOURCE_FILTERS = [
  { key: "fr", label: "France", source: "rappelconso" },
  { key: "eu", label: "EU", source: "safetygate" },
] as const satisfies readonly { key: string; label: string; source: RecallSource }[];

export const SOURCE_BADGES: Record<RecallSource, string> = { rappelconso: "France · RappelConso", safetygate: "EU · Safety Gate" };

const filtersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  category: z.enum(CATEGORY_GROUPS.map((group) => group.key)).nullable().catch(null),
  source: z.enum(SOURCE_FILTERS.map((filter) => filter.key)).nullable().catch(null),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type RecallFilters = z.infer<typeof filtersSchema>;

// Query-string values come from the address bar: anything unknown falls back to no filter.
export function parseRecallFilters(params: Record<string, string | string[] | undefined>): RecallFilters {
  const first = (key: string) => [params[key]].flat()[0];
  return filtersSchema.parse({ q: first("q") ?? "", category: first("category") ?? null, source: first("source") ?? null, page: first("page") ?? 1 });
}

export function recallFiltersHref(filters: RecallFilters, changes: Partial<RecallFilters>) {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.source) params.set("source", next.source);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/recalls?${query}` : "/recalls";
}

// Safety Gate ids contain slashes ("sg:SR/02933/26"), so the id is one encoded path segment.
export function recallHref(id: string) {
  return `/recalls/${encodeURIComponent(id)}`;
}

// "…Catégorie de mesure: Retrait du produit du marchéDate d'entrée en vigueur: …" -> ["Retrait du produit du marché"]
export function measuresTaken(text: string | null | undefined) {
  const measures = [...(text ?? "").matchAll(/Catégorie de mesure\s*:\s*(.+?)(?=Date d'entrée en vigueur|Type d'opérateur|Portée|$)/g)];
  return [...new Set(measures.map((match) => match[1].trim()).filter(Boolean))];
}
