import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { admin, twoFactor } from "better-auth/plugins"
import { eq } from "drizzle-orm"
import { passwordResetEmail } from "@/lib/auth-emails"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/notify/email"
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy"
import { OWNER_ROLE } from "@/lib/roles"
import { user as userTable } from "@/lib/schema"

// Минимальная длина пароля — в src/lib/password-policy.ts (общая с формами; scripts/seed-admin.ts дублирует)
export { MIN_PASSWORD_LENGTH }

// Имена моделей схемы (user, session, account, verification, twoFactor, rateLimit)
// совпадают с именами Better Auth, поэтому `schema` в адаптер не передаётся.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [
    // `roles` не задаём: встроенный access control даёт права эндпоинтов /admin/* только роли
    // "admin" (главный админ). У роли "staff" (сотрудник, src/lib/roles.ts) прав там нет —
    // createUser/removeUser/setRole/setUserPassword… возвращают 403.
    admin({ defaultRole: "user", adminRoles: [OWNER_ROLE] }),
    twoFactor({ issuer: "Пирамида — админка" }),
    // Последним: переносит Set-Cookie из auth.api.* в cookies() Server Action
    // (смена временного пароля выдаёт новую сессию, src/app/(auth)/change-password)
    nextCookies(),
  ],
  user: {
    additionalFields: {
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
        // input: false — поле нельзя передать в updateUser/signUp с клиента: снять флаг
        // может только сервер после настоящей смены пароля
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // регистрации нет: главного админа создаёт scripts/seed-admin.ts, сотрудников — /admin/users
    minPasswordLength: MIN_PASSWORD_LENGTH,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    // Пароль по ссылке из письма пользователь задал сам — временный пароль больше не действует
    onPasswordReset: async ({ user }) => {
      await db.update(userTable).set({ mustChangePassword: false }).where(eq(userTable.id, user.id))
    },
    sendResetPassword: async ({ user, url }) => {
      // НЕ await: иначе по времени ответа можно определить, существует ли email
      void (async () => {
        const result = await sendEmail({ to: user.email, ...passwordResetEmail(url) })
        if (!result.ok && process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log(`[dev] Ссылка сброса пароля для ${user.email}: ${url}`)
        }
      })().catch((e: unknown) => console.error("sendResetPassword failed", e))
    },
  },
  // emailVerification не настраивается: верификации email нет (регистрации тоже нет)
  rateLimit: {
    // enabled не задаём: по умолчанию лимит включён только при NODE_ENV=production
    storage: "database", // таблица rate_limit (модель rateLimit)
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      // Защита от перебора 6-значного TOTP / backup-кода: встроенное правило плагина twoFactor
      // (3 запроса / 10 с) допускает ~1000 попыток в час
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
    },
  },
  hooks: {
    // Эндпоинты плагина admin (/admin/set-role, /admin/remove-user, /admin/ban-user…) по HTTP
    // закрыты для всех, включая главного админа: иначе в обход правил раздела «Пользователи»
    // (нельзя удалить себя/последнего главного админа) можно разжаловать себя через set-role.
    // Сервер вызывает их как auth.api.* (без request) — эти вызовы проходят.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.request && ctx.path.startsWith("/admin/")) {
        throw new APIError("FORBIDDEN", { message: "Управление пользователями — в /admin/users" })
      }
    }),
  },
  advanced: {
    // Traefik (Dokploy) перезаписывает X-Real-IP; левому x-forwarded-for не доверяем
    ipAddress: { ipAddressHeaders: ["x-real-ip"] },
  },
})
