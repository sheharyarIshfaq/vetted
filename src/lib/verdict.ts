import type { ModelRange } from "../db/schema";
import { productType, typesConflict } from "./product-type";
import { normalizeModelText } from "./text";

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
  category?: string | null; // the product type read from the listing
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
};

export type Candidate = {
  recall: CandidateRecall;
  titleSimilarity: number; // pg_trgm similarity between the listing and the recall's search text
  brandSimilarity: number;
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
  const wanted = [...words(modelName(recallModel))].filter((word) => !FILLER.has(word) && !GENERIC.has(word) && !brand.has(word));
  const model = words([item.model, item.modelVariant].filter(Boolean).join(" "));
  const title = words(item.title);
  // A short number in a title may be anything ("0-4 ans"); a long one is a spec ("20000").
  const fromTitle = (word: string) => title.has(word) && (!/\d/.test(word) || /^\d{4,}$/.test(word));
  return wanted.length > 0 && wanted.every((word) => model.has(word) || fromTitle(word));
}

type ModelFacts = Pick<ItemFacts, "model" | "modelVariant" | "references" | "title">;

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
  if (exactCode || !item.model || !item.modelVariant) return false;
  const recallWords = words([recall.productName, ...recall.models, ...recall.refs, ...recall.modelRanges.map((r) => r.model)].join(" "));
  const brand = words(recall.brandNorm);
  const variant = [...words(item.modelVariant)].filter((word) => !FILLER.has(word) && !brand.has(word));
  return variant.length > 0 && variant.some((word) => !recallWords.has(word));
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

  const { recall } = candidate;
  if (photo.officialPhotoUnavailable) {
    evidence.push({ fact: "Official photo unavailable", matched: false, source: "official_data" });
  }

  const brandMatch =
    item.brandNorm !== null &&
    (item.brandNorm === recall.brandNorm || candidate.brandSimilarity >= BRAND_MATCH_THRESHOLD);
  const range = matchingRange(item, recall);
  const refs = recallRefs(recall);
  // Safety Gate often gives the model only as the type reference ("V8"), so a listing's model can name it there too.
  const models = itemModels(item);
  const modelNameMatch =
    range !== undefined ||
    recall.models.some((model) => namesModel(model, recall, item)) ||
    refs.some((ref) => models.has(normalizeModel(ref)));
  const refMatch = codeIn(refs, item.references);
  const sampleBatchMatch = item.batch !== null && codeIn(recall.sampleBatches, [item.batch]);
  // A close title stands in for the model only when the listing and the recall don't name different models.
  const otherModel = models.size > 0 && recall.models.length > 0 && !modelNameMatch;
  const modelMatch =
    modelNameMatch ||
    refMatch ||
    sampleBatchMatch ||
    (!otherModel && candidate.titleSimilarity >= TITLE_MATCH_THRESHOLD);
  // Clearly different product types rule a match out: the Breeze stroller is not the Breeze car seat.
  const itemType = productType(item.category ?? null) ?? productType(item.title ?? null);
  const recallType = productType(recall.productName);
  const otherType = typesConflict(itemType, recallType);
  // A barcode identifies the product like a model match does; date and batch limits still apply.
  const gtinMatch =
    item.gtin !== null && recall.gtins.some((gtin) => normalizeGtin(gtin) === normalizeGtin(item.gtin!));
  const variantInDoubt = unnamedVariant(item, recall, gtinMatch || refMatch);

  if (gtinMatch) {
    evidence.push({ fact: `Barcode ${item.gtin} is listed in the recall`, matched: true, source: source("gtin") });
  } else {
    evidence.push(...identityEvidence(item, recall, { brandMatch, modelNameMatch, refMatch, modelMatch, variantInDoubt }));
    if (otherType) {
      evidence.push({ fact: `The recall is for a ${recallType}, this is a ${itemType}`, matched: false, source: "listing_text" });
    }
  }
  if (sampleBatchMatch) {
    evidence.push({ fact: `Batch ${item.batch} is the batch named in the alert`, matched: true, source: source("batch") });
  }

  // The listing names the recalled brand and model, or its barcode or reference: photos alone can't overrule that.
  const namedInRecall = gtinMatch || (brandMatch && (modelNameMatch || refMatch || sampleBatchMatch) && !otherType);
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
  const unbranded = recall.brandNorm === null;
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
  // The brand has a recalled product of exactly this type, but the listing names no model: only the seller can say which.
  const modelUnknown = !item.model && !item.modelVariant && item.references.length === 0 && item.gtin === null;
  if (!identified && !unbranded && brandMatch && modelUnknown && itemType !== null && itemType === recallType && photo.sameProduct !== "no") {
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
  const doubt = photo.sameProduct === "no" || variantInDoubt;
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
    evidence.push({ fact: "Every unit of this model is recalled", matched: true, source: "official_data" });
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
  const results = candidates.map((candidate) => ({
    source: candidate.recall.source,
    photoSaysNo: photos.get(candidate.recall.id)?.sameProduct === "no",
    result: decideVerdict({ item, candidate, photo: photos.get(candidate.recall.id) ?? { sameProduct: null } }),
  }));
  // On equal verdicts, a recall the photos agree with comes before one they don't.
  const order = (entry: (typeof results)[number]) =>
    rank(entry.result) * 4 + (entry.photoSaysNo ? 2 : 0) + (entry.source === "rappelconso" ? 0 : 1);
  const best = results.reduce((top, entry) => (order(entry) < order(top) ? entry : top));
  if (best.result.verdict === "clear") return { ...best.result, alsoMatched: [] };
  const also = results.find(
    (entry) =>
      entry.source !== best.source && entry.result.verdict === best.result.verdict && entry.result.recall?.relation === "match",
  );
  return { ...best.result, alsoMatched: also?.result.recall ? [also.result.recall.id] : [] };
}
