/**
 * Сообщения о сбое загрузки чанка/динамического импорта в разных сборщиках и браузерах.
 * Turbopack и webpack бросают `ChunkLoadError` (проверяется по `name`), остальное — запасные
 * варианты на случай нативного `import()` и CSS-чанков.
 */
const CHUNK_ERROR_MESSAGES = [
  // Turbopack: «Failed to load chunk /_next/static/chunks/… from module …»
  /failed to load chunk/i,
  // webpack: «Loading chunk 123 failed.», «Loading CSS chunk 123 failed.»
  /loading (css )?chunk [\w/.-]+ failed/i,
  // Chrome: «Failed to fetch dynamically imported module: …»
  /failed to fetch dynamically imported module/i,
  // Firefox: «error loading dynamically imported module»
  /error loading dynamically imported module/i,
  // Safari: «Importing a module script failed.»
  /importing a module script failed/i,
];

/**
 * Ошибка — сбой загрузки чанка (обрыв сети, новый деплой с другими хэшами), а не ошибка
 * рендера: такую имеет смысл повторить и сообщить пользователю «проверьте соединение».
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "ChunkLoadError") return true;
  return CHUNK_ERROR_MESSAGES.some((re) => re.test(error.message));
}
