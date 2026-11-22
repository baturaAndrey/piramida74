/**
 * 301-редиректы со старых URL PHP-сайта (см. data/legacy-notes.md).
 * Импортируется из next.config.ts, поэтому без алиаса `@/` и без зависимостей.
 * Слэш на конце (`/politika/`, `/spasibo/`) Next.js убирает сам (308).
 */
export const legacyRedirects = [
  { source: "/index.php", destination: "/", statusCode: 301 as const },
  { source: "/index.html", destination: "/", statusCode: 301 as const },
  { source: "/politika/politika.html", destination: "/politika", statusCode: 301 as const },
  {
    source: "/politika/politika-content.html",
    destination: "/politika",
    statusCode: 301 as const,
  },
  { source: "/politika/index.php", destination: "/politika", statusCode: 301 as const },
  { source: "/politika/index.html", destination: "/politika", statusCode: 301 as const },
  { source: "/spasibo/index.php", destination: "/spasibo", statusCode: 301 as const },
] satisfies { source: string; destination: string; statusCode: 301 }[];
