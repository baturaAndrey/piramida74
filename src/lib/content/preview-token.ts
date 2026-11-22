// `server-only` намеренно не импортируется: он бросает вне Next.js (Vitest); `node:crypto` и так не попадёт в клиент.
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Подписанные ссылки предпросмотра черновика: `/blog/preview/<id>?t=<exp>.<hmac>`.
 * HMAC-SHA256 на `BETTER_AUTH_SECRET` с префиксом домена `blog-preview:` (тот же
 * секрет использует Better Auth — префикс исключает переиспользование подписи).
 * Токен привязан к `articleId`: ссылка на одну статью не открывает другую.
 */

/** Срок жизни ссылки — 24 часа */
export const PREVIEW_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const MIN_SECRET_LENGTH = 32;
const EXP_PATTERN = /^\d{1,16}$/;

function secret(): string {
  // Читаем напрямую, а не через getServerEnv(): тому нужен весь серверный env (POSTGRES_URL и т. д.)
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error("BETTER_AUTH_SECRET is not configured");
  }
  return value;
}

function mac(articleId: string, exp: number): Buffer {
  return createHmac("sha256", secret()).update(`blog-preview:${articleId}:${exp}`).digest();
}

/** Подписывает ссылку предпросмотра статьи на `ttl` мс (по умолчанию 24 ч). */
export function signPreviewToken(
  articleId: string,
  now: number = Date.now(),
  ttl: number = PREVIEW_TOKEN_TTL_MS
): string {
  const exp = now + ttl;
  return `${exp}.${mac(articleId, exp).toString("base64url")}`;
}

/** `true`, только если токен подписан для этой статьи и ещё не истёк. */
export function verifyPreviewToken(
  articleId: string,
  token: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (typeof token !== "string" || token.length === 0) return false;
  const [expRaw, sig, ...rest] = token.split(".");
  if (!expRaw || !sig || rest.length > 0 || !EXP_PATTERN.test(expRaw)) return false;

  const exp = Number(expRaw);
  // Истёкшие и «слишком долгие» (exp дальше максимального TTL) отклоняются
  if (!Number.isSafeInteger(exp) || exp < now || exp > now + PREVIEW_TOKEN_TTL_MS) return false;

  const expected = mac(articleId, exp);
  const given = Buffer.from(sig, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
