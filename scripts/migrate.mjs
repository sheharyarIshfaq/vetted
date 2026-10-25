import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Plain Node, so it runs before the standalone server without drizzle-kit or tsx.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

const client = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
await client.end();
process.stdout.write("Migrations applied\n");
