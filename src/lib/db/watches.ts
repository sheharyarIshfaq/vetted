import { watches } from "../../db/schema";
import { db } from "./client";

export async function insertWatch(watch: { email: string; brandNorm: string | null; model: string | null }) {
  await db().insert(watches).values(watch);
}
