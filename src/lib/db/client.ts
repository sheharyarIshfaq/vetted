import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseEnv } from "../env";

let instance: ReturnType<typeof createDb> | undefined;

function createDb() {
  const client = postgres(databaseEnv().DATABASE_URL, { max: 10, onnotice: () => {} });
  return drizzle(client);
}

export function db() {
  instance ??= createDb();
  return instance;
}
