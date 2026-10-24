import type { StoredEvidence, StoredExtracted, StoredInput } from "@/lib/check/run";
import { capitalize, titleCase } from "@/lib/check/copy";
import type { StoredLabel } from "@/lib/check/label";
import { getCheck } from "@/lib/db/checks";
import { getRecall, recallStats } from "@/lib/db/recalls";
import { presignedGetUrl } from "@/lib/storage";
import { recallLimits, type Verdict } from "@/lib/verdict";

const CHECKED_AT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const UPDATED_AT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export async function loadCheck(id: string) {
  const check = await getCheck(id);
  if (!check?.verdict) return null;

  const input = check.input as StoredInput;
  const extracted = check.extracted as StoredExtracted;
  const evidence = check.evidence as StoredEvidence;
  const label = check.label as StoredLabel | null;
  const [recall, secondRecall, stats, listingPhoto, labelPhoto] = await Promise.all([
    check.recallId ? getRecall(check.recallId) : undefined,
    evidence.alsoMatched?.[0] ? getRecall(evidence.alsoMatched[0]) : undefined,
    recallStats(),
    input.photoKeys[0] ? presignedGetUrl(input.photoKeys[0]) : (input.page?.image ?? null),
    label ? presignedGetUrl(label.photoKey) : null,
  ]);

  const model = [extracted.model, extracted.modelVariant].filter(Boolean).join(" ");
  const fromRecall = Boolean(input.fromRecall);
  const listingTitle = fromRecall && recall
    ? capitalize(recall.productName)
    : (input.page?.title ?? input.text?.split("\n")[0]?.trim() ?? "Listing photos");
  const searchedFor = [extracted.brand, model].filter(Boolean).join(" ") || null;

  return {
    id: check.id,
    verdict: check.verdict as Verdict,
    flagged: check.flagged,
    checkedAt: CHECKED_AT.format(check.createdAt),
    listingTitle,
    fromRecall,
    listingPhoto,
    extracted,
    evidence,
    searchedFor,
    // How the recalled product is named in prose: the model the listing gave, else the notice's product name.
    productLabel: model ? titleCase(model) : recall ? capitalize(recall.productName) : listingTitle,
    sellerLabel: searchedFor ? titleCase(searchedFor) : listingTitle,
    label,
    labelPhoto,
    recall: recall ?? null,
    secondRecall: secondRecall ?? null,
    limits: recall ? recallLimits(extracted, recall) : null,
    stats: { ...stats, updatedAt: stats.updatedAt ? UPDATED_AT.format(stats.updatedAt).replace(",", "") : null },
  };
}

export type LoadedCheck = NonNullable<Awaited<ReturnType<typeof loadCheck>>>;
