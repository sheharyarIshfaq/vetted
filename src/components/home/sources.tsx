import { connection } from "next/server";
import { cache } from "react";
import { listsPhrase } from "@/lib/check/copy";
import { recallStats } from "@/lib/db/recalls";

// One query per request for every sentence that names the loaded recall lists; never at build time.
const loadedSources = cache(async () => {
  await connection();
  return (await recallStats()).sources;
});

export async function Lists() {
  return listsPhrase(await loadedSources());
}
