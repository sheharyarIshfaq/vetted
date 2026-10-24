// Lower case, accents removed, punctuation turned into single spaces: "B'TWIN Römer" -> "b twin romer".
export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function normalizeBrand(raw: string, aliases: ReadonlyMap<string, string>) {
  const normalized = normalizeText(raw);
  return aliases.get(normalized) ?? normalized;
}
