import { checks } from "../../db/schema";
import { db } from "./client";

export type NewCheck = typeof checks.$inferInsert;

export async function insertCheck(check: NewCheck) {
  const [row] = await db().insert(checks).values(check).returning({ id: checks.id });
  return row.id;
}

