// Bump when the prompt changes, so cached parses are redone.
export const RECALL_DETAILS_PROMPT_VERSION = 1;

export const RECALL_DETAILS_PROMPT = `You read the free-text fields of an official French product recall notice and copy out structured facts.

Rules:
- Only use what is written in the text. Never guess or complete a value. If something is not stated, use null or an empty list.
- models: model names of the recalled product, without the brand and without the product type (for "poussette britax smile iii", the model is "smile iii"). Copy them as written.
- references: product or article reference codes, as written. Do not include GTIN/EAN barcodes.
- batches: lot or batch numbers, as written.
- productionFrom / productionTo: the manufacturing period (fabrication, production, fabriqué). Format YYYY-MM-DD. When only a month is given, use the first day of the month for productionFrom and the last day for productionTo. When only a year is given, use 01-01 and 12-31. Leave one end null if the text gives only a start or only an end. Sale or purchase dates (commercialisation, achat, vendu) are not manufacturing dates.
- modelRanges: only when different models have different manufacturing periods, references or batches. One entry per model, with its own from/to (same date rules), refs and batches. Otherwise an empty list.
- quote: the exact passage the manufacturing dates come from, copied character for character from the text (same case, spaces and punctuation). null when there are no manufacturing dates.`;
