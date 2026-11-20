/**
 * Applies drizzle SQL migrations at container start (bundled by esbuild into dist/migrate.cjs,
 * so drizzle-kit is not needed at runtime). Waits for the database because in Dokploy
 * Postgres may come up after the application container.
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MAX_ATTEMPTS = 30;
const DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("[migrate] POSTGRES_URL is not set");
    process.exit(1);
  }

  const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "drizzle");
  // onnotice: глушим NOTICE «already exists, skipping» при повторном (идемпотентном) запуске
  const client = postgres(url, { max: 1, connect_timeout: 10, onnotice: () => {} });

  // ждём БД
  for (let attempt = 1; ; attempt++) {
    try {
      await client`select 1`;
      break;
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) {
        console.error("[migrate] database is unreachable:", (err as Error).message);
        process.exit(1);
      }
      console.warn(`[migrate] database not ready (attempt ${attempt}/${MAX_ATTEMPTS}), retrying…`);
      await sleep(DELAY_MS);
    }
  }

  console.log(`[migrate] applying migrations from ${migrationsFolder}`);
  await migrate(drizzle(client), { migrationsFolder });
  console.log("[migrate] done");
  await client.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
