import postgres from "postgres";

/**
 * Прямой доступ к тестовой БД (`piramida_e2e` из .env.e2e) — для подготовки данных
 * и проверок, которые нельзя сделать через UI (сдвиг createdAt, массовые записи).
 * Одно соединение на воркер; закрывать не обязательно (процесс завершается).
 */
let client: ReturnType<typeof postgres> | undefined;

/** Имя БД из URL; `null`, если URL не задан или не разбирается */
function databaseName(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    return null;
  }
}

export function sql() {
  const url = process.env.POSTGRES_URL;
  const dbName = databaseName(url);
  // Та же проверка, что в scripts/e2e-db.mjs: «e2e» в хосте/пароле не делает БД тестовой
  if (!url || !dbName || !/^[a-z0-9_]+$/.test(dbName) || !dbName.includes("e2e")) {
    // Сам URL не выводим — в нём пароль
    throw new Error(
      `POSTGRES_URL должен указывать на тестовую БД (имя [a-z0-9_]+ с «e2e»), сейчас: ${dbName ?? "не задан или некорректен"}`
    );
  }
  client ??= postgres(url, { max: 1, onnotice: () => {} });
  return client;
}
