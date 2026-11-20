/** Шаг округления «сейчас» для ключей кэша блога — 5 минут */
const NOW_STEP_MS = 300_000;

/**
 * «Сейчас», округлённое вниз до 5 минут, ISO-строкой — аргумент `now` запросов блога
 * (простой и редко меняющийся ключ `'use cache'`).
 *
 * Вызывать **только после `await connection()`**: `Date.now()` в статической
 * оболочке прерывает prerender при `cacheComponents`.
 */
export function roundedNowIso(): string {
  return new Date(Math.floor(Date.now() / NOW_STEP_MS) * NOW_STEP_MS).toISOString();
}
