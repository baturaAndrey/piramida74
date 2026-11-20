# Task 08: Better Auth для админки (admin + 2FA, rate limit, login, seed-admin, proxy)

## Status

pending

## Wave

3

## Description

Настраивает аутентификацию для 1–2 администраторов клуба. Регистрации нет, первый админ создаётся скриптом `scripts/seed-admin.ts`. Better Auth 1.6 с плагинами `admin` и `twoFactor` (TOTP по желанию, включается на странице «Аккаунт» в задаче 19), rate limit в БД, сброс пароля по email через `notify/email`. Задача отдаёт остальным задачам хелперы `getSession`, `requireAdmin`, `requireAdminAction`, `proxy.ts` для оптимистичного редиректа `/admin/*` и три страницы: вход (с шагом 2FA), «Забыли пароль», «Новый пароль». Страницы переоформляются в духе `DESIGN.md` (shadcn, русский язык).

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md, task-03-db-schema.md, task-07-notify-lib.md
**Blocks:** task-14-admin-shell.md (и через неё все задачи админки)

**Context from dependencies:**
- Task 01 почистил стартер: удалил `(auth)/register`, `sign-up-form.tsx`, `dashboard`, `profile`, `chat`, пакеты `@better-auth/api-key`, `next-themes`; переименовал переменную `NEXT_PUBLIC_APP_URL` в `NEXT_PUBLIC_SITE_URL`; установил все пакеты. `scripts/**` не линтится eslint, но входит в `tsc` (typecheck). В `tsconfig.json` включены строгие флаги (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`) — учитывать при написании кода.
- Task 03 создал всю схему в `src/lib/schema/*.ts` (реэкспорт из `src/lib/schema/index.ts`; `src/lib/db.ts` импортирует `./schema`). Таблицы Better Auth уже содержат колонки плагинов: `user` (`role`, `banned`, `banReason`, `banExpires`, `twoFactorEnabled`), `session` (`impersonatedBy`), а также таблицы `twoFactor` и `rateLimit`. **Схему и миграции не трогать.** Все не-BetterAuth таблицы используют UUID, таблицы Better Auth — text id.
- Task 07 создал `src/lib/notify/email.ts`: `sendEmail({ to?, subject, html, text }) → Promise<{ ok: boolean; error?: string }>`. Если SMTP не настроен — функция пропускает отправку и пишет `console.warn`, не бросая исключение.

## Files to Create

- `src/lib/auth-emails.ts` — шаблон письма сброса пароля (`passwordResetEmail(url)` → `{ subject, html, text }`)
- `src/components/auth/login-form.tsx` — форма входа с шагом 2FA (client)
- `src/components/auth/two-factor-step.tsx` — шаг ввода TOTP или резервного кода (client)
- `src/components/auth/auth-card.tsx` — общая обёртка карточки (заголовок, описание, бренд-текст)
- `src/components/auth/authed-redirect.tsx` — async server-компонент: если уже вошёл админ, `redirect('/admin')`
- `scripts/seed-admin.ts` — создание/восстановление первого админа

## Files to Modify

- `src/lib/auth.ts` — полная настройка Better Auth (см. ниже)
- `src/lib/auth-client.ts` — `adminClient()` + `twoFactorClient()`, экспорты
- `src/lib/session.ts` — `getSession`, `requireAdmin`, `requireAdminAction`, `isAdminSession`; старые хелперы (`requireAuth`, `getOptionalSession`, `protectedRoutes`, `isProtectedRoute`) удалить
- `src/proxy.ts` — matcher `['/admin/:path*']`, редирект на `/login`
- `src/app/(auth)/layout.tsx` — `noindex` metadata, центрирование
- `src/app/(auth)/login/page.tsx` — вход
- `src/app/(auth)/forgot-password/page.tsx` — запрос ссылки
- `src/app/(auth)/reset-password/page.tsx` — новый пароль
- `src/components/auth/forgot-password-form.tsx` — русские тексты
- `src/components/auth/reset-password-form.tsx` — русские тексты
- `src/components/auth/sign-out-button.tsx` — русский текст, после выхода редирект на `/login`

Удалить, если после задачи 01 ещё существуют и **ни один файл их не импортирует** (проверить `grep -rn "sign-in-button\|user-profile" src`): `src/components/auth/sign-in-button.tsx`, `src/components/auth/user-profile.tsx`. Если импортёр остался (например `site-header.tsx` — его заменяет другая задача), оставить файл и сообщить об этом в отчёте. Ссылок на `/register` не должно остаться нигде в `src/components/auth` и `src/app/(auth)`.

## Technical Details

### Implementation Steps

1. Прочитать текущие `src/lib/auth.ts`, `auth-client.ts`, `session.ts`, `proxy.ts`, `src/app/(auth)/**`, `src/components/auth/**`. Сверить имена таблиц с `src/lib/schema/auth.ts` (экспорты `user`, `account`, `session`, `verification`, `twoFactor`, `rateLimit`).

2. **`src/lib/auth.ts`.** Сохранить `drizzleAdapter(db, { provider: "pg" })`. Если имена моделей схемы совпадают с именами Better Auth (`user`, `session`, `account`, `verification`, `twoFactor`, `rateLimit`), передавать `schema` не нужно; иначе передать `schema` в адаптер. Конфигурация:

```ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, twoFactor } from "better-auth/plugins"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/notify/email"
import { passwordResetEmail } from "@/lib/auth-emails"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    twoFactor({ issuer: "Пирамида — админка" }),
  ],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // регистрации нет
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      // НЕ await: иначе по времени ответа можно определить, существует ли email
      void (async () => {
        const result = await sendEmail({ to: user.email, ...passwordResetEmail(url) })
        if (!result.ok && process.env.NODE_ENV !== "production") {
          console.log(`[dev] Ссылка сброса пароля для ${user.email}: ${url}`)
        }
      })().catch((e) => console.error("sendResetPassword failed", e))
    },
  },
  // emailVerification НЕ настраиваем: верификации email нет (регистрации тоже нет)
  rateLimit: {
    storage: "database", // таблица rateLimit (создана задачей 03)
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },
  advanced: {
    // Traefik (Dokploy) перезаписывает X-Real-IP; левый x-forwarded-for не доверяем
    ipAddress: { ipAddressHeaders: ["x-real-ip"] },
  },
})
```

   Замечания: rate limit в Better Auth по умолчанию включён только при `NODE_ENV=production` — так и оставить (не ставить `enabled: true`, чтобы не мешать локальной разработке и e2e). Старый блок `emailVerification` из стартера **удалить**. Опции плагинов при расхождении типов сверить через context7 (`/better-auth/better-auth`, версия 1.6.x). Если имя эндпоинта сброса пароля в 1.6 отличается от `/request-password-reset`, подставить актуальное (проверить по `auth.api` / документации).

3. **`src/lib/auth-emails.ts`:** простой HTML (inline-стили, без внешних ресурсов): заголовок «Сброс пароля», кнопка-ссылка, текст «Ссылка действует 1 час. Если вы не запрашивали сброс — проигнорируйте письмо», подпись «Бильярдный клуб «Пирамида»». Экранировать `url` для атрибута `href` (`&` → `&amp;`). Возвращает `{ subject: "Сброс пароля — админка «Пирамида»", html, text }`.

4. **`src/lib/auth-client.ts`:**

```ts
import { createAuthClient } from "better-auth/react"
import { adminClient, twoFactorClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  plugins: [adminClient(), twoFactorClient()],
})

export const { signIn, signOut, useSession, getSession, requestPasswordReset, resetPassword, twoFactor } = authClient
```

   `signUp` и `sendVerificationEmail` из экспортов убрать (если кто-то из уцелевших файлов, не принадлежащих этой задаче, на них ссылается — сообщить в отчёте).

5. **`src/lib/session.ts`:**

```ts
import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

/** Сессия текущего запроса (дедуплицируется в рамках запроса). */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

export function isAdminSession(session: AuthSession | null): session is AuthSession {
  if (!session || session.user.banned) return false
  // role может быть списком через запятую
  return String(session.user.role ?? "").split(",").map((r) => r.trim()).includes("admin")
}

/** Для страниц и layout: нет админа → redirect('/login'). */
export async function requireAdmin(): Promise<AuthSession> {
  const session = await getSession()
  if (!isAdminSession(session)) redirect("/login")
  return session
}

/** Для Server Actions и route handlers: нет админа → Error('UNAUTHORIZED'). */
export async function requireAdminAction(): Promise<AuthSession> {
  const session = await getSession()
  if (!isAdminSession(session)) throw new Error("UNAUTHORIZED")
  return session
}
```

   Типы `session.user.role`/`banned` приходят из плагина `admin`; если TS их не видит — использовать `typeof auth.$Infer.Session` или узкое приведение типа. **Важно (cacheComponents):** `headers()` — динамический API. Любая страница или компонент, вызывающие `requireAdmin()`, должны находиться внутри `<Suspense>` (его обеспечивает `admin/layout.tsx` в задаче 14). Для страниц `(auth)` см. шаг 8.

6. **`src/proxy.ts`:**

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

/** Только оптимистичный редирект по наличию cookie. Права проверяются в страницах и Server Actions. */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = request.nextUrl.clone()
    const next = request.nextUrl.pathname + request.nextUrl.search
    url.pathname = "/login"
    url.search = ""
    url.searchParams.set("next", next)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ["/admin/:path*"] }
```

   К БД и таблице `redirects` proxy не обращается.

7. **Компоненты входа (client).**
   - `login-form.tsx`: поля email и пароль (shadcn `Input`, `Label`, `Button`; состояние через `useState` либо RHF + zod; сообщения на русском). Вызов `signIn.email({ email, password })`. Если в `result.data` есть `twoFactorRedirect === true` (проверять как `(result.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect`) — показать `TwoFactorStep` вместо формы. Ошибки: статус 429 → «Слишком много попыток. Подождите минуту»; все остальные ошибки → «Неверный email или пароль» (не раскрывать, что именно неверно). Успех → `router.replace(safeNext)` и `router.refresh()`, где `safeNext` берётся из `useSearchParams().get("next")` **только** если значение начинается с `/admin` и не содержит `//` и `\` (защита от open redirect), иначе `/admin`. При `?reset=success` показывать сообщение «Пароль изменён, войдите с новым паролем». Ссылка «Забыли пароль?» → `/forgot-password`. Ссылок на регистрацию нет.
   - `two-factor-step.tsx`: поле на 6 цифр (`inputMode="numeric"`, `autoComplete="one-time-code"`), чекбокс «Доверять этому устройству 30 дней», вызов `authClient.twoFactor.verifyTotp({ code, trustDevice })`; переключатель «Использовать резервный код» → `authClient.twoFactor.verifyBackupCode({ code })`; кнопка «Назад». Успех → тот же `router.replace`.
   - `login-form` использует `useSearchParams`, поэтому на странице оборачивается в `<Suspense>`.

8. **Страницы `(auth)`.** Общее правило: статическая оболочка (`AuthCard`) снаружи, всё динамическое — внутри `<Suspense>`. Страница входа:

```tsx
export const metadata = { title: "Вход" } // robots задаётся в (auth)/layout.tsx
export default function LoginPage() {
  return (
    <AuthCard title="Вход в админку" description="Бильярдный клуб «Пирамида»">
      <Suspense><AuthedRedirect /></Suspense>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}><LoginForm /></Suspense>
    </AuthCard>
  )
}
```

   `AuthedRedirect` (async server-компонент): `const s = await getSession(); if (isAdminSession(s)) redirect("/admin"); return null`. Пользователя с сессией, но без роли `admin`, на `/login` не редиректить (иначе цикл `/admin → /login → /admin`). `forgot-password` и `reset-password` — без проверки сессии (`reset-password` по-прежнему оборачивает `ResetPasswordForm` в `<Suspense>` из-за `useSearchParams`). `(auth)/layout.tsx`: `export const metadata = { robots: { index: false, follow: false } }` и обёртка `flex min-h-screen items-center justify-center p-4 auth-bg` (класс `auth-bg` описан в DESIGN.md; если в `globals.css` его нет — обычный `bg-background`). `AuthCard`: `Card w-full max-w-md`; над заголовком бренд-текст по DESIGN.md (`bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent`) «Пирамида».

9. **Формы forgot/reset:** перевести тексты на русский («Отправить ссылку», «Если аккаунт с таким email существует, мы отправили письмо со ссылкой для сброса пароля», «Пароли не совпадают», «Минимум 10 символов»). Убрать фразу «Check your terminal». В reset-форме минимальная длина пароля 10 (как в `minPasswordLength`). Ссылка «Вспомнили пароль? Войти». `sign-out-button.tsx`: текст «Выйти», `router.replace("/login")` после `signOut()`.

10. **`scripts/seed-admin.ts`.** Запуск: `pnpm seed:admin --email admin@example.ru --password '...' --name "Иван"` (скрипт `"seed:admin": "tsx --env-file=.env scripts/seed-admin.ts"` уже есть в `package.json` — его добавила задача 01; **`package.json` не править**). Скрипт не импортирует `src/lib/auth.ts` (чтобы не тянуть notify/env), а работает напрямую с БД и `hashPassword`:

```ts
import { parseArgs } from "node:util"
import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { hashPassword } from "better-auth/crypto"
import { db } from "../src/lib/db"
import { user, account } from "../src/lib/schema"

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string" },
    "reset-password": { type: "boolean", default: false },
  },
})
```

    Логика:
    - `email` обязателен и приводится к нижнему регистру (Better Auth сравнивает email в нижнем регистре); простая проверка формата.
    - пароль берётся из `--password` или переменной `SEED_ADMIN_PASSWORD`; длина ≥ 10, иначе завершить с понятной ошибкой; `name` по умолчанию «Администратор».
    - всё внутри одной `db.transaction`. Если пользователя нет: вставить `user` (`id: randomUUID()`, `name`, `email`, `emailVerified: true`, `role: "admin"`, `banned: false`, `twoFactorEnabled: false`) и `account` (`id: randomUUID()`, `accountId: <userId>`, `providerId: "credential"`, `userId`, `password: await hashPassword(password)`).
    - Если пользователь есть (**идемпотентность**): выставить `role: "admin"`, `banned: false`, `banReason: null`, `banExpires: null`, `emailVerified: true`; если нет credential-аккаунта (`and(eq(account.userId, id), eq(account.providerId, "credential"))`) — создать; пароль менять **только** с флагом `--reset-password`.
    - Печатает итог («Создан админ …» / «Админ уже существует, права подтверждены») **без пароля**, затем `await db.$client.end()` (если `$client` недоступен в типах — `process.exit(0)`).
    - Пароль лучше передавать через `SEED_ADMIN_PASSWORD`, чтобы он не попадал в историю shell; сказать об этом в сообщении об ошибке при отсутствии пароля.

### Environment Variables

- `POSTGRES_URL` — БД (`src/lib/db.ts`, `seed-admin.ts`)
- `BETTER_AUTH_SECRET` — секрет (≥ 32 символов), `BETTER_AUTH_URL` — базовый URL приложения (например `http://localhost:3000`)
- `NEXT_PUBLIC_SITE_URL` — для `auth-client.ts`
- `SMTP_*`, `SMTP_FROM` — через `sendEmail` для письма сброса пароля (в dev без SMTP ссылка пишется в консоль)
- `SEED_ADMIN_PASSWORD` — необязательно, пароль для скрипта (вместо `--password`)

### API Endpoints

- `/api/auth/[...all]` — уже существует (`toNextJsHandler(auth)`), менять не нужно. `POST /api/auth/sign-up/email` должен отвечать ошибкой из-за `disableSignUp`.

## Acceptance Criteria

- [ ] Регистрация закрыта: `POST /api/auth/sign-up/email` возвращает ошибку; ссылок на `/register` нет, страницы `/register` нет.
- [ ] `pnpm seed:admin --email a@b.ru --password '<10+ символов>'` создаёт пользователя с `role='admin'` и credential-аккаунтом; повторный запуск не создаёт дубликатов и не меняет пароль без `--reset-password`.
- [ ] Вход этим логином работает на `/login`; после входа открывается `/admin` (или значение `next`, если оно начинается с `/admin`); `next=https://evil.com` игнорируется.
- [ ] `/admin` без cookie редиректится на `/login?next=...` через `proxy.ts`; `proxy.ts` не обращается к БД.
- [ ] `requireAdmin()` перенаправляет на `/login` при отсутствии сессии, роли `admin` или бане; `requireAdminAction()` бросает `Error('UNAUTHORIZED')`.
- [ ] После 5 неудачных входов за 60 секунд (в production-режиме) вход блокируется (429), счётчики лежат в таблице `rate_limit`; IP берётся из `x-real-ip`.
- [ ] 2FA: у пользователя с включённым TOTP после пароля показывается шаг ввода кода (TOTP и резервный код); `issuer` равен «Пирамида — админка».
- [ ] Сброс пароля: `/forgot-password` отправляет письмо через `sendEmail`; ссылка ведёт на `/reset-password?token=...`; после смены пароля редирект на `/login?reset=success` и сообщение об успехе. В dev без SMTP ссылка выводится в консоль, в production — никогда.
- [ ] Нет верификации email и кода `sendVerificationEmail`.
- [ ] Страницы `(auth)` на русском, оформлены по DESIGN.md, имеют `noindex`; `next build` проходит без БД (динамика только внутри `<Suspense>`).
- [ ] `pnpm lint` и `pnpm typecheck` проходят.

## Notes

- Под Cache Components `getSession()` нельзя вызывать вне `<Suspense>`: страницы админки получают Suspense из `admin/layout.tsx` (задача 14), страницы `(auth)` — см. шаг 8.
- Контракт проекта: `requireAdmin()` — **только** страницы и layout'ы админки (redirect на `/login`); `requireAdminAction()` — Server Actions и route handlers (бросает `Error('UNAUTHORIZED')`). Обёртка `adminAction()` из задачи 14 превращает `UNAUTHORIZED` в `{ ok: false, error: 'Нет доступа' }`; route handlers `/api/admin/*` ловят её в `try/catch` и отвечают `401`.
- Пароль админа в production создаётся скриптом, запущенным с рабочей машины против БД Dokploy (через проброс порта/SSH-туннель): в standalone-образе нет `tsx`.
- `minPasswordLength: 10` строже значения по умолчанию (8); значение должно совпадать в `auth.ts`, форме сброса и `seed-admin.ts`.
