/**
 * Создание/восстановление администратора админки (регистрации на сайте нет).
 *
 *   SEED_ADMIN_PASSWORD='…' pnpm seed:admin --email admin@example.ru --name "Иван"
 *   pnpm seed:admin --email admin@example.ru --reset-password   # сменить пароль существующему
 *
 * В Docker-образе: `node scripts-dist/seed-admin.mjs` (email и пароль — из SEED_ADMIN_EMAIL /
 * SEED_ADMIN_PASSWORD или аргументов; аргументы важнее переменных).
 *
 * Идемпотентен: повторный запуск подтверждает роль admin и снимает бан, но пароль меняет
 * только с флагом --reset-password. Не импортирует src/lib/auth.ts (не тянет notify/env),
 * работает напрямую с БД и hashPassword из Better Auth.
 */
import { randomUUID } from "node:crypto"
import { parseArgs } from "node:util"
import { hashPassword } from "better-auth/crypto"
import { and, eq } from "drizzle-orm"
import { db } from "../src/lib/db"
import { account, user } from "../src/lib/schema"

/** Совпадает с emailAndPassword.minPasswordLength в src/lib/auth.ts. */
const MIN_PASSWORD_LENGTH = 10
const DEFAULT_NAME = "Администратор"
const CREDENTIAL_PROVIDER = "credential"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function fail(message: string): never {
  console.error(`[seed-admin] ${message}`)
  process.exit(1)
}

function readOptions() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      password: { type: "string" },
      name: { type: "string" },
      "reset-password": { type: "boolean", default: false },
    },
  })

  // Better Auth хранит и сравнивает email в нижнем регистре
  const email = (values.email ?? process.env.SEED_ADMIN_EMAIL)?.trim().toLowerCase()
  if (!email) fail("Укажите email: --email или переменная SEED_ADMIN_EMAIL")
  if (!EMAIL_RE.test(email)) fail(`Некорректный email: ${email}`)

  const password = values.password ?? process.env.SEED_ADMIN_PASSWORD
  if (!password) {
    fail(
      "Укажите пароль: переменная SEED_ADMIN_PASSWORD (предпочтительно — не попадает в историю shell) или --password"
    )
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`)
  }

  const name = values.name?.trim() || DEFAULT_NAME
  return { email, password, name, resetPassword: values["reset-password"] === true }
}

async function main() {
  const { email, password, name, resetPassword } = readOptions()
  const passwordHash = await hashPassword(password)

  const outcome = await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email))

    if (!existing) {
      const userId = randomUUID()
      await tx.insert(user).values({
        id: userId,
        name,
        email,
        emailVerified: true,
        role: "admin",
        banned: false,
        twoFactorEnabled: false,
      })
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: CREDENTIAL_PROVIDER,
        userId,
        password: passwordHash,
      })
      return "created" as const
    }

    await tx
      .update(user)
      .set({ role: "admin", banned: false, banReason: null, banExpires: null, emailVerified: true })
      .where(eq(user.id, existing.id))

    const [credential] = await tx
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, existing.id), eq(account.providerId, CREDENTIAL_PROVIDER)))

    if (!credential) {
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: existing.id,
        providerId: CREDENTIAL_PROVIDER,
        userId: existing.id,
        password: passwordHash,
      })
      return "credential-added" as const
    }

    if (resetPassword) {
      await tx.update(account).set({ password: passwordHash }).where(eq(account.id, credential.id))
      return "password-reset" as const
    }

    return "confirmed" as const
  })

  const messages = {
    created: `Создан админ ${email}`,
    "credential-added": `Админ ${email} уже существует, права подтверждены, добавлен вход по паролю`,
    "password-reset": `Админ ${email} уже существует, права подтверждены, пароль изменён`,
    confirmed: `Админ ${email} уже существует, права подтверждены (пароль не менялся; для смены — --reset-password)`,
  } satisfies Record<typeof outcome, string>

  // eslint-disable-next-line no-console
  console.log(`[seed-admin] ${messages[outcome]}`)
}

main()
  .then(() => db.$client.end())
  .catch(async (error: unknown) => {
    console.error("[seed-admin] Ошибка:", error)
    await db.$client.end().catch(() => {})
    process.exit(1)
  })
