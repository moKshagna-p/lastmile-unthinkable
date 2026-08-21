import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { immutabilityTriggerDDL } from "./immutability";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/lastmile";
const client = postgres(url, { max: 1 });
const db = drizzle(client);

console.log("Running migrations…");
await migrate(db, { migrationsFolder: "./drizzle" });

for (const stmt of immutabilityTriggerDDL()) {
  await client.unsafe(stmt);
}
console.log("Migrations + immutability triggers applied.");
await client.end();
