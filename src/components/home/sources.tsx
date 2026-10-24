import { cache } from "react";
import { listsPhrase, regionsPhrase } from "@/lib/check/copy";
import { recallStats } from "@/lib/db/recalls";

// One query per request for every sentence that names the loaded recall lists.
const loadedSources = cache(async () => (await recallStats()).sources);

export async function Regions() {
  return regionsPhrase(await loadedSources());
}

export async function Lists() {
  return listsPhrase(await loadedSources());
}
