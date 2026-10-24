// Lower case, accents removed, punctuation turned into single spaces: "B'TWIN Römer" -> "b twin romer".
export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", vi: "6", vii: "7", viii: "8", ix: "9" };

// normalizeText with Roman numerals as digits, for model names and codes: "Smile III" -> "smile 3".
// Single-letter numerals are left alone: they are too ambiguous.
export function normalizeModelText(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((word) => ROMAN[word] ?? word)
    .join(" ");
}

// Words that stand in for a missing brand; an unbranded product must never match on a shared "sans marque".
const NO_BRAND = /^(?:inconnue?s?|unknown|not specified|non (?:specifiee?|definie?|communiquee?|connue?)|sans(?: marques?)?|pas de marque(?: specifique)?|aucune?|no brand|unbranded|n ?a|nc|generi(?:c|que)s?|toutes marques)$/;

export function normalizeBrand(raw: string, aliases: ReadonlyMap<string, string>) {
  const normalized = normalizeText(raw);
  if (!normalized || NO_BRAND.test(normalized)) return null;
  // "Btwin / Decathlon": a listing naming a sub-brand and its maker counts as the known one.
  const parts = raw.split(/\s*[/,&+]\s*/).map(normalizeText).filter(Boolean);
  const known = parts.length > 1 ? parts.find((part) => aliases.has(part)) : undefined;
  return aliases.get(normalized) ?? (known ? aliases.get(known)! : normalized);
}
