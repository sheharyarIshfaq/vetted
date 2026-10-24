import type { Recall } from "../../db/schema";
import { insertCheck } from "../db/checks";
import type { StoredCandidate, StoredEvidence, StoredExtracted, StoredInput } from "./run";

// Models a label check can be started for: the recall's own model names and its per-model date ranges.
export function recallModels(recall: Pick<Recall, "models" | "modelRanges">) {
  return [...new Set([...recall.modelRanges.map((range) => range.model), ...recall.models])];
}

// A label settles something when the recall has a date or batch limit, or, when the model alone doesn't
// say which product it is, codes to compare. A single model with no limit is recalled whatever the label says.
export function canCheckLabel(recall: Recall) {
  const hasLimits = Boolean(recall.productionFrom || recall.productionTo || recall.batches.length || recall.modelRanges.length);
  const hasCodes = recall.refs.length > 0 || recall.gtins.length > 0;
  return hasLimits || (hasCodes && recallModels(recall).length !== 1);
}

// Starts a check from a recall page, without a listing: the owner says which recall it is, the label decides.
// The model is only taken when there is no doubt which one it is, so other models' dates never apply.
export async function startLabelCheck(recall: Recall, model: string | null) {
  const models = recallModels(recall);
  const chosen = model && models.includes(model) ? model : models.length === 1 ? models[0] : null;
  const input: StoredInput = { text: null, url: null, page: null, photoKeys: [], fromRecall: recall.id };
  const extracted: StoredExtracted = {
    category: null,
    brand: recall.brand,
    brandNorm: recall.brandNorm,
    model: chosen,
    modelVariant: null,
    references: [],
    gtin: null,
    batch: null,
    productionDate: null,
    labelTextSeen: null,
    confidence: 1,
    quotes: [],
    sources: {},
  };
  const candidates: StoredCandidate[] = [{ recallId: recall.id, titleSimilarity: 0, brandSimilarity: 1, photo: null }];
  const evidence: StoredEvidence = {
    items: [{ fact: "Started from the recall page, so the label decides", matched: false, source: "official_data" }],
    notes: [],
    relation: "match",
    alsoMatched: [],
  };
  return insertCheck({ input, extracted, candidates, verdict: "check_label", recallId: recall.id, evidence });
}
