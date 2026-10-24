import { brandAliases } from "../../db/schema";
import { db } from "./client";

export async function loadBrandAliases() {
  const rows = await db().select().from(brandAliases);
  return new Map(rows.map((row) => [row.alias, row.brandNorm]));
}
