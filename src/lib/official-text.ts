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

// Every risk the two sources use, in the panel's short English. Keys are lower case, as published.
const RISKS: Record<string, string> = {
  "risque chimique": "chemical",
  chimique: "chemical",
  "autres contaminants chimiques": "other chemical contaminants",
  étouffement: "choking",
  blessures: "injury",
  "dommages internes": "internal injury",
  "choc électrique": "electric shock",
  environnement: "environmental",
  "risque environnemental": "environmental",
  incendie: "fire",
  explosion: "explosion",
  brûlures: "burn",
  etranglement: "strangulation",
  étranglement: "strangulation",
  strangulation: "strangulation",
  "risque sanitaire/autre": "health risk",
  "autre risque": "other risk",
  sécurité: "safety",
  "arrêt respiratoire": "breathing stopping",
  suffocation: "suffocation",
  asphyxie: "asphyxiation",
  intoxication: "poisoning",
  "dommages à la vue": "eye damage",
  "dommage à la vue": "eye damage",
  "lésions auditives": "hearing damage",
  "lésion auditive": "hearing damage",
  coincement: "entrapment",
  piégeage: "entrapment",
  coupures: "cuts",
  noyade: "drowning",
  radiation: "radiation",
  "perturbation électromagnétique": "electromagnetic interference",
  "risque microbiologique": "microbiological",
  "autres contaminants biologiques": "other biological contaminants",
  "listeria monocytogenes (agent responsable de la listériose)": "listeria",
  "salmonella spp (agent responsable de la salmonellose)": "salmonella",
  "dépassement de seuils de sécurité": "over the safety limits",
  "additifs et arômes dépassement des seuils de sécurité": "additives or flavourings over the safety limits",
  "dépassement des limites autorisées de pesticides": "pesticides over the legal limits",
  "eléments traces métalliques (métaux lourds : plomb, mercure, cadmium...)": "heavy metals (lead, mercury, cadmium…)",
  "présence de substance interdite": "banned substance",
  "substances allergisantes non déclarées": "undeclared allergens",
  "anomalie d'étiquetage": "labelling error",
  "inertes (verre, métal, plastique, papier, textile…)": "foreign bodies (glass, metal, plastic, paper, textile…)",
  "défaut de fabrication, défaut d'étanchéité (ex: micro fuites, thermoscellage défectueux) ou anomalies de conditionnement":
    "manufacturing, sealing or packaging fault",
  "reizung und verätzung ggfs. der augen": "irritation and chemical burns, possibly of the eyes",
};

// Safety Gate lists risks as "Risque chimique, Environnement", RappelConso as "étouffement|risque chimique".
// A comma inside a risk ("plomb, mercure") is not followed by a capital, so it doesn't split.
export function riskTerms(risk: string) {
  const terms = risk
    .split(/\s*\|\s*|,\s+(?=\p{Lu})/u)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(terms)];
}

// Each risk in English; one without an English label is shown as published rather than dropped.
export function risksInEnglish(risk: string) {
  return [...new Set(riskTerms(risk).map((term) => RISKS[term] ?? term))];
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

// All the steps as one phrase, "stop using the product and contact the shop", or null when one isn't on the list.
export function remediesPhrase(whatToDo: string | null) {
  const steps = (whatToDo ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => REMEDIES[normalizeText(line)]);
  if (steps.length === 0 || steps.some((step) => !step)) return null;
  const lower = steps.map((step) => step[0].toLowerCase() + step.slice(1));
  return lower.length === 1 ? lower[0] : `${lower.slice(0, -1).join(", ")} and ${lower.at(-1)}`;
}
