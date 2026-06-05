// Single DB entry point. Never import the postgres client elsewhere.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Supabase transaction pooler (pgbouncer) → prepared statements must be disabled.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export * from "./schema";
