import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../src/lib/db";

await migrate(db(), { migrationsFolder: "./drizzle" });
await db().$client.end();
process.stdout.write("Migrations applied\n");
