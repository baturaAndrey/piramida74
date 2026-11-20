import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };

function createClient() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    // Во время `next build` (в том числе docker build) БД нет — клиент postgres-js
    // не подключается, пока не выполнен запрос; в рантайме отсутствие переменной — ошибка конфигурации.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return postgres("postgres://build:build@127.0.0.1:5432/build", { max: 1 });
    }
    throw new Error("POSTGRES_URL environment variable is not set");
  }
  return postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
}

// Один клиент на процесс (в dev переживает HMR)
export const queryClient = globalForDb.__pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = queryClient;

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;
