import { normalizeText } from "./text";

// RappelConso picks the steps for consumers from a fixed list, so each one has a fixed English wording.
const REMEDIES: Record<string, string> = {
  "ne plus utiliser le produit": "Stop using the product",
  "rapporter le produit au point de vente": "Return the product to the shop",
  "contacter le point de vente": "Contact the shop",
  "contacter le service consommateur": "Contact customer service",
  "detruire le produit": "Destroy the product",
  "ne plus consommer": "Do not consume the product",
};

// A step in English when it is one from the list; anything else is shown as published.
export function remedyInEnglish(line: string) {
  return REMEDIES[normalizeText(line)] ?? line;
}

// "inférieur ou égal à 2105" -> "up to 2105", "de 180100001 à 180100045" -> "180100001 to 180100045".
export function batchInEnglish(value: string) {
  const text = value.trim();
  if (/^tous les lots$/i.test(text)) return "all batches";
  const upTo = /^inf[ée]rieur(?:e)?\s+ou\s+[ée]gale?\s+(?:à|au)\s*(.+)$/i.exec(text);
  if (upTo) return `up to ${upTo[1].trim()}`;
  const range = /^(?:de|du)\s+(\S+?)\s*(?:à|au|-)\s*(\S+)$/i.exec(text);
  if (range) return `${range[1]} to ${range[2]}`;
  return text;
}
