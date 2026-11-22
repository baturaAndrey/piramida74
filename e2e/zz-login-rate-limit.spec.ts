import { expect, test } from "@playwright/test";
import { uniq } from "./helpers/console";

/**
 * Rate limit входа (Better Auth: `/sign-in/email` — 5 запросов в минуту на IP из x-real-ip).
 * Выполняется последним (проект `teardown-rate-limit`) и с собственным x-real-ip, чтобы
 * не заблокировать вход остальных тестов.
 */
const SIGN_IN_LIMIT = 5;

/**
 * IP из TEST-NET-3 (лимит хранится в БД по IP + путь). Невалидный IP Better Auth не принимает
 * и складывает запрос в общий bucket `no-trusted-ip` — это заблокировало бы вход всем тестам.
 */
function rateLimitIp(): string {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  return `203.0.${octet()}.${octet()}`;
}

test("6 неверных попыток входа за минуту → 429", async ({ request, baseURL }) => {
  const ip = rateLimitIp();
  const email = `e2e-ratelimit-${uniq()}@example.com`;
  const statuses: number[] = [];

  for (let attempt = 0; attempt <= SIGN_IN_LIMIT; attempt++) {
    const res = await request.post("/api/auth/sign-in/email", {
      headers: { "x-real-ip": ip, Origin: baseURL ?? "" },
      data: { email, password: `wrong-password-${attempt}` },
    });
    statuses.push(res.status());
  }

  expect(
    statuses.slice(0, SIGN_IN_LIMIT).every((s) => s === 401),
    statuses.join(",")
  ).toBe(true);
  expect(statuses.at(-1), statuses.join(",")).toBe(429);

  // Другой IP лимитом не затронут
  const other = await request.post("/api/auth/sign-in/email", {
    headers: { "x-real-ip": `${ip.split(".").slice(0, 3).join(".")}.251`, Origin: baseURL ?? "" },
    data: { email, password: "wrong-password" },
  });
  expect(other.status()).toBe(401);
});
