/**
 * Хук старта сервера Next.js: `register()` вызывается один раз при запуске инстанса,
 * до обработки запросов (см. node_modules/next/dist/docs/01-app/02-guides/instrumentation.md).
 */
export async function register(): Promise<void> {
  // Только прод-сервер в Node.js-рантайме. Во время `next build` (воркеры пререндера тоже
  // загружают instrumentation) окружения нет: build:ci идёт с пустым POSTGRES_URL.
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  const { checkEnv } = await import("@/lib/env");
  checkEnv();
}
