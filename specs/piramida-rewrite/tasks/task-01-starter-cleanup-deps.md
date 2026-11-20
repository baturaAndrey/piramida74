# Task 01: Чистка стартера, пакеты, shadcn-компоненты, конфиги, тестовый тулинг

## Status

complete

## Wave

1

## Description

Репозиторий — стартер `create-agentic-app` (чат с ИИ, Polar, Vercel Blob, next-themes и т.д.). Эта задача превращает его в чистую основу для сайта бильярдного клуба «Пирамида»: удаляет весь лишний код и пакеты, **один раз ставит все пакеты и все shadcn-компоненты, которые понадобятся любой следующей задаче** (после неё новые зависимости не ставит никто), настраивает `next.config.ts` (Cache Components, standalone, CSP, noindex), `env.ts`/`env.example`, скрипты `package.json`, Docker Compose с Postgres 18, Vitest и Playwright, добавляет `/api/health`. Стили (`globals.css`), `DESIGN.md` и шрифт — задача 02, схема БД — задача 03, `Dockerfile` — задача 04. Здесь их **не трогаем**, правим только то, что сломается после удаления.

## Dependencies

**Depends on:** None (Wave 1)
**Blocks:** task-02-design-tokens-layout.md, task-03-db-schema.md, task-04-docker-deploy.md, task-05-calculator-core.md, task-06-shared-utils.md, task-07-notify-lib.md (и транзитивно все остальные)

**Context from dependencies:** зависимостей нет. Исходное состояние: Next.js 16.1.6, React 19.2.4, Tailwind v4, shadcn new-york, Better Auth + Drizzle (`postgres`-драйвер), `pnpm` 11 (в нём поле `pnpm` в `package.json` **больше не читается** — `overrides` и `allowBuilds` живут в `pnpm-workspace.yaml`). В корне лежит `res/` (картинки прайсов) и `specs/` — их не трогать.

## Files to Create

- `vitest.config.ts` — конфигурация Vitest (node-окружение, алиас `@`)
- `playwright.config.ts` — конфигурация Playwright
- `e2e/health.spec.ts` — единственный smoke-тест e2e (`/api/health` → 200)
- `src/app/api/health/route.ts` — healthcheck (`SELECT 1`)
- `src/hooks/use-mobile.ts` — появится само при `shadcn add sidebar` (не писать вручную)
- `src/components/ui/*` — новые shadcn-компоненты (см. список ниже), генерирует CLI

## Files to Modify

- `package.json` — пакеты, скрипты, удаление поля `pnpm`
- `pnpm-workspace.yaml` — `overrides` и `allowBuilds`
- `pnpm-lock.yaml` — обновляется pnpm
- `next.config.ts` — полностью переписать
- `src/lib/env.ts` — переписать под контракт проекта
- `env.example` — переписать
- `docker-compose.yml` — Postgres 18 alpine
- `.gitignore` — `.data/`, `dist/`, отчёты Playwright
- `.nvmrc` — `22`
- `eslint.config.mjs` — добавить игноры (`.data/**`, `coverage/**`, `playwright-report/**`, `test-results/**`)
- `src/components/ui/sonner.tsx` — убрать `next-themes`
- `src/app/layout.tsx` — только убрать `ThemeProvider` (файл целиком перепишет задача 02)
- `src/components/site-header.tsx` — только убрать `ModeToggle` (файл удалит задача 02)
- `src/lib/auth-client.ts`, `src/app/robots.ts`, `src/app/sitemap.ts` — только замена `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_SITE_URL` (файлы целиком перепишут задачи 08 и 23)
- `README.md` (корень репозитория) — замена `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_SITE_URL` (строки ~95 и ~338)

## Files to Delete

Каталоги и файлы (проверить существование, удалить через `git rm -r`):

- `src/app/chat/`, `src/app/api/chat/`, `src/app/api/diagnostics/`
- `src/app/dashboard/`, `src/app/profile/`
- `src/app/page.tsx` — стартовая главная. **Новая главная — `src/app/(site)/page.tsx` (задача 27)**; до тех пор `/` отдаёт 404, это нормально, сборка проходит
- `src/app/(auth)/register/`
- `src/components/auth/sign-up-form.tsx`
- `src/components/setup-checklist.tsx`, `src/components/starter-prompt-modal.tsx`
- `src/components/theme-provider.tsx`
- `src/components/ui/github-stars.tsx`, `src/components/ui/mode-toggle.tsx`
- `src/hooks/use-diagnostics.ts`
- `src/lib/storage.ts` (Vercel Blob; новое хранилище — задача 09 в `src/lib/media/`)
- `scripts/setup.ts`
- `docs/technical/ai/`, `docs/technical/betterauth/polar.md`, `docs/business/starter-prompt.md`
- `.claude/agents/polar-payments-expert.md`

Не удалять: `src/app/(auth)/{login,forgot-password,reset-password}`, `src/components/auth/*` (кроме sign-up-form), `src/lib/{auth,auth-client,session,db,schema}.ts`, `src/proxy.ts`, `src/app/{error,not-found,manifest,robots,sitemap}.ts(x)`, `src/components/site-{header,footer}.tsx` — их перепишут владельцы (08, 02, 13, 23). Они должны оставаться **компилируемыми**.

## Technical Details

### Implementation Steps

1. **Удалить код** из раздела «Files to Delete». После удаления выполнить `grep -rn "next-themes\|ThemeProvider\|ModeToggle\|mode-toggle\|use-diagnostics\|github-stars\|setup-checklist\|starter-prompt\|@/lib/storage\|@ai-sdk\|openrouter\|@vercel/blob\|polar" src scripts` и поправить всё оставшееся (ожидаемо: `src/app/layout.tsx`, `src/components/site-header.tsx`, `src/components/ui/sonner.tsx`, `src/components/site-footer.tsx` — проверить, `docs`).
   - `src/app/layout.tsx`: убрать импорт и обёртку `ThemeProvider` (оставить `SiteHeader`, `main`, `SiteFooter`, `Toaster` как есть), атрибут `suppressHydrationWarning` у `<html>` удалить. Задача 02 перепишет файл целиком.
   - `src/components/site-header.tsx`: удалить импорт и использование `<ModeToggle />`.
   - `src/components/ui/sonner.tsx`: убрать `useTheme`, передавать `theme="light"` (тёмной темы нет). Оставить иконки и CSS-переменные как есть.
   - `src/components/site-footer.tsx`: убрать `GitHubStars`/любые ссылки на удалённые модули, если есть.
   - Старый `proxy.ts` (matcher `/dashboard`, `/chat`, `/profile`) и `session.ts` не менять: их перепишет задача 08, они компилируются.
2. **Пакеты.** Удалить: `pnpm remove ai @ai-sdk/react @openrouter/ai-sdk-provider @vercel/blob @better-auth/api-key pg @types/pg next-themes`. Из `package.json` убрать поле `"pnpm"`, а в `pnpm-workspace.yaml` записать:

   ```yaml
   overrides:
     "@types/react": <версия, равная установленному @types/react>
     "@types/react-dom": <версия, равная установленному @types/react-dom>
   allowBuilds:
     esbuild: true
     sharp: true
     msw: false
   ```
   Если pnpm при установке просит решить про другие build-скрипты (например `unrs-resolver`), добавить их в `allowBuilds` (`true` только для `esbuild`, `sharp`, `unrs-resolver`; остальным `false`). Плейсхолдеры «set this to true or false» заменить значениями.
3. **Обновить**: `pnpm add -E next@latest react@latest react-dom@latest` (Next — последний 16.x, ≥ 16.2; React — тот, что требует peer-зависимость выбранного Next; требования проекта: React ≥ 19.2), `pnpm add -D -E eslint-config-next@<та же версия, что next> @types/react@latest @types/react-dom@latest` и привести `overrides` в `pnpm-workspace.yaml` к этим версиям. `better-auth` — остаться на линии **1.6.x** (`pnpm add better-auth@^1.6` — не прыгать на 1.7 без решения владельца). `drizzle-orm`, `drizzle-kit`, `zod`, `tailwindcss`, `@tailwindcss/postcss`, `lucide-react` — обновить до последних (`pnpm up -L <names>`), `zod` остаётся 4.x. `@types/node` — `^22`.
4. **Установить все пакеты проекта** (разом, чтобы не было правок lockfile позже):

   ```bash
   pnpm add react-hook-form @hookform/resolvers sharp file-type nuqs \
     @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
     nodemailer date-fns @date-fns/tz nanoid server-only \
     remark-gfm remark-directive react-dropzone \
     embla-carousel-react yet-another-react-lightbox \
     react-qr-code @tanstack/react-table@^8
   pnpm add -D vitest @playwright/test esbuild @types/nodemailer
   ```
   - `react-markdown` уже есть — оставить. `tsx` уже есть в devDependencies — оставить.
   - `@tanstack/react-table` ставим **v8** намеренно: shadcn-примеры data-table и вся документация — под v8; v9 меняет API.
   - **`react-imask` не ставим**: маску телефона `+7(999)999-99-99` задача 11 пишет сама (~30 строк).
   - `date-fns` локаль `ru` поставляется внутри пакета (`date-fns/locale`).
   - `react-qr-code` — QR для подключения 2FA в задаче 19 (`import QRCode from "react-qr-code"; <QRCode value={totpURI} />`).
   - Для `sharp` проверить, что нативные бинарники скачались (`pnpm exec node -e "require('sharp')"`).
   - Зафиксировать в отчёте итоговые версии `next`, `react`, `better-auth`, `drizzle-orm`.
5. **shadcn-компоненты.** Уже есть: `avatar, badge, button, card, dialog, dropdown-menu, input, label, separator, skeleton, sonner, spinner, textarea`. Добавить недостающие (существующие **не перезаписывать**, без `--overwrite`):

   ```bash
   pnpm dlx shadcn@latest add select checkbox switch tabs alert-dialog sheet form table calendar popover accordion carousel sidebar tooltip radio-group scroll-area command breadcrumb pagination toggle-group --yes
   ```
   - Итоговый набор в `src/components/ui/` должен содержать **все** из списка: button, card, input, textarea, label, select, checkbox, switch, tabs, dialog, alert-dialog, sheet, dropdown-menu, form, table, badge, separator, skeleton, sonner, calendar, popover, accordion, carousel, sidebar, tooltip, radio-group, scroll-area, command, breadcrumb, pagination, toggle-group (плюс уже существующие avatar, spinner). Если CLI отказался добавить компонент из-за `components.json` — не менять стиль, сообщить.
   - CLI может изменить `src/app/globals.css` (переменные sidebar и т.п.). Если `globals.css` изменился — **откатить** (`git checkout src/app/globals.css`) и убедиться, что токены `--sidebar-*` там уже есть (они есть). Стилями занимается задача 02.
   - В `tsconfig.json` включены `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`. Сгенерированные shadcn-файлы (особенно `carousel`, `sidebar`, `calendar`, `form`, `command`) могут не пройти `pnpm typecheck` — **минимально поправить сами сгенерированные файлы** (добавить `?? undefined`, `!`, убрать неиспользуемое). Менять `tsconfig.json` нельзя.
   - В `eslint` правило `import/order` даёт только warning — пусть остаётся warning; `pnpm lint` не должен иметь **errors**.
6. **`next.config.ts`** — переписать целиком (код ниже). Не добавлять `redirects()` — их добавит задача 23.
7. **`src/lib/env.ts`** — переписать (код ниже). Файл сейчас нигде не импортируется — безопасно.
8. **`env.example`** — переписать (содержимое ниже). Старый файл содержит похожий на настоящий `BETTER_AUTH_SECRET` — заменить пустым значением. Команда: `openssl rand -base64 32`.
   - **`NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_SITE_URL` везде.** Стартер использует `NEXT_PUBLIC_APP_URL` в: `README.md:95,338`, `env.example:18`, `scripts/setup.ts:128`, `src/app/api/diagnostics/route.ts:13,44,105`, `src/app/robots.ts:4`, `src/app/sitemap.ts:4`, `src/components/setup-checklist.tsx:15`, `src/hooks/use-diagnostics.ts:13`, `src/lib/auth-client.ts:4`, `src/lib/env.ts:38,68`. Файлы, которые эта задача удаляет (`scripts/setup.ts`, `src/app/api/diagnostics/`, `setup-checklist.tsx`, `use-diagnostics.ts`), просто удаляются; `env.example` и `src/lib/env.ts` переписываются (код ниже); в `README.md`, `src/lib/auth-client.ts`, `src/app/robots.ts`, `src/app/sitemap.ts` — точечная замена имени переменной (`process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"`), больше ничего в этих файлах не менять. Локальный `.env` (не коммитится) тоже поправить. Проверка: `grep -rn "NEXT_PUBLIC_APP_URL" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=specs .` ничего не находит.
9. **`docker-compose.yml`** — заменить `pgvector/pgvector:pg18` на `postgres:18-alpine`. Учесть, что у Postgres 18 том монтируется в `/var/lib/postgresql` (не в `/var/lib/postgresql/data`):

   ```yaml
   services:
     postgres:
       image: postgres:18-alpine
       environment:
         POSTGRES_DB: postgres_dev
         POSTGRES_USER: dev_user
         POSTGRES_PASSWORD: dev_password
       ports:
         - "5432:5432"
       volumes:
         - pgdata:/var/lib/postgresql
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U dev_user -d postgres_dev"]
         interval: 5s
         timeout: 3s
         retries: 10
   volumes:
     pgdata:
   ```
10. **`package.json` scripts** — привести к виду (удалить `db:push`, `db:dev`, `db:reset`, `setup`; `build` больше не запускает миграции):

    ```json
    "scripts": {
      "dev": "next dev --turbopack",
      "build": "next build",
      "build:ci": "next build",
      "build:migrate": "esbuild scripts/migrate.ts --bundle --platform=node --target=node22 --format=cjs --outfile=dist/migrate.cjs",
      "start": "next start",
      "lint": "eslint .",
      "typecheck": "tsc --noEmit",
      "check": "pnpm lint && pnpm typecheck",
      "format": "prettier --write .",
      "format:check": "prettier --check .",
      "test": "vitest run",
      "test:watch": "vitest",
      "test:e2e": "playwright test",
      "db:generate": "drizzle-kit generate",
      "db:migrate": "drizzle-kit migrate",
      "db:studio": "drizzle-kit studio",
      "seed": "tsx --env-file=.env scripts/seed.ts",
      "seed:admin": "tsx --env-file=.env scripts/seed-admin.ts",
      "import:images": "tsx --env-file=.env scripts/import-legacy-images.ts"
    }
    ```
    Скрипт `env:check` удалить. Файлы `scripts/migrate.ts` (задача 04), `seed*.ts` (10, 08) и `import-legacy-images.ts` (15) пока не существуют — это нормально. `drizzle.config.ts` **не менять** (владелец — задача 03).
11. **Vitest** — `vitest.config.ts` (код ниже). Без `vite-tsconfig-paths`: алиас `@` задаётся вручную. `passWithNoTests: true`, чтобы `pnpm test` проходил до появления тестов (задачи 05, 06 добавят).
12. **Playwright** — `playwright.config.ts` и `e2e/health.spec.ts` (код ниже). Установить браузер: `pnpm exec playwright install chromium`. Тесты e2e требуют БД (`docker compose up -d`) — в этой задаче `pnpm test:e2e` запускать **только** если Docker доступен; иначе пометить в отчёте.
13. **`/api/health`** — `src/app/api/health/route.ts` (код ниже). Не должен падать и не должен выполняться при `next build`.
14. **`.gitignore`** — добавить:

    ```
    # local uploads & build artefacts
    /.data/
    /dist/
    /playwright-report/
    /test-results/
    /blob-report/
    ```
    Строку `nul` в конце файла удалить, если это мусор (файл `nul` в корне не коммитить).
15. **`.nvmrc`** → `22`. **`eslint.config.mjs`**: в `ignores` добавить `".data/**"`, `"coverage/**"`, `"playwright-report/**"`, `"test-results/**"`.
16. Проверки: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build:ci` (**без запущенной БД и без `.env`**; если `next build` падает из-за `src/lib/db.ts`, который кидает ошибку при отсутствии `POSTGRES_URL` — на время проверки задать любой `POSTGRES_URL=postgresql://x:x@127.0.0.1:5432/x`, и отметить в отчёте: рефакторинг `db.ts` под сборку без БД делает задача 03). Если `/` отдаёт 404 после сборки — ожидаемо.

### Code Snippets

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// CSP. Inline-скрипты Next.js требуют 'unsafe-inline' (nonce принудительно делает
// страницы динамическими и ломает prerender Cache Components).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://mc.yandex.ru https://mc.yandex.com https://yastatic.net`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://mc.yandex.ru https://mc.yandex.com https://yastatic.net https://*.maps.yandex.net https://yandex.ru",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self' https://mc.yandex.ru https://mc.yandex.com https://yastatic.net wss://mc.yandex.ru wss://mc.yandex.com",
  // карта Яндекса (конструктор/виджет организации; *.yandex.ru покрывает и mc.yandex.ru), VK Видео, Rutube
  "frame-src https://yandex.ru https://*.yandex.ru https://vk.com https://vk.ru https://vkvideo.ru https://rutube.ru",
  "child-src blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  // sharp — нативный модуль: не бандлить и гарантированно положить в standalone.
  // src/assets/fonts — woff-шрифты Onest для opengraph-image (кладёт задача 02, читает задача 25)
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/*": ["node_modules/sharp/**/*", "src/assets/fonts/**/*"],
  },
  experimental: {
    // загрузка до 10 МБ + накладные расходы multipart
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [], // внешних источников нет; загруженные файлы отдаёт /media и <Picture>
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: noindex },
      { source: "/login", headers: noindex },
      { source: "/forgot-password", headers: noindex },
      { source: "/reset-password", headers: noindex },
    ];
  },
};

export default nextConfig;
```

Примечание к `outputFileTracingIncludes`: значение фиксировано контрактом — ровно `{ "/*": ["node_modules/sharp/**/*", "src/assets/fonts/**/*"] }`. Каталог `src/assets/fonts/` создаст задача 02 (wave 2) — до этого glob ничего не находит, это не ошибка. При pnpm `node_modules/sharp` — симлинк в `.pnpm`; если после `pnpm build:ci` в `.next/standalone/node_modules` нет `sharp` и `@img/sharp-*`, это проверит и поправит задача 04 (явным `COPY` в Dockerfile). Здесь достаточно, что конфиг валиден.

`src/lib/env.ts`:

```ts
import { z } from "zod";

/** Пустая строка в .env (`SMTP_HOST=`) трактуется как «не задано». */
const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional()
);
const optionalPort = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.number().int().positive().optional()
);

const serverEnvSchema = z.object({
  POSTGRES_URL: z.string().min(1, "POSTGRES_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  UPLOAD_DIR: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().default(process.env.NODE_ENV === "production" ? "/data/uploads" : "./.data/uploads")
  ),
  // Необязательные: если не заданы, уведомление пропускается + console.warn
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalPort,
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: optionalString,
  LEADS_EMAIL_TO: optionalString,
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_CHAT_ID: optionalString,
  CRON_SECRET: optionalString,
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_YM_ID: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let serverEnvCache: ServerEnv | undefined;

/** Валидирует серверные переменные (кэшируется). Вызывать лениво, не на уровне модуля. */
export function getServerEnv(): ServerEnv {
  if (serverEnvCache) return serverEnvCache;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid server environment variables:", z.flattenError(parsed.error).fieldErrors);
    throw new Error("Invalid server environment variables");
  }
  serverEnvCache = parsed.data;
  return serverEnvCache;
}

/** NEXT_PUBLIC_* читаются литералами, иначе Next не подставит их в клиентский бандл. */
export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_YM_ID: process.env.NEXT_PUBLIC_YM_ID,
  });
  if (!parsed.success) {
    console.error("Invalid client environment variables:", z.flattenError(parsed.error).fieldErrors);
    throw new Error("Invalid client environment variables");
  }
  return parsed.data;
}

/** Предупреждения про необязательные переменные (только в dev). */
export function checkEnv(): void {
  const warnings: string[] = [];
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    warnings.push("SMTP не настроен: email-уведомления о заявках будут пропущены.");
  }
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    warnings.push("Telegram не настроен: уведомления в Telegram будут пропущены.");
  }
  if (!process.env.CRON_SECRET) {
    warnings.push("CRON_SECRET не задан: cron-маршруты будут отвечать 401.");
  }
  if (process.env.NODE_ENV === "development" && warnings.length > 0) {
    console.warn("Environment warnings:");
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }
}
```
Если `z.flattenError` недоступен в установленной версии zod 4 — использовать `parsed.error.flatten().fieldErrors` (как было в старом файле).

`env.example`:

```bash
# --- База данных (docker compose up -d) ---
POSTGRES_URL=postgresql://dev_user:dev_password@localhost:5432/postgres_dev

# --- Better Auth ---
# Сгенерировать: openssl rand -base64 32
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

# --- Публичные (в Docker передаются как build args) ---
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_YM_ID=106365667

# --- Загруженные файлы (в проде — Docker volume /data/uploads) ---
UPLOAD_DIR=./.data/uploads

# --- Email (Яндекс 360, необязательно: без этого письма пропускаются) ---
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
LEADS_EMAIL_TO=

# --- Telegram (необязательно) ---
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# --- Cron (Dokploy Schedules шлют Authorization: Bearer $CRON_SECRET) ---
CRON_SECRET=
```

`vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    passWithNoTests: true,
  },
});
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", locale: "ru-RU", timezoneId: "Asia/Yekaterinburg" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Если E2E_BASE_URL не задан — поднимаем dev-сервер сами (нужны .env и запущенная БД)
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
```

`e2e/health.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("GET /api/health отвечает 200", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});
```

`src/app/api/health/route.ts`:

```ts
import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  // Не выполнять при prerender / next build
  await connection();
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), 3000)),
    ]);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Деталей наружу не отдаём
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
```

### Environment Variables

См. `env.example` выше. Контракт (`contracts.md`): сервер — `POSTGRES_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `UPLOAD_DIR`, `SMTP_HOST/PORT/USER/PASS/FROM`, `LEADS_EMAIL_TO`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`; публичные (build args) — `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_YM_ID`. Старые `NEXT_PUBLIC_APP_URL`, `OPENROUTER_*`, `BLOB_*`, `POLAR_*`, `GOOGLE_*` исчезают из `env.ts`/`env.example`. `NEXT_PUBLIC_APP_URL` заменяется на `NEXT_PUBLIC_SITE_URL` во всём репозитории (шаг 8): `src/lib/auth-client.ts`, `robots.ts`, `sitemap.ts` после этой задачи читают `process.env.NEXT_PUBLIC_SITE_URL` с fallback на localhost; целиком их перепишут задачи 08 и 23.

### API Endpoints

- `GET /api/health` — `200 {"status":"ok"}` если `select 1` выполнился за ≤ 3 с, иначе `503 {"status":"error"}`. Всегда `Cache-Control: no-store`. Используется `HEALTHCHECK` в Docker и Health Check в Dokploy.

## Acceptance Criteria

- [ ] Все файлы из «Files to Delete» удалены; в `src` и `scripts` нет упоминаний `next-themes`, `ai`/`@ai-sdk`, `@openrouter`, `@vercel/blob`, `polar`, `ThemeProvider`, `ModeToggle`
- [ ] `package.json`: нет `ai`, `@ai-sdk/react`, `@openrouter/ai-sdk-provider`, `@vercel/blob`, `@better-auth/api-key`, `pg`, `@types/pg`, `next-themes`, поля `pnpm`; есть все пакеты из шага 4 (в т. ч. `react-qr-code`); `better-auth` остался `^1.6.x`; `next` ≥ 16.2
- [ ] `pnpm-workspace.yaml` содержит `overrides` для `@types/react(-dom)` и `allowBuilds` без плейсхолдеров; `pnpm install` проходит, `sharp` загружается
- [ ] Скрипты в `package.json` совпадают с шагом 10 (нет `db:push`, `db:dev`, `db:reset`, `setup`; `build` = `next build`); в частности ровно `"seed": "tsx --env-file=.env scripts/seed.ts"`, `"seed:admin": "tsx --env-file=.env scripts/seed-admin.ts"`, `"import:images": "tsx --env-file=.env scripts/import-legacy-images.ts"`, `"test": "vitest run"`, `"test:e2e": "playwright test"`, `build:migrate` (esbuild `scripts/migrate.ts` → `dist/migrate.cjs`)
- [ ] В `src/components/ui/` присутствуют все 31 компонент из списка + `avatar`, `spinner`; `globals.css` не изменён относительно исходного состояния
- [ ] `next.config.ts` содержит `output: "standalone"`, `cacheComponents: true`, `experimental.serverActions.bodySizeLimit: "12mb"`, `outputFileTracingIncludes: { "/*": ["node_modules/sharp/**/*", "src/assets/fonts/**/*"] }`, CSP: `frame-src https://yandex.ru https://*.yandex.ru https://vk.com https://vk.ru https://vkvideo.ru https://rutube.ru`, `script-src`/`connect-src`/`img-src` содержат `https://mc.yandex.ru https://mc.yandex.com https://yastatic.net`, `frame-ancestors 'none'`, `X-Robots-Tag: noindex` для `/admin/*`, `/login`, `/forgot-password`, `/reset-password`; удалены `remotePatterns` Google/GitHub/Blob
- [ ] `src/lib/env.ts` валидирует переменные из контракта; необязательные SMTP/Telegram/CRON не ломают старт; нет упоминаний OPENROUTER/BLOB/GOOGLE/POLAR; `env.example` не содержит реальных секретов
- [ ] `docker-compose.yml` использует `postgres:18-alpine`; `docker compose up -d` поднимает БД (если Docker доступен)
- [ ] `vitest.config.ts`, `playwright.config.ts`, `e2e/health.spec.ts` созданы; `pnpm test` проходит (нет тестов — не ошибка)
- [ ] `GET /api/health` возвращает 200 при доступной БД и 503 при недоступной; при `next build` не выполняется (используется `connection()`)
- [ ] `.gitignore` содержит `/.data/`, `/dist/`, `/playwright-report/`, `/test-results/`; `.nvmrc` = `22`
- [ ] `grep -rn "NEXT_PUBLIC_APP_URL" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=specs .` ничего не находит; `README.md`, `src/lib/auth-client.ts`, `src/app/robots.ts`, `src/app/sitemap.ts` используют `NEXT_PUBLIC_SITE_URL`
- [ ] `pnpm lint` (0 errors) и `pnpm typecheck` проходят
- [ ] `pnpm build:ci` проходит (при необходимости с фиктивным `POSTGRES_URL`, см. шаг 16)

## Notes

- Эта задача — единственная, где разрешено менять `package.json`, `pnpm-lock.yaml`, `components.json` и `src/components/ui/*`. Если следующим задачам не хватит пакета, они сообщают об этом, а не ставят сами.
- После этой задачи на сайте нет страницы `/` (404) и нет тёмной темы — это ожидаемо до задач 02, 13, 27.
- `src/app/layout.tsx` и `site-header.tsx` правятся здесь минимально, только чтобы код компилировался; дублировать работу задач 02/13 не нужно.
- Версии 2026 года: `nodemailer` 8+/10, `vitest` 5, `@playwright/test` 1.5x — API, использованный в этом файле, актуален; если CLI/версии отличаются, сверяться с документацией через context7.
- Не коммитить `.env`. Файл `res/` и `specs/` в git пока не добавлены — это не задача 01.
