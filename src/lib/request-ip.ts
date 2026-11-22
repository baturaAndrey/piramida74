/**
 * Client IP detection behind Traefik + privacy-preserving IP hashing.
 *
 * Server-only by usage (imports `node:*`). `server-only` is intentionally NOT
 * imported: it throws outside Next.js (e.g. in Vitest).
 */

import { createHash } from "node:crypto";
import { isIP } from "node:net";

type HeaderReader = Pick<Headers, "get">;

/** Значение `getClientIp`, когда IP определить не удалось (нет/невалидны заголовки прокси). */
export const UNKNOWN_IP = "unknown";

/** Normalise a raw header value to a valid IP (lowercased) or null. */
function clean(raw: string | null): string | null {
  if (!raw) return null;
  let v = raw.trim();
  if (v.startsWith("::ffff:") && isIP(v.slice(7)) === 4) v = v.slice(7); // IPv4-mapped
  return isIP(v) ? v.toLowerCase() : null;
}

/**
 * IP клиента. Источник — x-real-ip (Traefik перезаписывает его своим значением);
 * запасной вариант — ПОСЛЕДНИЙ элемент x-forwarded-for (левые элементы клиент подделывает).
 * Если ничего валидного нет — "unknown".
 */
export function getClientIp(headers: HeaderReader): string {
  const real = clean(headers.get("x-real-ip"));
  if (real) return real;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const last = clean(xff.split(",").at(-1) ?? null);
    if (last) return last;
  }
  return UNKNOWN_IP;
}

/** sha256(ip + BETTER_AUTH_SECRET) в hex (64 символа). Исходный IP не хранится. */
export function hashIp(ip: string): string {
  // Read process.env directly so callers don't need the full server env validated.
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return createHash("sha256")
    .update(ip + secret)
    .digest("hex");
}
