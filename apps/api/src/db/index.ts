import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/lastmile";

export const sql = postgres(connectionString, { max: 10 });
export const db = drizzle(sql, { schema });
export { schema };
