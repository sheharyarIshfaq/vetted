import type { ModelRange } from "../db/schema";
import { isSpecificType, productType, typesConflict } from "./product-type";
import { normalizeModelText, normalizeText } from "./text";

export type Verdict = "recalled" | "check_label" | "clear";

export type EvidenceSource = "listing_text" | "listing_photo" | "label_photo" | "barcode" | "official_data";

export type Evidence = { fact: string; matched: boolean; source: EvidenceSource };

export type ItemFacts = {
  brandNorm: string | null;
  brand: string | null;
  model: string | null;
  modelVariant: string | null;
  references: string[];
  gtin: string | null;
  batch: string | null;
  productionDate: string | null; // YYYY-MM
  category?: string | null; // the product type read from the listing, in free words
  productType?: string | null; // the same, from the fixed type list
  title?: string | null; // the listing's title
  // Where each fact was read; listing text unless the label or a photo said otherwise.
  sources?: Partial<Record<"references" | "gtin" | "batch" | "productionDate", EvidenceSource>>;
};

export type CandidateRecall = {
  id: string;
  source: string;
  brand: string | null;
  brandNorm: string | null;
  productName: string;
  models: string[];
  refs: string[];
  gtins: string[];
  batches: string[];
  sampleBatches: string[]; // batch of the tested sample: identifies the product, never limits the recall
  productionFrom: string | null;
  productionTo: string | null;
  modelRanges: ModelRange[];
  // Clean fields read at ingestion; used instead of the raw ones once a recall has them (cleanHash set).
  cleanHash?: string | null;
  brandCleanNorm?: string | null;
  productType?: string | null;
  modelNames?: string[];
  codes?: string[];
  specs?: string[]; // "52v", "20k", read with the clean fields
  unitLimit?: string | null; // the official passage limiting the recall to some serial numbers or a listed set
};

// The recall as the rules compare it: clean brand, model names and codes when it has them, the raw fields otherwise.
function comparable(recall: CandidateRecall): CandidateRecall {
  if (!recall.cleanHash) return recall;
  return {
    ...recall,
    brandNorm: recall.brandCleanNorm ?? recall.brandNorm,
    // Codes with letters are model names too ("xt800 v1", "v10+"); pure numbers stay references.
    models: [...new Set([...(recall.modelNames ?? []), ...(recall.codes ?? []).filter((code) => /[a-z]/i.test(code))])],
    refs: [...new Set([...recall.refs, ...(recall.codes ?? [])])],
  };
}

export type Candidate = {
  recall: CandidateRecall;
  titleSimilarity: number; // pg_trgm similarity between the listing and the recall's search text
  brandSimilarity: number;
  onlyBrandNamingModel?: boolean; // set by decideBest: no other brand among the candidates has a recall naming the listing's model
};

export type PhotoComparison = {
  sameProduct: "yes" | "no" | "unsure" | null; // null when photos were not compared
  officialPhotoUnavailable?: boolean;
};

export type VerdictResult = {
  verdict: Verdict;
  // "match" backs the verdict; "other_dates" and "not_a_match" are shown for context with a clear verdict.
  recall: { id: string; relation: "match" | "other_dates" | "not_a_match" } | null;
  evidence: Evidence[];
  notes: string[];
};

// The same product recalled in the other official source, shown as a second notice.
export type BestResult = VerdictResult & { alsoMatched: string[] };

const TITLE_MATCH_THRESHOLD = 0.55;
const BRAND_MATCH_THRESHOLD = 0.6;

// "Smile III" and "smile-3" both become "smile3".
export function normalizeModel(value: string) {
  return normalizeModelText(value).replaceAll(" ", "");
}

export const normalizeCode = normalizeModel;

// Pack, colour and filler words: "breeze trio mineral grey" is the Breeze.
const FILLER = new Set([
  "trio", "duo", "pack", "set", "kit", "edition", "travel", "system", "the", "and", "with", "de", "des", "du", "la", "le",
  "les", "et", "avec", "mineral", "tinted", "grey", "gray", "gris", "noir", "black", "blanc", "white", "rouge", "red",
  "bleu", "blue", "vert", "green", "rose", "pink", "beige", "graphite", "copper",
]);

// Product and spec words name what something is, not which model: "trottinette électrique", "power bank", "20000 mAh".
const GENERIC = new Set([
  "batterie", "batteries", "externe", "power", "bank", "powerbank", "chargeur", "charger", "cable", "adaptateur", "adapter",
  "usb", "c", "pd", "type", "mah", "w", "v", "ah", "wh", "pouces", "pouce", "inch", "inches", "trottinette", "trottinettes",
  "electrique", "electriques", "electric", "scooter", "scooters", "hoverboard", "velo", "bike", "e", "portable", "sans", "fil",
  "wireless", "rapide", "fast", "charge", "pour", "for",
]);

// "20k" and "20000" are the same capacity; "65w" or "20000mah" keep only the number.
function specWord(word: string) {
  const thousands = /^(\d+)k$/.exec(word);
  if (thousands) return String(Number(thousands[1]) * 1000);
  return /^\d+(?:mah|wh|w|v|ah)$/.test(word) ? word.replace(/[a-z]+$/, "") : word;
}

// A number and its unit, as a battery, power or size is written: "20k", "20000 mah", "60v", "6,5 pouces".
const SPEC = /(\d+(?:[.,]\d+)?)\s*(mah|k|wh|ah|w|v|pouces?|inch(?:es)?|")(?![a-z0-9])/gi;
const SPEC_UNITS: Record<string, string> = { k: "mah", mah: "mah", wh: "wh", ah: "ah", w: "w", v: "v", '"': "inch" };

type Spec = { unit: string; value: number; text: string };

function specsIn(value: string | null | undefined): Spec[] {
  // "10 000 mAh" and "10.000 mAh" are 10000.
  const text = (value ?? "").toLowerCase().replace(/(\d)[\s.](\d{3})(?!\d)/g, "$1$2");
  return [...text.matchAll(SPEC)].map((match) => {
    const unit = SPEC_UNITS[match[2]] ?? "inch";
    const number = Number(match[1].replace(",", "."));
    return { unit, value: match[2] === "k" ? number * 1000 : number, text: match[0].trim() };
  });
}

// What the listing says about the recall's specs: a different value rules the recall out, a missing one leaves a doubt.
function compareSpecs(recall: CandidateRecall, item: ItemFacts) {
  const recallSpecs = [...recall.models, ...(recall.specs ?? [])].flatMap(specsIn);
  const listed = specsIn([item.model, item.modelVariant, item.title].filter(Boolean).join(" "));
  const units = [...new Set(recallSpecs.map((spec) => spec.unit))];
  const conflict = units.flatMap((unit) => {
    const given = listed.filter((spec) => spec.unit === unit);
    const wanted = recallSpecs.filter((spec) => spec.unit === unit);
    return given.length > 0 && !given.some((spec) => wanted.some((other) => other.value === spec.value)) ? [{ wanted: wanted[0], given: given[0] }] : [];
  });
  const missing = units.filter((unit) => !listed.some((spec) => spec.unit === unit));
  return { conflict: conflict[0] ?? null, missing: recallSpecs.filter((spec) => missing.includes(spec.unit)).map((spec) => spec.text) };
}

// "giro drive" in "trottinette électrique 8.5 giro drive sdrive 250 w", as whole words.
function containsWords(text: string | null | undefined, phrase: string) {
  const wanted = normalizeText(phrase);
  return wanted.length >= 4 && ` ${normalizeText(text ?? "")} `.includes(` ${wanted} `);
}

function words(value: string | null | undefined) {
  return new Set(normalizeModelText(value ?? "").split(" ").filter(Boolean).map(specWord));
}

// "es series 5 (aes015)": the name before the brackets, the codes inside them.
const BRACKETS = /\(([^)]*)\)/g;

function modelName(recallModel: string) {
  return recallModel.replace(BRACKETS, " ");
}

// The recall's references, with the codes its product and model names give in brackets.
function recallRefs(recall: CandidateRecall) {
  const bracketed = [recall.productName, ...recall.models]
    .flatMap((name) => [...name.matchAll(BRACKETS)].map((match) => match[1].trim()))
    .filter(isCode);
  return [...recall.refs, ...bracketed];
}

// Every distinctive word of the recall's model must be in the listing, never the other way round:
// "Breeze" names "breeze trio mineral grey", but "Smile" or "Smile 2" don't name "smile iii".
// Words with a digit must be in the listing's model; a title can carry stray numbers ("0-4 ans").
export function namesRecallModel(
  recallModel: string,
  recallBrand: string | null,
  item: Pick<ItemFacts, "model" | "modelVariant" | "title">,
) {
  const brand = words(recallBrand);
  // Specs aren't part of the name: "v10+ 60v 28ah" is named by "V10+", and the specs are compared on their own.
  const wanted = [...words(modelName(recallModel).replace(SPEC, " "))].filter((word) => !FILLER.has(word) && !GENERIC.has(word) && !brand.has(word));
  const model = words([item.model, item.modelVariant].filter(Boolean).join(" "));
  const title = words(item.title);
  // A short number in a title may be anything ("0-4 ans"); a long one is a spec ("20000").
  const fromTitle = (word: string) => title.has(word) && (!/\d/.test(word) || /^\d{4,}$/.test(word));
  // Makers often put their initial before the number: VSETT's "10+" is written "v10+".
  const initial = [...brand][0]?.[0];
  const withoutInitial = (word: string) => initial !== undefined && word.startsWith(initial) && /^\d/.test(word.slice(1)) && model.has(word.slice(1));
  return wanted.length > 0 && wanted.every((word) => model.has(word) || fromTitle(word) || withoutInitial(word));
}

type ModelFacts = Pick<ItemFacts, "model" | "modelVariant" | "references" | "title">;

// A model name unlikely to be shared by chance: a long made-up word ("tilboard") or a code with letters and digits.
function distinctiveModel(item: ItemFacts) {
  return [...words([item.model, item.modelVariant].filter(Boolean).join(" "))].some(
    (word) => !GENERIC.has(word) && !FILLER.has(word) && (/^[a-z]{6,}$/.test(word) || (/\d/.test(word) && /[a-z]/.test(word) && word.length >= 3)),
  );
}

// A code unlikely to be shared by chance: letters and digits ("MR2-F-41"), or six digits or more.
function distinctiveCode(code: string) {
  const compact = normalizeCode(code);
  return (/\d/.test(compact) && /[a-z]/.test(compact) && compact.length >= 4) || /^\d{6,}$/.test(compact);
}

// A trim or version of a model ("lite", "gt", "v2"), not another generation of it ("iii", "4", "5z").
const TRIM = /^(?:[a-z]+|v\d+)$/;

// The recalled models the listing's model is a shorter name of: "Mantis" for "mantis lite" or "mantis gt",
// "XT800" for "xt800 v1". "Smile" stays a different model from "smile iii".
function trimsOf(item: ItemFacts, recall: CandidateRecall) {
  const brand = words(recall.brandNorm);
  const distinctive = (value: string) => [...words(modelName(value).replace(SPEC, " "))].filter((word) => !FILLER.has(word) && !GENERIC.has(word) && !brand.has(word));
  const listed = distinctive([item.model, item.modelVariant].filter(Boolean).join(" "));
  if (listed.length === 0) return [];
  return recall.models.filter((model) => {
    const recalled = distinctive(model);
    const extra = recalled.filter((word) => !listed.includes(word));
    return listed.every((word) => recalled.includes(word)) && extra.length > 0 && extra.every((word) => TRIM.test(word));
  });
}

function namesModel(recallModel: string, recall: CandidateRecall, item: ModelFacts) {
  return itemModels(item).has(normalizeModel(modelName(recallModel))) || namesRecallModel(recallModel, recall.brandNorm, item);
}

function normalizeGtin(value: string) {
  return value.replace(/\D/g, "").replace(/^0+/, "");
}

// "2020-03" or "2020-03-15" -> "03/2020"
function monthLabel(date: string) {
  return `${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

function rangeLabel(from: string | null, to: string | null) {
  if (from && to) return `${monthLabel(from)} to ${monthLabel(to)}`;
  if (from) return `from ${monthLabel(from)}`;
  return `up to ${monthLabel(to!)}`;
}

// Compared by month, since labels give a month; a boundary month counts as inside.
export function isInRange(month: string, from: string | null, to: string | null) {
  const item = month.slice(0, 7);
  if (from && item < from.slice(0, 7)) return false;
  if (to && item > to.slice(0, 7)) return false;
  return true;
}

function itemModels(item: Pick<ItemFacts, "model" | "modelVariant">) {
  const names = [item.model, item.modelVariant, item.model && item.modelVariant ? `${item.model} ${item.modelVariant}` : null];
  return new Set(names.filter((name): name is string => Boolean(name)).map(normalizeModel).filter(Boolean));
}

function codeIn(codes: readonly string[], values: readonly string[]) {
  const wanted = new Set(values.map(normalizeCode).filter(Boolean));
  return codes.some((code) => wanted.has(normalizeCode(code)));
}

// A model or type number: has a digit and is long enough not to collide by chance ("ours" or "a1" are not).
function isCode(value: string) {
  const code = normalizeCode(value);
  return code.length >= 3 && /\d/.test(code);
}

// For an unbranded recall: a code from the listing (reference, model or batch) that the recall lists too.
function sharedCode(item: ItemFacts, recall: CandidateRecall) {
  const itemCodes = [...item.references, item.model, item.modelVariant, item.batch].filter(
    (value): value is string => value !== null && isCode(value),
  );
  const recallCodes = [...recall.refs, ...recall.models, ...recall.sampleBatches].filter(isCode);
  return codeIn(recallCodes, itemCodes);
}

// The per-model entry for this item, matched by model name or by one of its references.
function matchingRange(item: ModelFacts, recall: CandidateRecall) {
  return (
    recall.modelRanges.find((range) => namesModel(range.model, recall, item)) ??
    recall.modelRanges.find((range) => codeIn(range.refs, item.references))
  );
}

export type RecallLimits = { from: string | null; to: string | null; batches: string[]; refs: string[]; model: string | null };

// The date and batch limits that apply to this item: its model's entry if there is one, else the whole recall.
export function recallLimits(
  item: ModelFacts,
  recall: CandidateRecall,
): RecallLimits {
  const range = matchingRange(item, recall);
  return range
    ? { from: range.from, to: range.to, batches: range.batches, refs: range.refs.length ? range.refs : recall.refs, model: range.model }
    : { from: recall.productionFrom, to: recall.productionTo, batches: recall.batches, refs: recall.refs, model: null };
}

function identityEvidence(
  item: ItemFacts,
  recall: CandidateRecall,
  match: { brandMatch: boolean; modelNameMatch: boolean; refMatch: boolean; modelMatch: boolean; variantInDoubt: boolean },
): Evidence[] {
  const evidence: Evidence[] = [];
  if (item.brand) {
    evidence.push({
      fact: match.brandMatch
        ? `Brand ${item.brand} matches the recall`
        : `Brand ${item.brand} does not match ${recall.brand ?? "the recall"}`,
      matched: match.brandMatch,
      source: "listing_text",
    });
  }
  const modelName = [item.model, item.modelVariant].filter(Boolean).join(" ");
  if (match.modelNameMatch) {
    // Only the part the recall names: "Model V8", not "Model V8 Ultra Max".
    evidence.push({ fact: `Model ${match.variantInDoubt ? item.model : modelName} is named in the recall`, matched: true, source: "listing_text" });
  } else if (match.refMatch) {
    evidence.push({
      fact: "Reference code is listed in the recall",
      matched: true,
      source: item.sources?.references ?? "listing_text",
    });
  } else if (match.modelMatch) {
    evidence.push({ fact: "Listing title closely matches the recalled product", matched: true, source: "listing_text" });
  } else if (modelName) {
    evidence.push({ fact: `Model ${modelName} is not named in the recall`, matched: false, source: "listing_text" });
  }
  return evidence;
}

// A variant the recall never mentions ("V8 Ultra Max" against a recall for the "V8"): the recall may or may not cover it.
// A barcode or reference match identifies the exact product, so it leaves no doubt.
function unnamedVariant(item: ItemFacts, recall: CandidateRecall, exactCode: boolean) {
  if (exactCode || !item.model) return false;
  if (!item.modelVariant) return extraModelWords(item, recall);
  const recallWords = words([recall.productName, ...recall.models, ...recall.refs, ...recall.modelRanges.map((r) => r.model)].join(" "));
  const brand = words(recall.brandNorm);
  // Specs are compared on their own (compareSpecs), so "60V 28Ah" is not an unnamed variant.
  const variant = [...words(item.modelVariant?.replace(SPEC, " "))].filter((word) => !FILLER.has(word) && !brand.has(word));
  return variant.length > 0 && variant.some((word) => !recallWords.has(word));
}

// The listing's model says more than every recalled model it names: "my first fashion perfect" against "my first doll".
function extraModelWords(item: ItemFacts, recall: CandidateRecall) {
  const brand = words(recall.brandNorm);
  const listed = [...words(item.model?.replace(SPEC, " "))].filter((word) => !FILLER.has(word) && !GENERIC.has(word) && !brand.has(word));
  const named = recall.models.filter((model) => namesModel(model, recall, item));
  return named.length > 0 && named.every((model) => listed.some((word) => !words(modelName(model).replace(SPEC, " ")).has(word)));
}

// A clear verdict next to a close recall always leads with why it isn't a match.
function explained(evidence: Evidence[], recall: CandidateRecall): Evidence[] {
  const reason = evidence.find((item) => !item.matched && item.source !== "official_data") ?? evidence.find((item) => !item.matched);
  const lead: Evidence = {
    fact: reason ? `Not this recall: ${lowerFirst(reason.fact)}` : `Not this recall: the listing doesn't name the recalled ${recall.productName}`,
    matched: false,
    source: reason?.source ?? "listing_text",
  };
  return [lead, ...evidence.filter((item) => item !== reason)];
}

function lowerFirst(value: string) {
  return /^[A-Z][a-z]/.test(value) ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

export function decideVerdict({
  item,
  candidate,
  photo,
}: {
  item: ItemFacts;
  candidate: Candidate | null;
  photo: PhotoComparison;
}): VerdictResult {
  const source = (fact: keyof NonNullable<ItemFacts["sources"]>) => item.sources?.[fact] ?? "listing_text";
  const evidence: Evidence[] = [];
  const notes: string[] = [];

  if (!candidate) {
    if (item.brand || item.model) {
      evidence.push({
        fact: `No official recall matches ${[item.brand, item.model].filter(Boolean).join(" ")}`,
        matched: false,
        source: "official_data",
      });
    }
    return { verdict: "clear", recall: null, evidence, notes };
  }

  const recall = comparable(candidate.recall);
  if (photo.officialPhotoUnavailable) {
    evidence.push({ fact: "Official photo unavailable", matched: false, source: "official_data" });
  }

  // The listing's brand can be a product line the recall names ("Giro Drive" by Smyths Toys) or part of its brand ("Geuther").
  const brandMatch =
    item.brandNorm !== null &&
    (item.brandNorm === recall.brandNorm ||
      item.brandNorm === candidate.recall.brandNorm ||
      candidate.brandSimilarity >= BRAND_MATCH_THRESHOLD ||
      containsWords(recall.productName, item.brandNorm) ||
      containsWords(recall.brand, item.brandNorm));
  const range = matchingRange(item, recall);
  const refs = recallRefs(recall);
  // Safety Gate often gives the model only as the type reference ("V8"), so a listing's model can name it there too.
  const models = itemModels(item);
  const modelNameMatch =
    range !== undefined ||
    recall.models.some((model) => namesModel(model, recall, item)) ||
    refs.some((ref) => models.has(normalizeModel(ref)));
  const refMatch = codeIn(refs, item.references);
  // A different battery, power or size is another version of the model; an exact reference still wins.
  const specs = compareSpecs(recall, item);
  const specConflict = specs.conflict !== null && !refMatch;
  const sampleBatchMatch = item.batch !== null && codeIn(recall.sampleBatches, [item.batch]);
  // A close title stands in for the model only when the listing and the recall don't name different models.
  const otherModel = models.size > 0 && recall.models.length > 0 && !modelNameMatch;
  const modelMatch =
    (modelNameMatch && !specConflict) ||
    refMatch ||
    sampleBatchMatch ||
    // A close title stands in for a model only when the recall names none: "Hoverboard Tilgreen" doesn't name the Tilboard.
    (!otherModel && !specConflict && recall.models.length === 0 && candidate.titleSimilarity >= TITLE_MATCH_THRESHOLD);
  // Clearly different product types rule a match out: the Breeze stroller is not the Breeze car seat.
  const itemType = item.productType ?? productType(item.category ?? null) ?? productType(item.title ?? null);
  const recallType = recall.productType ?? productType(recall.productName);
  const otherType = typesConflict(itemType, recallType);
  // A barcode identifies the product like a model match does; date and batch limits still apply.
  const gtinMatch =
    item.gtin !== null && recall.gtins.some((gtin) => normalizeGtin(gtin) === normalizeGtin(item.gtin!));
  const variantInDoubt = unnamedVariant(item, recall, gtinMatch || refMatch);
  const specsUnknown = modelNameMatch && !specConflict && !gtinMatch && !refMatch && specs.missing.length > 0;

  if (gtinMatch) {
    evidence.push({ fact: `Barcode ${item.gtin} is listed in the recall`, matched: true, source: source("gtin") });
  } else {
    if (specConflict) {
      const { wanted, given } = specs.conflict!;
      evidence.push({ fact: `The recall is for the ${wanted.text} version, this one is ${given.text}`, matched: false, source: "listing_text" });
    }
    evidence.push(...identityEvidence(item, recall, { brandMatch, modelNameMatch, refMatch, modelMatch, variantInDoubt }));
    if (otherType) {
      evidence.push({ fact: `The recall is for a ${recallType}, this is a ${itemType}`, matched: false, source: "listing_text" });
    }
  }
  if (sampleBatchMatch) {
    evidence.push({ fact: `Batch ${item.batch} is the batch named in the alert`, matched: true, source: source("batch") });
  }

  // The listing names the recalled brand and model, or its barcode or reference: photos alone can't overrule that.
  const namedInRecall = gtinMatch || (brandMatch && ((modelNameMatch && !specConflict) || refMatch || sampleBatchMatch) && !otherType);
  if (photo.sameProduct === "yes") {
    evidence.push({ fact: "Photos show the same product as the official photo", matched: true, source: "listing_photo" });
  } else if (photo.sameProduct === "no") {
    evidence.push({
      fact: namedInRecall
        ? "Photos look different from the official photo, but the listing names the recalled model"
        : "Photos show a different product from the official photo",
      matched: false,
      source: "listing_photo",
    });
  }

  // Without a brand, a similar title proves nothing ("peluche ours"): it takes a barcode, or a shared code and the photos.
  const unbranded = recall.brandNorm === null && candidate.recall.brandNorm === null;
  const identified = unbranded
    ? gtinMatch || (sharedCode(item, recall) && photo.sameProduct === "yes" && !otherType)
    : gtinMatch || (brandMatch && modelMatch && !otherType);
  if (unbranded && !identified) {
    evidence.push({
      fact: "The recalled product has no brand, so only a barcode, or a matching code and photo, can identify it",
      matched: false,
      source: "official_data",
    });
  }
  // The listing names the model but not which of its recalled versions: only the label can say.
  // References that don't match the recall's say it is another product, whatever the model name.
  const otherRefs = item.references.length > 0 && refs.length > 0 && !refMatch;
  const trims = !identified && !unbranded && brandMatch && !otherType && !otherRefs && photo.sameProduct !== "no" ? trimsOf(item, recall) : [];
  if (trims.length > 0) {
    // It is named, only without its version, so the "not named" line would contradict the reason.
    const notNamed = `Model ${[item.model, item.modelVariant].filter(Boolean).join(" ")} is not named in the recall`;
    evidence.splice(0, evidence.length, ...evidence.filter((fact) => fact.fact !== notNamed));
    evidence.push({
      fact: `The recall names the ${trims.join(", ")}; the listing doesn't say which ${item.model} this is`,
      matched: false,
      source: "official_data",
    });
    return { verdict: "check_label", recall: { id: recall.id, relation: "match" }, evidence, notes };
  }
  // No brand, but a distinctive model name that only this brand's recalls use: the label has to show the brand.
  const distinctiveName = (modelNameMatch && !specConflict && distinctiveModel(item)) || (refMatch && item.references.some(distinctiveCode));
  if (!identified && item.brandNorm === null && recall.brand !== null && candidate.onlyBrandNamingModel && distinctiveName && !otherType && photo.sameProduct !== "no") {
    evidence.push({
      fact: `No brand given, and only a ${recall.brand} recall names the ${item.model ?? item.references.find((ref) => codeIn(refs, [ref]))}. Check the brand on the label`,
      matched: false,
      source: "official_data",
    });
    return { verdict: "check_label", recall: { id: recall.id, relation: "match" }, evidence, notes };
  }
  // The brand has a recalled product of exactly this type, but the listing names no model: only the seller can say which.
  const modelUnknown = !item.model && !item.modelVariant && item.references.length === 0 && item.gtin === null;
  if (!identified && !unbranded && brandMatch && modelUnknown && isSpecificType(itemType) && itemType === recallType && photo.sameProduct !== "no") {
    evidence.push({
      fact: `This brand has a recalled ${recallType}. Ask the seller for the exact model`,
      matched: false,
      source: "official_data",
    });
    return { verdict: "check_label", recall: { id: recall.id, relation: "match" }, evidence, notes };
  }

  if (!identified || (photo.sameProduct === "no" && !namedInRecall)) {
    return { verdict: "clear", recall: { id: recall.id, relation: "not_a_match" }, evidence: explained(evidence, recall), notes };
  }

  // A recall is only certain when nothing leaves the product in doubt; otherwise the label has to settle it.
  // Serial numbers are never in a listing, so a recall limited to some of them always needs the label.
  const doubt = photo.sameProduct === "no" || variantInDoubt || specsUnknown || Boolean(recall.unitLimit);
  if (specsUnknown) {
    evidence.push({
      fact: `The recall is for the ${specs.missing.join(" ")} version; the listing doesn't say which version this is`,
      matched: false,
      source: "official_data",
    });
  }
  if (recall.unitLimit) {
    evidence.push({ fact: `Only some units are recalled: “${recall.unitLimit}”`, matched: false, source: "official_data" });
  }
  if (variantInDoubt) {
    evidence.push({
      fact: `The recall names the ${item.model}; it doesn't say whether the ${[item.model, item.modelVariant].join(" ")} is included`,
      matched: false,
      source: "official_data",
    });
  }

  const { from, to, batches } = recallLimits(item, recall);
  const hasRange = from !== null || to !== null;
  const hasBatches = batches.length > 0;

  // No date or batch limit: the model, reference or barcode match is enough.
  if (!hasRange && !hasBatches) {
    if (!recall.unitLimit) evidence.push({ fact: "Every unit of this model is recalled", matched: true, source: "official_data" });
    return { verdict: doubt ? "check_label" : "recalled", recall: { id: recall.id, relation: "match" }, evidence, notes };
  }

  // A batch list is the most precise limit, so it decides on its own; dates only decide when there is none.
  if (hasBatches) {
    if (item.batch !== null) {
      const batchInside = codeIn(batches, [item.batch]);
      evidence.push({
        fact: batchInside ? `Batch ${item.batch} is in the recalled batches` : `Batch ${item.batch} is not in the recalled batches`,
        matched: batchInside,
        source: source("batch"),
      });
      if (batchInside) return { verdict: doubt ? "check_label" : "recalled", recall: { id: recall.id, relation: "match" }, evidence, notes };
      notes.push("This model has a recall for other batches.");
      return { verdict: "clear", recall: { id: recall.id, relation: "other_dates" }, evidence, notes };
    }
    evidence.push({
      fact: "Batch number unknown; the recall covers some batches only",
      matched: false,
      source: "official_data",
    });
    return { verdict: "check_label", recall: { id: recall.id, relation: "match" }, evidence, notes };
  }

  if (item.productionDate !== null) {
    const dateInside = isInRange(item.productionDate, from, to);
    evidence.push({
      fact: `Made ${monthLabel(item.productionDate)}, ${dateInside ? "inside" : "outside"} the recalled period (${rangeLabel(from, to)})`,
      matched: dateInside,
      source: source("productionDate"),
    });
    if (dateInside) return { verdict: doubt ? "check_label" : "recalled", recall: { id: recall.id, relation: "match" }, evidence, notes };
    notes.push(`This model has a recall for units made ${rangeLabel(from, to)}.`);
    return { verdict: "clear", recall: { id: recall.id, relation: "other_dates" }, evidence, notes };
  }

  evidence.push({
    fact: `Production date unknown; the recall covers units made ${rangeLabel(from, to)}`,
    matched: false,
    source: "official_data",
  });
  return { verdict: "check_label", recall: { id: recall.id, relation: "match" }, evidence, notes };
}

const RANK = { recalled: 0, check_label: 1, other_dates: 2, not_a_match: 3, none: 4 } as const;

function rank(result: VerdictResult) {
  if (result.verdict !== "clear") return RANK[result.verdict];
  return result.recall ? RANK[result.recall.relation === "other_dates" ? "other_dates" : "not_a_match"] : RANK.none;
}

// A brandless listing whose model is, or starts with, the recall's brand: "Hoverboard Tilgreen" read with Tilgreen as the
// model, or "Smyths Toys Giro Drive SDrive" read as one model name. The brand part is the brand.
function asBrand(item: ItemFacts, recall: CandidateRecall): ItemFacts {
  if (item.brandNorm !== null || !item.model) return item;
  const name = normalizeText(item.model);
  const brand = [recall.brandCleanNorm, recall.brandNorm].find((value) => value && (name === normalizeText(value) || name.startsWith(`${normalizeText(value)} `)));
  if (!brand) return item;
  const rest = item.model.trim().split(/\s+/).slice(normalizeText(brand).split(" ").length).join(" ");
  return { ...item, brand: item.model.slice(0, item.model.length - rest.length).trim(), brandNorm: brand, model: rest || null };
}

// Two notices about one product share a barcode or a reference.
function sameProduct(a: CandidateRecall, b: CandidateRecall) {
  const gtins = new Set(a.gtins.map(normalizeGtin));
  return b.gtins.some((gtin) => gtins.has(normalizeGtin(gtin))) || codeIn(recallRefs(a).filter(isCode), recallRefs(b));
}

// Decides every candidate and keeps the most serious outcome. On a tie the French notice comes first,
// then similarity order. A matching recall from the other source is kept as a second notice.
export function decideBest({
  item,
  candidates,
  photos,
}: {
  item: ItemFacts;
  candidates: Candidate[];
  photos: ReadonlyMap<string, PhotoComparison>;
}): BestResult {
  if (candidates.length === 0) {
    return { ...decideVerdict({ item, candidate: null, photo: { sameProduct: null } }), alsoMatched: [] };
  }
  // Which brands have a recall naming the listing's model, so an unbranded listing can be tied to one of them.
  const naming = candidates.filter((candidate) => {
    const recall = comparable(candidate.recall);
    return recall.models.some((model) => namesModel(model, recall, item)) || codeIn(recallRefs(recall), item.references);
  });
  const brands = new Set(naming.map((candidate) => comparable(candidate.recall).brandNorm ?? candidate.recall.id));
  const results = candidates.map((candidate) => ({
    recall: candidate.recall,
    source: candidate.recall.source,
    photoSaysNo: photos.get(candidate.recall.id)?.sameProduct === "no",
    result: decideVerdict({
      item: asBrand(item, candidate.recall),
      candidate: { ...candidate, onlyBrandNamingModel: brands.size === 1 && naming.includes(candidate) },
      photo: photos.get(candidate.recall.id) ?? { sameProduct: null },
    }),
  }));
  // On equal verdicts, a recall the photos agree with comes before one they don't. Among near misses the closest
  // is the one that matched most (brand and model named beats brand alone), so every clear names the same one.
  const matchedFacts = (entry: (typeof results)[number]) =>
    entry.result.verdict === "clear" ? entry.result.evidence.filter((fact) => fact.matched).length : 0;
  const order = (entry: (typeof results)[number]) => [
    rank(entry.result),
    -matchedFacts(entry),
    entry.photoSaysNo ? 1 : 0,
    entry.source === "rappelconso" ? 0 : 1,
  ];
  const before = (a: number[], b: number[]) => {
    const i = a.findIndex((value, j) => value !== b[j]);
    return i !== -1 && a[i] < b[i];
  };
  const top = results.reduce((first, entry) => (before(order(entry), order(first)) ? entry : first));
  // An EU alert for "all batches" and a French notice for the same product with a batch or date limit: the French one is
  // more precise, so its "check the label" stands and the alert is shown alongside.
  const precise = top.source === "safetygate" && top.result.verdict === "recalled"
    ? results.find((entry) => entry.source === "rappelconso" && entry.result.verdict === "check_label" && sameProduct(entry.recall, top.recall))
    : undefined;
  const best = precise ?? top;
  if (best.result.verdict === "clear") return { ...best.result, alsoMatched: [] };
  const also = precise
    ? top
    : results.find(
        (entry) =>
          entry.source !== best.source && entry.result.verdict === best.result.verdict && entry.result.recall?.relation === "match",
      );
  return { ...best.result, alsoMatched: also?.result.recall ? [also.result.recall.id] : [] };
}
