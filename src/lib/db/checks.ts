import { eq } from "drizzle-orm";
import { z } from "zod";
import { checks } from "../../db/schema";
import { db } from "./client";

export type NewCheck = typeof checks.$inferInsert;

export async function insertCheck(check: NewCheck) {
  const [row] = await db().insert(checks).values(check).returning({ id: checks.id });
  return row.id;
}

const idSchema = z.uuid();

export async function getCheck(id: string) {
  if (!idSchema.safeParse(id).success) return undefined;
  const [row] = await db().select().from(checks).where(eq(checks.id, id)).limit(1);
  return row;
}

export async function flagCheck(id: string, note: string | null) {
  if (!idSchema.safeParse(id).success) return false;
  const rows = await db()
    .update(checks)
    .set({ flagged: true, flagNote: note })
    .where(eq(checks.id, id))
    .returning({ id: checks.id });
  return rows.length > 0;
}
