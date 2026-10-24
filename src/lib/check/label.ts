import { randomUUID } from "node:crypto";
import { zodTextFormat } from "openai/helpers/zod";
import { LABEL_READING_PROMPT } from "../ai/prompts";
import { labelReadingSchema, type LabelReading } from "../ai/schemas";
import { getCheck, updateCheck } from "../db/checks";
import { getRecalls } from "../db/recalls";
import { isValidGtin } from "../gtin";
import { openai, openaiModel } from "../openai";
import { uploadObject } from "../storage";
import { normalizeText } from "../text";
import { decideBest, type Candidate, type PhotoComparison, type Verdict } from "../verdict";
import { findCandidates } from "./candidates";
import { prepareImage, toDataUrl } from "./images";
import { CheckInputError, toItemFacts, type StoredCandidate, type StoredEvidence, type StoredExtracted } from "./run";

// Labels have small print, so they keep more pixels than listing photos.
const LABEL_SIDE = 2048;

export type LabelFacts = { references: string[]; gtin: string | null; batch: string | null; productionDate: string | null };
export type StoredLabel = { photoKey: string; read: LabelFacts; text: string | null };

async function readLabel(photo: Buffer) {
  const response = await openai().responses.parse({
    model: openaiModel(),
    instructions: LABEL_READING_PROMPT,
    input: [{ role: "user", content: [{ type: "input_image", detail: "high", image_url: toDataUrl(photo) }] }],
    text: { format: zodTextFormat(labelReadingSchema, "label_reading") },
  });
  return labelReadingSchema.parse(response.output_parsed);
}

// Keeps only what is printed on the label: codes must appear in the text read from it, a date must come
// with the characters it was read from, and a barcode needs a valid check digit.
export function groundLabel(raw: LabelReading): LabelFacts {
  const text = normalizeText(raw.labelText ?? "");
  const compact = text.replaceAll(" ", "");
  const onLabel = (value: string) => {
    const normalized = normalizeText(value);
    return normalized !== "" && (text.includes(normalized) || compact.includes(normalized.replaceAll(" ", "")));
  };

  const references = [...new Set(raw.references.map((ref) => ref.trim()))].filter((ref) => ref && onLabel(ref));
  const gtin = raw.gtin?.replace(/\D/g, "") ?? "";
  const batch = raw.batch?.trim() ?? "";
  const date = raw.productionDate?.trim() ?? "";
  const dateText = raw.productionDateText?.trim() ?? "";
  const dateRead =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(date) && onLabel(dateText) && dateText.includes(date.slice(2, 4));

  return {
    references,
    gtin: isValidGtin(gtin) ? gtin : null,
    batch: batch && onLabel(batch) ? batch : null,
    productionDate: dateRead ? date : null,
  };
}

// The label is the better source, so its values replace what the listing said.
export function mergeLabel(extracted: StoredExtracted, read: LabelFacts): StoredExtracted {
  const sources = { ...extracted.sources };
  if (read.references.length) sources.references = "label_photo";
  if (read.gtin) sources.gtin = "label_photo";
  if (read.batch) sources.batch = "label_photo";
  if (read.productionDate) sources.productionDate = "label_photo";
  return {
    ...extracted,
    references: [...new Set([...extracted.references, ...read.references])],
    gtin: read.gtin ?? extracted.gtin,
    batch: read.batch ?? extracted.batch,
    productionDate: read.productionDate ?? extracted.productionDate,
    sources,
  };
}

type Log = (message: string) => void;

// Reads the label photo, runs the verdict again with what it shows and saves the result on the check.
// Returns null when the check doesn't exist.
export async function runLabelCheck(id: string, bytes: Uint8Array, log: Log = () => {}): Promise<{ verdict: Verdict } | null> {
  const check = await getCheck(id);
  if (!check) return null;
  if (check.verdict !== "check_label") throw new CheckInputError("This check doesn't need a label photo.");

  let photo: Buffer;
  try {
    photo = await prepareImage(bytes, LABEL_SIDE);
  } catch {
    throw new CheckInputError("The photo could not be read. Try a JPEG or PNG.");
  }

  const started = performance.now();
  const photoKey = `labels/${randomUUID()}.jpg`;
  const [raw] = await Promise.all([readLabel(photo), uploadObject(photoKey, photo, "image/jpeg")]);
  const read = groundLabel(raw);
  log(`[label] read ${Math.round(performance.now() - started)}ms`);
  if (!read.references.length && !read.gtin && !read.batch && !read.productionDate) {
    throw new CheckInputError(
      "Tiko couldn't read a production date, batch number or code on this label. Try a closer, sharper photo in good light.",
    );
  }

  const extracted = mergeLabel(check.extracted as StoredExtracted, read);
  const listed = (check.candidates ?? []) as StoredCandidate[];
  // The recall the check already matched must be decided again, never dropped.
  const stored =
    check.recallId && !listed.some((candidate) => candidate.recallId === check.recallId)
      ? [{ recallId: check.recallId, titleSimilarity: 0, brandSimilarity: 0, photo: null }, ...listed]
      : listed;
  const [recalls, barcodeHits] = await Promise.all([
    getRecalls(stored.map((candidate) => candidate.recallId)),
    read.gtin ? findCandidates({ brandNorm: extracted.brandNorm, model: null, gtin: read.gtin, searchText: "" }) : [],
  ]);
  const byId = new Map(recalls.map((recall) => [recall.id, recall]));
  const known = new Set(stored.map((candidate) => candidate.recallId));
  const newHits = barcodeHits.filter((hit) => !known.has(hit.recall.id));

  // A recall found by the label's barcode goes first; the listing's candidates keep their order.
  const candidates: Candidate[] = [
    ...newHits,
    ...stored.flatMap(({ recallId, titleSimilarity, brandSimilarity }) => {
      const recall = byId.get(recallId);
      return recall ? [{ recall, titleSimilarity, brandSimilarity }] : [];
    }),
  ];
  const photos = new Map<string, PhotoComparison>(
    stored.flatMap((candidate) => (candidate.photo ? [[candidate.recallId, candidate.photo] as const] : [])),
  );
  const result = decideBest({ item: toItemFacts(extracted, extracted.brandNorm), candidates, photos });

  const evidence: StoredEvidence = { items: result.evidence, notes: result.notes, relation: result.recall?.relation ?? null };
  const label: StoredLabel = { photoKey, read, text: raw.labelText?.trim() || null };
  await updateCheck(id, {
    extracted,
    candidates: [
      ...newHits.map(({ recall, titleSimilarity, brandSimilarity }) => ({ recallId: recall.id, titleSimilarity, brandSimilarity, photo: null })),
      ...stored,
    ],
    verdict: result.verdict,
    recallId: result.recall?.id ?? null,
    evidence,
    label,
  });
  log(`[label] ${check.verdict} → ${result.verdict}`);
  return { verdict: result.verdict };
}
