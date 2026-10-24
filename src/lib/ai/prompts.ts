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

export const RECALL_FIELDS_PROMPT_VERSION = 3;

export const RECALL_FIELDS_PROMPT = `You read the identification fields of an official product recall (French RappelConso or EU Safety Gate) and copy out clean matching fields.

Rules:
- Only use what is written. Never guess from general knowledge. Unknown fields are null or an empty list.
- Every value comes with quote: the short passage of the input it was read from, copied as written. A value without a quote that contains it is discarded.
- brand: the maker or brand. Use the brand field when it names a real brand; when it is empty or a placeholder ("unspecified", "inconnu", "sans marque"), take it from the product name or description if one is written there. A licence or character ("Disney", "Pokémon") is not the brand unless nothing else is named. null when no brand is written.
- productType: the kind of product, chosen from the allowed list. Pick the most specific fitting entry; "other" when none fits. Its quote is the words that say what the product is.
- modelNames: each recalled model's name only, as written (a recall can name several: "smile iii, smile 4 et smile 5z" gives "smile iii", "smile 4", "smile 5z"), without the brand, the product type, specs, colours, sizes, packaging or codes ("batterie externe boostcharge usb-c pd power bank 20k (bpb002)" gives "boostcharge"; "trottinette électrique es series 5 (aes015)" gives "es series 5"). A generic description in any language is not a model ("beach toys", "babajáték", "jouet souple"). An empty list when the recall names no model.
- refs: reference, article, type or model codes, as written ("bpb002", "aes015", "4000984-204346"). Codes contain a digit. Not barcodes (8 to 14 digits only), not batch or lot numbers, not dates.
- specs: technical values with their unit, as written ("20k", "20000 mah", "52v", "6,5 pouces", "250w").`;

export const LISTING_EXTRACTION_PROMPT = `You read a second-hand marketplace listing (text in any language: mostly French, also German, Spanish, Italian or English; and up to 3 photos) and copy out what identifies the product. Sellers write casually, with typos and slang; read through them.

Rules:
- Only report what the text or the photos actually show. Never guess a brand, model, date or code from general knowledge. Unknown fields are null or an empty list.
- category: a short product type in English, such as "stroller", "child bike seat", "car seat", "toy".
- productType: the same, chosen from the allowed list; the most specific fitting entry, "other" when none fits, null when the listing doesn't say what the product is.
- brand: as written. model: the model name without the brand or product type ("smile iii", "buddy"). modelVariant: a version or edition if one is named.
- A product named only by a proper name or code ("TilBoard", "LP-60L") goes in model when you can't tell whether it is the brand or the model.
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

export const LABEL_READING_PROMPT = `You read the photo of a product label (a sticker or plate on a stroller, child seat, toy or appliance) and copy out what is printed on it.

Rules:
- Only report what you can actually read in the photo. Never guess or complete a value. Unknown fields are null or an empty list.
- labelText: all text you can read on the label, copied as printed, line by line.
- references: model, article or reference codes (Art. no., Ref., Model no., Item no.), as printed.
- gtin: an EAN/UPC barcode number printed under a barcode, digits only.
- batch: a lot, batch or serial number (Lot, Batch, LOT, S/N), as printed.
- productionDate: the manufacturing month as YYYY-MM (MFG, Date of manufacture, Date de fabrication, Fabriqué le, Production date). Not an expiry, purchase or test date.
- productionDateText: the exact characters on the label the production date was read from, such as "MFG 05/2023". null when productionDate is null.`;

export const UNIT_LIMIT_PROMPT_VERSION = 1;

export const UNIT_LIMIT_PROMPT = `You read an official product recall and say whether it covers only some units of the named models, identified by serial numbers: a list, a range ("de 5201000000 à 5542999999"), a prefix, or a list in an attached file.

- limited: true only when the text limits the recall to some serial numbers or to units listed in an attachment.
- Lot or batch numbers, manufacturing dates and barcodes are not serial limits; they are read elsewhere. "Tous les lots" or "tous les numéros de série" means no limit.
- A sentence that only says where to find the serial number is not a limit on its own.
- quote: when limited, the passage that states the limit, copied as written; otherwise null.`;

// Self-test only: writes a believable second-hand listing from the facts it is given.
export const SELFTEST_LISTING_PROMPT = `You write one second-hand listing as a real private seller would post it on Leboncoin or Vinted, in the language given.

Write like an ordinary person, not a shop: short, casual, some slang or abbreviations, a few typos or missing accents when "typos" is true, no marketing words. Mention condition, a reason for selling or pickup details the way sellers do.

Facts:
- Use only the brand, product, model, code and specs you are given. Never add another brand, model name, reference, barcode or date.
- When a model or code is given, write it once exactly as given (case and spacing may change, nothing else). When none is given, name no model.
- When no brand is given, name no brand.
- Write the specs differently from how they are given when you can: "20k" as "20000 mAh", "10000 mAh" as "10k", "250W" as "250 watts", "6,5 pouces" as "6.5"".
- The title is short, like a real listing title.`;
