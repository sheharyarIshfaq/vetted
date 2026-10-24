import type { ModelRange } from "../db/schema";
import { normalizeText } from "./text";

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
  brand: string | null;
  brandNorm: string | null;
  productName: string;
  models: string[];
  refs: string[];
  gtins: string[];
  batches: string[];
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

const TITLE_MATCH_THRESHOLD = 0.55;
const BRAND_MATCH_THRESHOLD = 0.6;

const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", vi: "6", vii: "7", viii: "8", ix: "9" };

// "Smile III" and "smile-3" both become "smile3". Single-letter numerals are left alone: they are too ambiguous.
export function normalizeModel(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((word) => ROMAN[word] ?? word)
    .join("");
}

export function normalizeCode(value: string) {
  return normalizeText(value).replaceAll(" ", "");
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
  const modelMatch = modelNameMatch || refMatch || candidate.titleSimilarity >= TITLE_MATCH_THRESHOLD;
  // A barcode identifies the product like a model match does; date and batch limits still apply.
  const gtinMatch =
    item.gtin !== null && recall.gtins.some((gtin) => normalizeGtin(gtin) === normalizeGtin(item.gtin!));

  if (gtinMatch) {
    evidence.push({ fact: `Barcode ${item.gtin} is listed in the recall`, matched: true, source: source("gtin") });
  } else {
    evidence.push(...identityEvidence(item, recall, { brandMatch, modelNameMatch, refMatch, modelMatch }));
  }

  if (photo.sameProduct === "yes") {
    evidence.push({ fact: "Photos show the same product as the official photo", matched: true, source: "listing_photo" });
  } else if (photo.sameProduct === "no") {
    evidence.push({ fact: "Photos show a different product from the official photo", matched: false, source: "listing_photo" });
  }

  const identified = gtinMatch || (brandMatch && modelMatch);
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

  const batchKnown = hasBatches && item.batch !== null;
  const batchInside = batchKnown && codeIn(batches, [item.batch!]);
  const dateKnown = hasRange && item.productionDate !== null;
  const dateInside = dateKnown && isInRange(item.productionDate!, from, to);

  if (batchKnown) {
    evidence.push({
      fact: batchInside ? `Batch ${item.batch} is in the recalled batches` : `Batch ${item.batch} is not in the recalled batches`,
      matched: batchInside,
      source: source("batch"),
    });
  }
  if (dateKnown) {
    evidence.push({
      fact: `Made ${monthLabel(item.productionDate!)}, ${dateInside ? "inside" : "outside"} the recalled period (${rangeLabel(from, to)})`,
      matched: dateInside,
      source: source("productionDate"),
    });
  }

  if (batchInside || dateInside) {
    return { verdict: "recalled", recall: { id: recall.id, relation: "match" }, evidence, notes };
  }
  if (batchKnown || dateKnown) {
    notes.push(
      hasRange
        ? `This model has a recall for units made ${rangeLabel(from, to)}.`
        : "This model has a recall for other batches.",
    );
    return { verdict: "clear", recall: { id: recall.id, relation: "other_dates" }, evidence, notes };
  }

  evidence.push({
    fact: hasRange
      ? `Production date unknown; the recall covers units made ${rangeLabel(from, to)}`
      : "Batch number unknown; the recall covers some batches only",
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

// Decides every candidate and keeps the most serious outcome; candidates come in similarity order, which breaks ties.
export function decideBest({
  item,
  candidates,
  photos,
}: {
  item: ItemFacts;
  candidates: Candidate[];
  photos: ReadonlyMap<string, PhotoComparison>;
}): VerdictResult {
  if (candidates.length === 0) return decideVerdict({ item, candidate: null, photo: { sameProduct: null } });
  return candidates
    .map((candidate) =>
      decideVerdict({ item, candidate, photo: photos.get(candidate.recall.id) ?? { sameProduct: null } }),
    )
    .reduce((best, result) => (rank(result) < rank(best) ? result : best));
}
