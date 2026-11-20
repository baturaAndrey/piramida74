/**
 * In-memory sliding-window rate limiter for form submissions.
 *
 * Single-process only: the app runs as one replica (Dokploy `replicas = 1`).
 * The store lives on `globalThis` so it survives dev HMR, and is capped at
 * {@link MAX_KEYS} keys with LRU eviction (a touched key moves to the end of
 * the Map's insertion order; the oldest keys are evicted first).
 *
 * `server-only` is intentionally NOT imported: it throws outside Next.js.
 */

export interface RateLimitOptions {
  /** Максимум запросов в окне */
  limit: number;
  windowMs: number;
  /** Только для тестов */
  now?: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Секунды до освобождения слота (0, если ok) */
  retryAfter: number;
}

const MAX_KEYS = 10_000;
const globalForRl = globalThis as unknown as { __rateLimitStore?: Map<string, number[]> };
const store = (globalForRl.__rateLimitStore ??= new Map<string, number[]>());

/** Скользящее окно: хранит метки времени запросов за последние windowMs. */
export function rateLimit(
  key: string,
  { limit, windowMs, now = Date.now() }: RateLimitOptions
): RateLimitResult {
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  store.delete(key); // LRU: переместить ключ в конец
  if (hits.length >= limit) {
    store.set(key, hits);
    const oldest = hits[0] ?? now;
    return { ok: false, retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  hits.push(now);
  store.set(key, hits);
  while (store.size > MAX_KEYS) {
    const first = store.keys().next().value;
    if (first === undefined) break;
    store.delete(first);
  }
  return { ok: true, retryAfter: 0 };
}
