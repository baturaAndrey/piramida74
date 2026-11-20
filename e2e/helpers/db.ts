import postgres from "postgres";

/**
 * Прямой доступ к тестовой БД (`piramida_e2e` из .env.e2e) — для подготовки данных
 * и проверок, которые нельзя сделать через UI (сдвиг createdAt, массовые записи).
 * Одно соединение на воркер; закрывать не обязательно (процесс завершается).
 */
let client: ReturnType<typeof postgres> | undefined;

export function sql() {
  const url = process.env.POSTGRES_URL;
  if (!url || !url.includes("e2e")) {
    throw new Error(`POSTGRES_URL должен указывать на тестовую БД (*e2e*), сейчас: ${url ?? "не задан"}`);
  }
  client ??= postgres(url, { max: 1, onnotice: () => {} });
  return client;
}
