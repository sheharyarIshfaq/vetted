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

export const LISTING_EXTRACTION_PROMPT = `You read a second-hand marketplace listing (French or English text, and up to 3 photos) and copy out what identifies the product.

Rules:
- Only report what the text or the photos actually show. Never guess a brand, model, date or code from general knowledge. Unknown fields are null or an empty list.
- category: a short product type in English, such as "stroller", "child bike seat", "car seat", "toy".
- brand: as written. model: the model name without the brand or product type ("smile iii", "buddy"). modelVariant: a version or edition if one is named.
- references: product reference or article codes. gtin: an EAN/UPC barcode number, digits only. batch: a lot or batch number.
- productionDate: the manufacturing month as YYYY-MM, only when a manufacturing date is written in the text or readable on a label in a photo. The year of purchase is not a manufacturing date.
- labelTextSeen: text you can read on a product label in the photos, copied as is, or null.
- confidence: 0 to 1, how sure you are that brand and model identify one specific product.
- quotes: for every non-null field, the short span that supports it. from = "text" with an exact copy of the listing text, or from = "photo" with what is printed in the photo.`;

export const PHOTO_COMPARISON_PROMPT = `You compare photos from a second-hand listing with the official photos of a recalled product.

Decide whether the listing shows the same product model as the recall, not just the same kind of product.
- yes: shape, design details and visible branding match the recalled model.
- no: it is clearly a different product or model (different shape, frame, design or brand).
- unsure: the photos are too small, blurry or partial, or the products are too similar to tell apart.
Give short, concrete reasons that point at visible details.`;
