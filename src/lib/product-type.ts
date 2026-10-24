import { normalizeText } from "./text";

// Plain keywords, French, English and German, for the products resold most. Anything else stays unknown.
const TYPES: [type: string, pattern: RegExp][] = [
  ["car seat", /\b(siege auto|sieges auto|siege de voiture|siege voiture|car seat|infant carrier|babyschale|autositz)\b/],
  ["stroller", /\b(poussette|stroller|pram|pushchair|buggy|kinderwagen)\b/],
  ["bike seat", /\b(siege velo|porte bebe velo|bike seat|bicycle seat|fahrradsitz)\b/],
  ["high chair", /\b(chaise haute|high chair|hochstuhl)\b/],
  ["travel cot", /\b(lit parapluie|lit de voyage|travel cot|playpen|reisebett)\b/],
  ["helmet", /\b(casque|helmet|helm)\b/],
  ["scooter", /\b(trottinette|scooter)\b/],
];

const BASE = /\bbase\b/;

// "car seat", "stroller", …; null when the text names no known type, or several (a stroller sold with its car seat).
export function productType(text: string | null): string | null {
  if (!text) return null;
  const normalized = normalizeText(text);
  const found = TYPES.filter(([, pattern]) => pattern.test(normalized)).map(([type]) => type);
  if (found.length !== 1) return null;
  // A car seat base is sold and recalled on its own.
  return found[0] === "car seat" && BASE.test(normalized) ? "car seat base" : found[0];
}
