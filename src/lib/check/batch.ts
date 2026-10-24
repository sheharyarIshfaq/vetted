import { mapWithConcurrency } from "../ingest/concurrency";
import type { Verdict } from "../verdict";
import { downloadImage } from "./images";
import { CheckInputError, runCheck } from "./run";

export const MAX_BATCH_ROWS = 200;
const CONCURRENCY = 4;
const MAX_TEXT = 5000;

export class BatchInputError extends Error {}

export type BatchRow = { line: number; title: string; description: string; imageUrl: string | null };

// RFC 4180 fields: quotes around a field allow commas, line breaks and "" for a quote.
function parseRecords(text: string, delimiter: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}

const COLUMNS = { title: ["title", "titre"], description: ["description"], imageUrl: ["image_url", "image", "photo", "image url"] };

// Spreadsheets in France often export with ";", so the header line decides the delimiter.
export function parseBatchCsv(raw: string): BatchRow[] {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const header = text.slice(0, text.search(/\n|$/));
  const delimiter = [",", ";", "\t"].reduce((best, candidate) => (header.split(candidate).length > header.split(best).length ? candidate : best));
  const [names = [], ...records] = parseRecords(text, delimiter);
  const normalized = names.map((name) => name.trim().toLowerCase());
  const index = (aliases: string[]) => normalized.findIndex((name) => aliases.includes(name));
  const columns = { title: index(COLUMNS.title), description: index(COLUMNS.description), imageUrl: index(COLUMNS.imageUrl) };
  if (columns.title === -1 && columns.description === -1) {
    throw new BatchInputError("The first line must name the columns: title, description, image_url.");
  }

  const rows: BatchRow[] = [];
  records.forEach((record, i) => {
    const value = (column: number) => (column === -1 ? "" : (record[column] ?? "").trim());
    const title = value(columns.title);
    const description = value(columns.description);
    if (!title && !description) return;
    const image = value(columns.imageUrl);
    rows.push({ line: i + 2, title, description, imageUrl: /^https:\/\/\S+$/.test(image) ? image : null });
  });
  if (rows.length === 0) throw new BatchInputError("The file has no listings under the header line.");
  if (rows.length > MAX_BATCH_ROWS) throw new BatchInputError(`Send at most ${MAX_BATCH_ROWS} listings at a time.`);
  return rows;
}

export type BatchResult = {
  line: number;
  title: string;
  checkId: string | null;
  verdict: Verdict | null;
  recall: { id: string; sourceRef: string; productName: string; relation: string } | null;
  error: string | null;
};

// Each row is a full check, saved like any other, so its result page can be opened from the queue.
export async function runBatch(rows: BatchRow[], onResult: (result: BatchResult) => void, log: (message: string) => void = () => {}) {
  await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    const base = { line: row.line, title: row.title || row.description.slice(0, 80) };
    try {
      const photo = row.imageUrl ? await downloadImage(row.imageUrl) : null;
      const text = [row.title, row.description].filter(Boolean).join("\n").slice(0, MAX_TEXT);
      const check = await runCheck({ text, photos: photo ? [photo] : [] }, log);
      onResult({
        ...base,
        checkId: check.id,
        verdict: check.verdict,
        recall: check.recall
          ? { id: check.recall.id, sourceRef: check.recall.sourceRef, productName: check.recall.productName, relation: check.recall.relation }
          : null,
        error: null,
      });
    } catch (error) {
      const message = error instanceof CheckInputError ? error.message : "This listing could not be checked.";
      log(`[batch] line ${row.line} failed: ${error instanceof Error ? error.message : String(error)}`);
      onResult({ ...base, checkId: null, verdict: null, recall: null, error: message });
    }
  });
}
