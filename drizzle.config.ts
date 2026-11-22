import { existsSync } from "node:fs";
import type { Config } from "drizzle-kit";

// drizzle-kit сам .env не читает
if (existsSync(".env")) process.loadEnvFile(".env");

export default {
  dialect: "postgresql",
  schema: "./src/lib/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.POSTGRES_URL! },
} satisfies Config;
