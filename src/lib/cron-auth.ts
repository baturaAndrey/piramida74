import { createHash, timingSafeEqual } from "node:crypto";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Проверяет `Authorization: Bearer ${CRON_SECRET}` для cron-маршрутов.
 * Обе стороны хэшируются (буферы одной длины), поэтому `timingSafeEqual` не бросает
 * и длина секрета не утекает. Секрет не задан или пуст — всегда `false`.
 * `process.env` читается напрямую (без кэша `getServerEnv`), чтобы не требовать остальные переменные.
 */
export function isValidCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  return timingSafeEqual(sha256(given), sha256(`Bearer ${secret}`));
}
