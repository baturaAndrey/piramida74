/** Запасной адрес, если `NEXT_PUBLIC_SITE_URL` не задан (dev) */
const FALLBACK_SITE_URL = "http://localhost:3000";

/** Базовый адрес сайта без завершающего `/`. */
export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_SITE_URL;
  return raw.replace(/\/+$/, "");
}

/**
 * Абсолютный URL для RSS, JSON-LD и кнопок «Поделиться»: `absoluteUrl('/blog')` →
 * `https://example.ru/blog`. Локальная копия, чтобы не зависеть от `seo/metadata.ts`.
 */
export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin()}${normalized}`;
}
