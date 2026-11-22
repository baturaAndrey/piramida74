/**
 * Политика паролей админки. Изоморфный модуль: используется сервером (src/lib/auth.ts —
 * emailAndPassword.minPasswordLength) и клиентскими формами.
 */
export const MIN_PASSWORD_LENGTH = 10;
/** Ограничение better-auth по умолчанию (maxPasswordLength) */
export const MAX_PASSWORD_LENGTH = 128;

/** Длина временного пароля из кнопки «Сгенерировать» */
export const TEMP_PASSWORD_LENGTH = 16;

/** Без похожих символов (0/O, 1/l/I), чтобы пароль можно было продиктовать или переписать */
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const BYTE_RANGE = 256;

/**
 * Криптостойкий случайный пароль (Web Crypto — есть и в браузере, и в Node 22).
 * Rejection sampling: байты ≥ наибольшего кратного длине алфавита отбрасываются,
 * иначе первые символы алфавита выпадали бы чаще.
 */
export function generateTemporaryPassword(length = TEMP_PASSWORD_LENGTH): string {
  if (!Number.isInteger(length) || length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) {
    throw new RangeError(
      `Длина пароля — от ${MIN_PASSWORD_LENGTH} до ${MAX_PASSWORD_LENGTH} символов`
    );
  }
  const alphabetSize = TEMP_PASSWORD_ALPHABET.length;
  const limit = BYTE_RANGE - (BYTE_RANGE % alphabetSize);
  let result = "";
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte >= limit) continue;
      result += TEMP_PASSWORD_ALPHABET[byte % alphabetSize];
      if (result.length === length) break;
    }
  }
  return result;
}
