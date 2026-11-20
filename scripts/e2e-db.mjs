#!/usr/bin/env node
/**
 * Пересоздаёт тестовую БД для Playwright (`pnpm e2e:db`):
 *   DROP/CREATE piramida_e2e → drizzle migrate → seed → seed:admin → очистка UPLOAD_DIR.
 *
 * Значения берутся из `.env.e2e` (git-ignored). Они передаются дочерним процессам через
 * окружение и имеют приоритет над `.env` (`tsx --env-file` и `process.loadEnvFile` не
 * перетирают уже заданные переменные). `drizzle-kit push` не используется.
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { parseEnv } from "node:util";

const ENV_FILE = ".env.e2e";
if (!existsSync(ENV_FILE)) {
  console.error(`[e2e-db] Нет файла ${ENV_FILE} (шаблон — env.example).`);
  process.exit(1);
}
// seed/seed:admin запускаются с --env-file=.env — файл должен существовать
if (!existsSync(".env")) copyFileSync("env.example", ".env");

const e2eEnv = parseEnv(readFileSync(ENV_FILE, "utf8"));
const env = { ...process.env, ...e2eEnv };

const dbUrl = new URL(e2eEnv.POSTGRES_URL);
const dbName = dbUrl.pathname.slice(1);
if (!/^[a-z0-9_]+$/.test(dbName) || !dbName.includes("e2e")) {
  // Защита от случайного пересоздания рабочей БД
  console.error(`[e2e-db] Подозрительное имя тестовой БД: "${dbName}" (должно содержать "e2e").`);
  process.exit(1);
}

function run(cmd, opts = {}) {
  console.log(`[e2e-db] $ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env, ...opts });
}

// DROP/CREATE через psql внутри контейнера docker compose (реквизиты из docker-compose.yml)
const psql = (sql) =>
  run(`docker compose exec -T postgres psql -U ${dbUrl.username} -d postgres_dev -v ON_ERROR_STOP=1 -c "${sql}"`);
psql(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE);`);
psql(`CREATE DATABASE ${dbName};`);

run("pnpm db:migrate");
run("pnpm seed");
run(`pnpm seed:admin --email ${e2eEnv.E2E_ADMIN_EMAIL} --name "E2E Admin"`, {
  env: { ...env, SEED_ADMIN_PASSWORD: e2eEnv.E2E_ADMIN_PASSWORD },
});

const uploadDir = e2eEnv.UPLOAD_DIR ?? "./.data/e2e-uploads";
rmSync(uploadDir, { recursive: true, force: true });
mkdirSync(uploadDir, { recursive: true });
rmSync("e2e/.auth", { recursive: true, force: true });

// Необязательно: фото старого сайта (для визуальной сверки и Lighthouse на реалистичных данных).
// `pnpm e2e:db --with-images [--source <путь>]`; e2e-тесты работают и без них.
const withImages = process.argv.includes("--with-images");
if (withImages) {
  const i = process.argv.indexOf("--source");
  const source = i > -1 ? process.argv[i + 1] : "C:\\OSPanel\\home\\74.loc";
  run(`pnpm import:images --source "${source}"`);
}

console.log("[e2e-db] Готово.");
