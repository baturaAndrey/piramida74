import type { Page } from "@playwright/test";

/** Сторонние домены, сетевые ошибки которых не считаем ошибками приложения. */
const THIRD_PARTY = /mc\.yandex|yandex\.(ru|net|com)|yastatic|vk\.(com|ru)|vkvideo|rutube/i;

/**
 * Собирает ошибки консоли и необработанные исключения страницы.
 * Использование: `const errors = trackConsoleErrors(page); …; expect(errors()).toEqual([])`.
 * `ignore` — дополнительные шаблоны ожидаемых сообщений (например, 404 ресурса в негативном тесте).
 */
export function trackConsoleErrors(page: Page, ignore: RegExp[] = []): () => string[] {
  const errors: string[] = [];
  const skip = (text: string) => THIRD_PARTY.test(text) || ignore.some((re) => re.test(text));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    const url = msg.location().url ?? "";
    if (skip(text) || THIRD_PARTY.test(url)) return;
    errors.push(text);
  });
  page.on("pageerror", (err) => {
    if (!skip(err.message)) errors.push(`pageerror: ${err.message}`);
  });
  return () => [...errors];
}

/** Уникальный суффикс для данных, создаваемых тестом. */
export const uniq = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** Уникальный IP (TEST-NET-2) для заголовка x-real-ip — изолирует rate limit заявок между тестами. */
export function uniqueIp(): string {
  const n = Math.floor(Math.random() * 250) + 1;
  const m = Math.floor(Math.random() * 250) + 1;
  return `198.51.${n}.${m}`;
}
