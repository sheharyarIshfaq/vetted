import { getRecall, recallStats } from "../db/recalls";
import { downloadImage } from "./images";
import { panelSummary } from "./panel";
import { panelSummaryFr } from "./panel-fr";
import { cachedCheck, checkCacheKey, runCheck, type CheckResult } from "./run";

type Log = (message: string) => void;

export type ListingInput = { title: string; description: string; imageUrls: string[]; pageUrl?: string };

// A listing sent as fields with photo links (the extension, the platform API): checked once a day,
// then summarised for a panel in English and French from the recall's own data.
export async function checkListing(listing: ListingInput, log: Log) {
  const imageUrls = listing.imageUrls.slice(0, 3);
  const text = [listing.title, listing.description].filter(Boolean).join("\n").slice(0, 5000);
  const cacheKey = checkCacheKey([listing.pageUrl, text, ...imageUrls]);
  const result: CheckResult = (await cachedCheck(cacheKey)) ?? (await checkPhotos(text, imageUrls, listing.pageUrl, cacheKey, log));
  const [recall, stats] = await Promise.all([result.recall ? getRecall(result.recall.id) : undefined, recallStats()]);
  const panelInput = {
    verdict: result.verdict,
    recall: recall ?? null,
    evidence: result.evidence,
    extracted: result.extracted,
    listingTitle: listing.title,
    searched: { total: stats.total, sources: stats.sources },
  };
  return { result, recall: recall ?? null, panel: panelSummary(panelInput), panelFr: panelSummaryFr(panelInput) };
}

async function checkPhotos(text: string, imageUrls: string[], pageUrl: string | undefined, cacheKey: string, log: Log) {
  const downloaded = await Promise.all(imageUrls.map((url) => downloadImage(url, { referer: pageUrl, log })));
  const photos = downloaded.filter((photo) => photo !== null);
  return runCheck({ text, photos, unreadPhotos: downloaded.length - photos.length, cacheKey }, log);
}
