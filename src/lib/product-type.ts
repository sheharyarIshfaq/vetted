import { normalizeText } from "./text";

// The fixed list a recall's clean product_type is chosen from. Vehicles and baby gear keep the keyword types' names.
export const PRODUCT_TYPES = [
  "e-bike", "e-scooter", "scooter", "hoverboard", "moped", "bicycle", "motor vehicle",
  "car seat", "car seat base", "stroller", "bike seat", "high chair", "travel cot", "cot", "baby carrier", "baby walker",
  "baby bouncer", "bath seat", "pacifier", "teether", "baby bottle", "baby sleeping bag", "baby monitor", "stair gate",
  "changing table",
  "toy", "soft toy", "magnetic toy", "slime", "ride-on toy", "toy weapon", "doll", "balloon", "costume",
  "power bank", "charger", "cable", "phone", "headphones", "speaker", "lamp", "lighting chain", "heater", "hair appliance",
  "kitchen appliance", "vacuum cleaner", "electric toothbrush", "extension lead", "battery", "smoke detector", "television",
  "e-cigarette", "other electrical", "helmet", "protective gear", "clothing", "footwear", "bag", "jewellery", "furniture",
  "decoration", "kitchenware", "stationery", "sports equipment", "tool", "cosmetics", "other",
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

// Plain keywords, French, English and German, for the products resold most. Anything else stays unknown.
// Types in one group are variants of each other: a recall for a "véhicule à moteur" can be a fatbike.
const TYPES: [type: string, group: string, pattern: RegExp][] = [
  ["car seat", "car seat", /\b(siege auto|sieges auto|siege de voiture|siege voiture|car seat|infant carrier|babyschale|autositz)\b/],
  ["stroller", "stroller", /\b(poussette|stroller|pram|pushchair|buggy|kinderwagen)\b/],
  ["bike seat", "bike seat", /\b(siege velo|porte bebe velo|bike seat|bicycle seat|fahrradsitz)\b/],
  ["high chair", "high chair", /\b(chaise haute|high chair|hochstuhl)\b/],
  ["travel cot", "travel cot", /\b(lit parapluie|lit de voyage|travel cot|playpen|reisebett)\b/],
  ["helmet", "helmet", /\b(casque|helmet|helm)\b/],
  [
    "e-bike",
    "vehicle",
    /\b(velos? (a assistance )?electriques?|vae|epac|e ?bikes?|electric (bike|bicycle)s?|fat ?bikes?|speed ?bikes?|s ?pedelecs?|pedelecs?|elektrofahrrad)\b/,
  ],
  ["hoverboard", "vehicle", /\b(hoverboards?|overboards?|gyropodes?|scooters? auto equilibrage|self balancing scooters?)\b/],
  ["e-scooter", "vehicle", /\b(trottinettes? electriques?|e ?scooters?|electric scooters?|e ?roller)\b/],
  ["scooter", "vehicle", /\b(trottinettes?|scooters?)\b/],
  ["moped", "vehicle", /\b(cyclomoteurs?|mobylettes?|mopeds?|motos?|motocyclettes?|motorcycles?|quads?)\b/],
  ["motor vehicle", "vehicle", /\b(vehicules? a moteur|motor vehicles?|kraftfahrzeuge?)\b/],
];

const GROUPS = new Map(TYPES.map(([type, group]) => [type, group]));
// A broader word that a narrower one contains: "trottinette électrique" is an e-scooter, not also a scooter.
const NARROWER: Record<string, string[]> = { scooter: ["e-scooter", "hoverboard"] };
const BASE = /\bbase\b/;

// "car seat", "stroller", "e-bike", …; null when the text names no known type, or types from several groups
// (a stroller sold with its car seat). Several types from one group give the group ("vehicle").
export function productType(text: string | null): string | null {
  if (!text) return null;
  const normalized = normalizeText(text);
  const matched = TYPES.filter(([, , pattern]) => pattern.test(normalized));
  const found = matched.filter(([type]) => !matched.some(([other]) => NARROWER[type]?.includes(other)));
  const groups = new Set(found.map(([, group]) => group));
  if (groups.size !== 1) return null;
  if (found.length > 1) return found[0][1];
  // A car seat base is sold and recalled on its own.
  return found[0][0] === "car seat" && BASE.test(normalized) ? "car seat base" : found[0][0];
}

// Families whose members are variants of one another, so they never rule each other out:
// a "véhicule à moteur" recall can be a fatbike, a "toy" recall a soft toy, a "lamp" a lighting chain.
const FAMILIES: Record<string, readonly string[]> = {
  vehicle: ["vehicle", "e-bike", "e-scooter", "scooter", "hoverboard", "moped", "bicycle", "motor vehicle"],
  toy: ["toy", "soft toy", "magnetic toy", "slime", "ride-on toy", "toy weapon", "doll", "balloon", "costume"],
  lighting: ["lamp", "lighting chain"],
  // "Porte-bébé" is both a baby carrier and a child bike seat.
  carrier: ["baby carrier", "bike seat"],
};
const FAMILY = new Map(Object.entries(FAMILIES).flatMap(([family, types]) => types.map((type) => [type, family])));
// Types that say only "something of this kind", so they never conflict with a type of that kind.
const ELECTRICAL = new Set(["power bank", "charger", "cable", "phone", "headphones", "speaker", "lamp", "lighting chain", "heater",
  "hair appliance", "kitchen appliance", "vacuum cleaner", "electric toothbrush", "extension lead", "battery", "smoke detector",
  "television", "e-cigarette", "other electrical"]);

// Types a brand makes many unrelated products of: "this brand has a recalled toy" says nothing about this toy.
const BROAD = new Set([
  ...FAMILIES.toy, "clothing", "footwear", "bag", "jewellery", "cosmetics", "decoration", "kitchenware", "stationery",
  "sports equipment", "tool", "furniture", "lamp", "lighting chain", "cable", "battery", "extension lead", "other electrical", "other",
]);

// A type specific enough that a brand's recall of it is worth asking the seller about.
export function isSpecificType(type: string | null): type is string {
  return type !== null && !BROAD.has(type);
}

// Only clearly different products conflict (a stroller and a car seat, a power bank and a helmet);
// a type and its variants, a family, or a vague "other" never do.
export function typesConflict(a: string | null, b: string | null) {
  if (a === null || b === null || a === b || a === "other" || b === "other") return false;
  const family = FAMILY.get(a) ?? GROUPS.get(a);
  if (family !== undefined && family === (FAMILY.get(b) ?? GROUPS.get(b))) return false;
  if ((a === "other electrical" && ELECTRICAL.has(b)) || (b === "other electrical" && ELECTRICAL.has(a))) return false;
  return true;
}
