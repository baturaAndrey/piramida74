import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, twoFactor } from "better-auth/plugins"
import { passwordResetEmail } from "@/lib/auth-emails"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/notify/email"

/** Минимальная длина пароля: совпадает с формой сброса и scripts/seed-admin.ts. */
export const MIN_PASSWORD_LENGTH = 10

// Имена моделей схемы (user, session, account, verification, twoFactor, rateLimit)
// совпадают с именами Better Auth, поэтому `schema` в адаптер не передаётся.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    twoFactor({ issuer: "Пирамида — админка" }),
  ],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // регистрации нет: админов создаёт scripts/seed-admin.ts
    minPasswordLength: MIN_PASSWORD_LENGTH,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
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
  advanced: {
    // Traefik (Dokploy) перезаписывает X-Real-IP; левому x-forwarded-for не доверяем
    ipAddress: { ipAddressHeaders: ["x-real-ip"] },
  },
})
