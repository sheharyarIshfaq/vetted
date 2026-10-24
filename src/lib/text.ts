// Lower case, accents removed, punctuation turned into single spaces: "B'TWIN Römer" -> "b twin romer".
export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Words that stand in for a missing brand; an unbranded product must never match on a shared "sans marque".
const NO_BRAND = /^(?:inconnue?s?|unknown|not specified|non (?:specifiee?|definie?|communiquee?|connue?)|sans(?: marques?)?|pas de marque(?: specifique)?|aucune?|no brand|unbranded|n ?a|nc|generi(?:c|que)s?|toutes marques)$/;

export function normalizeBrand(raw: string, aliases: ReadonlyMap<string, string>) {
  const normalized = normalizeText(raw);
  if (!normalized || NO_BRAND.test(normalized)) return null;
  return aliases.get(normalized) ?? normalized;
}
