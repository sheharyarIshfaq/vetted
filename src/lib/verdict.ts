import type { ModelRange } from "../db/schema";
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
function matchingRange(item: Pick<ItemFacts, "model" | "modelVariant" | "references">, recall: CandidateRecall) {
  const models = itemModels(item);
  return (
    recall.modelRanges.find((range) => models.has(normalizeModel(range.model))) ??
    recall.modelRanges.find((range) => codeIn(range.refs, item.references))
  );
}

export type RecallLimits = { from: string | null; to: string | null; batches: string[]; refs: string[]; model: string | null };

// The date and batch limits that apply to this item: its model's entry if there is one, else the whole recall.
export function recallLimits(
  item: Pick<ItemFacts, "model" | "modelVariant" | "references">,
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
  match: { brandMatch: boolean; modelNameMatch: boolean; refMatch: boolean; modelMatch: boolean },
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
    evidence.push({ fact: `Model ${modelName} is named in the recall`, matched: true, source: "listing_text" });
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
  const models = itemModels(item);
  const modelNameMatch =
    range !== undefined || recall.models.some((model) => models.has(normalizeModel(model)));
  const refMatch = codeIn(recall.refs, item.references);
  const sampleBatchMatch = item.batch !== null && codeIn(recall.sampleBatches, [item.batch]);
  const modelMatch =
    modelNameMatch || refMatch || sampleBatchMatch || candidate.titleSimilarity >= TITLE_MATCH_THRESHOLD;
  // A barcode identifies the product like a model match does; date and batch limits still apply.
  const gtinMatch =
    item.gtin !== null && recall.gtins.some((gtin) => normalizeGtin(gtin) === normalizeGtin(item.gtin!));

  if (gtinMatch) {
    evidence.push({ fact: `Barcode ${item.gtin} is listed in the recall`, matched: true, source: source("gtin") });
  } else {
    evidence.push(...identityEvidence(item, recall, { brandMatch, modelNameMatch, refMatch, modelMatch }));
  }
  if (sampleBatchMatch) {
    evidence.push({ fact: `Batch ${item.batch} is the batch named in the alert`, matched: true, source: source("batch") });
  }

  if (photo.sameProduct === "yes") {
    evidence.push({ fact: "Photos show the same product as the official photo", matched: true, source: "listing_photo" });
  } else if (photo.sameProduct === "no") {
    evidence.push({ fact: "Photos show a different product from the official photo", matched: false, source: "listing_photo" });
  }

  // Without a brand, a similar title proves nothing ("peluche ours"): it takes a barcode, or a shared code and the photos.
  const unbranded = recall.brandNorm === null;
  const identified = unbranded
    ? gtinMatch || (sharedCode(item, recall) && photo.sameProduct === "yes")
    : gtinMatch || (brandMatch && modelMatch);
  if (unbranded && !identified) {
    evidence.push({
      fact: "The recalled product has no brand, so only a barcode, or a matching code and photo, can identify it",
      matched: false,
      source: "official_data",
    });
  }
  if (!identified || photo.sameProduct === "no") {
    return { verdict: "clear", recall: { id: recall.id, relation: "not_a_match" }, evidence, notes };
  }

  const { from, to, batches } = recallLimits(item, recall);
  const hasRange = from !== null || to !== null;
  const hasBatches = batches.length > 0;

  // No date or batch limit: the model, reference or barcode match is enough.
  if (!hasRange && !hasBatches) {
    evidence.push({ fact: "Every unit of this model is recalled", matched: true, source: "official_data" });
    return { verdict: "recalled", recall: { id: recall.id, relation: "match" }, evidence, notes };
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
      if (batchInside) return { verdict: "recalled", recall: { id: recall.id, relation: "match" }, evidence, notes };
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
    if (dateInside) return { verdict: "recalled", recall: { id: recall.id, relation: "match" }, evidence, notes };
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
    result: decideVerdict({ item, candidate, photo: photos.get(candidate.recall.id) ?? { sameProduct: null } }),
  }));
  const order = (entry: (typeof results)[number]) => rank(entry.result) * 2 + (entry.source === "rappelconso" ? 0 : 1);
  const best = results.reduce((top, entry) => (order(entry) < order(top) ? entry : top));
  if (best.result.verdict === "clear") return { ...best.result, alsoMatched: [] };
  const also = results.find(
    (entry) =>
      entry.source !== best.source && entry.result.verdict === best.result.verdict && entry.result.recall?.relation === "match",
  );
  return { ...best.result, alsoMatched: also?.result.recall ? [also.result.recall.id] : [] };
}
