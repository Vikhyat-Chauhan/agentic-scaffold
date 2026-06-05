import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config({ path: ".env" });
config({ path: ".env.local", override: true });

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
} satisfies Config;
