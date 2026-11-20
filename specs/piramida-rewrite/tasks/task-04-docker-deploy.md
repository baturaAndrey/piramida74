# Task 04: Dockerfile, entrypoint, бандл миграций

## Status

pending

## Wave

2

## Description

Готовит контейнеризацию для деплоя на VDS с Dokploy: многостадийный `Dockerfile` на `node:22-alpine` (`output: 'standalone'`), `.dockerignore`, скрипт миграций `scripts/migrate.ts`, который собирается esbuild в один файл `dist/migrate.cjs` (без `drizzle-kit` в рантайме), и `docker-entrypoint.sh` (применить миграции → запустить `node server.js`). Главное требование: **`docker build` проходит без доступной БД**, а контейнер при старте сам применяет миграции, работает не от root, пишет загрузки в volume `/data/uploads` и отвечает на `/api/health`.

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md
**Blocks:** task-28-qa-verification.md

**Context from dependencies:** задача 01 настроила `next.config.ts` (`output: "standalone"`, `cacheComponents: true`, `serverExternalPackages: ["sharp"]`, `outputFileTracingIncludes: { "/*": ["node_modules/sharp/**/*", "src/assets/fonts/**/*"] }` — sharp и woff-шрифты Onest для OG трассируются в standalone), поставила `esbuild` и `sharp`, прописала скрипты `pnpm build` (= `next build`) и `pnpm build:migrate` (= `esbuild scripts/migrate.ts --bundle --platform=node --target=node22 --format=cjs --outfile=dist/migrate.cjs`; остальные скрипты по контракту — `test`, `test:e2e`, `seed`, `seed:admin`, `import:images` — этой задаче не нужны), создала `/api/health` (200 при доступной БД, 503 иначе), `env.example`, `.gitignore` с `/dist/`. Скрипт миграций из этой задачи опирается на то, что папка `drizzle/` с SQL-миграциями появится после задачи 03 (параллельно в Wave 2): для проверки сборки образа достаточно, чтобы `drizzle/` существовала (пусть и пока пустая/старая); полную проверку «миграции применяются при старте» выполнить после того, как задача 03 закоммитила `drizzle/0000_init.sql` (если на момент выполнения её ещё нет — отметить в отчёте и проверить повторно в задаче 28).

## Files to Create

- `Dockerfile` — многостадийная сборка
- `.dockerignore`
- `docker-entrypoint.sh` — миграции + запуск сервера
- `scripts/migrate.ts` — применение миграций drizzle (бандлится в `dist/migrate.cjs`)
- `.gitattributes` — `*.sh text eol=lf` (иначе на Windows entrypoint получит CRLF и контейнер не стартует)

## Files to Modify

Нет. (`package.json` и `next.config.ts` принадлежат задаче 01 — не трогать. Скрипты `build` = `next build` и `build:migrate` (см. выше) задача 01 обязана создать ровно в таком виде; если в `package.json` они расходятся с контрактом — сообщить в отчёте, не править самому.)

## Technical Details

### Implementation Steps

1. Создать `scripts/migrate.ts` (код ниже). Требования: читает `POSTGRES_URL`, ждёт доступности БД (до 30 попыток по 2 с — БД Dokploy может подняться позже приложения), применяет миграции из `./drizzle` относительно `process.cwd()`, закрывает соединение, при ошибке завершает процесс с кодом 1. Файл проходит `pnpm typecheck` (строгий tsconfig: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
2. Проверить локально: `pnpm build:migrate` → создаётся `dist/migrate.cjs`; при запущенной БД (`docker compose up -d`) `node --env-file=.env dist/migrate.cjs` отрабатывает и **повторный запуск идемпотентен**.
3. Создать `docker-entrypoint.sh`, `.dockerignore`, `.gitattributes`, `Dockerfile` (код ниже).
4. Версию pnpm зафиксировать в `ARG PNPM_VERSION` равной локальной (`pnpm -v`, на момент написания `11.1.3`). **Не использовать corepack** (shim падает с pnpm 11) — только `npm i -g pnpm@<версия>`.
5. Собрать образ **без БД и без `.env`**:

   ```bash
   docker build -t piramida-test \
     --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
     --build-arg NEXT_PUBLIC_YM_ID=106365667 .
   ```
   Если `next build` падает из-за обращения к БД или env — это баг в коде страницы/модуля, который нужно показать в отчёте (ожидаемые владельцы: задачи 03, 08, 12). Для самой сборки в Dockerfile уже подставляются фиктивные `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` (только на стадии builder, в финальный образ они не попадают).
6. Запустить и проверить (если Docker доступен; БД — локальная из `docker compose`):

   ```bash
   docker run --rm -d --name piramida-test -p 3001:3000 \
     --add-host=host.docker.internal:host-gateway \
     -e POSTGRES_URL=postgresql://dev_user:dev_password@host.docker.internal:5432/postgres_dev \
     -e BETTER_AUTH_SECRET=0123456789abcdef0123456789abcdef \
     -e BETTER_AUTH_URL=http://localhost:3001 \
     -v piramida-test-uploads:/data/uploads piramida-test
   curl -i http://localhost:3001/api/health          # 200 {"status":"ok"}
   docker inspect --format '{{.State.Health.Status}}' piramida-test   # healthy (подождать start-period)
   docker exec piramida-test id                      # uid=1000(node)
   docker exec piramida-test sh -c 'ls -ld /data/uploads && touch /data/uploads/.w && rm /data/uploads/.w'
   docker exec piramida-test node -e "const s=require('sharp'); s({create:{width:8,height:8,channels:3,background:'#fff'}}).webp().toBuffer().then(b=>console.log('sharp ok',b.length))"
   docker exec piramida-test ls -l /app/src/assets/fonts   # 4 файла onest-*.woff (если задача 02 уже положила их)
   docker logs piramida-test | head                  # видны строки применения миграций
   docker rm -f piramida-test
   ```
   Если `sharp` в контейнере не находится (pnpm-симлинки не попали в standalone) — добавить в стадию `runner` перед `USER node` fallback: `RUN cd /app && npm install --no-save --no-audit --no-fund --omit=dev sharp@<точная версия из package.json>` и описать это в отчёте.
7. Зафиксировать размер образа (`docker images piramida-test`) в отчёте. Ориентир — до ~400 МБ.
8. `pnpm lint`, `pnpm typecheck` проходят (Dockerfile/sh lint-ом не проверяются).

### Code Snippets

`scripts/migrate.ts`:

```ts
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MAX_ATTEMPTS = 30;
const DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("[migrate] POSTGRES_URL is not set");
    process.exit(1);
  }

  const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "drizzle");
  const client = postgres(url, { max: 1, connect_timeout: 10 });

  // ждём БД
  for (let attempt = 1; ; attempt++) {
    try {
      await client`select 1`;
      break;
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) {
        console.error("[migrate] database is unreachable:", (err as Error).message);
        process.exit(1);
      }
      console.warn(`[migrate] database not ready (attempt ${attempt}/${MAX_ATTEMPTS}), retrying…`);
      await sleep(DELAY_MS);
    }
  }

  console.log(`[migrate] applying migrations from ${migrationsFolder}`);
  await migrate(drizzle(client), { migrationsFolder });
  console.log("[migrate] done");
  await client.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
```

`docker-entrypoint.sh`:

```sh
#!/bin/sh
set -e

UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
mkdir -p "$UPLOAD_DIR" 2>/dev/null || true

# Том должен быть доступен на запись пользователю node (uid 1000)
if ! touch "$UPLOAD_DIR/.write-test" 2>/dev/null; then
  echo "[entrypoint] ERROR: $UPLOAD_DIR is not writable by uid $(id -u)." >&2
  echo "[entrypoint] For a bind mount run on the host: chown -R 1000:1000 <host-dir>" >&2
  exit 1
fi
rm -f "$UPLOAD_DIR/.write-test"

echo "[entrypoint] running database migrations"
node /app/migrate.cjs

echo "[entrypoint] starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
```

`Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22
ARG PNPM_VERSION=11.1.3

# ---------- base ----------
FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
RUN apk add --no-cache libc6-compat \
 && npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

# ---------- builder ----------
FROM deps AS builder
COPY . .

# Публичные переменные вшиваются в клиентский бандл при сборке
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_YM_ID=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_YM_ID=$NEXT_PUBLIC_YM_ID \
    NEXT_TELEMETRY_DISABLED=1

# БД при сборке нет. Секреты сюда не передаются; фиктивные значения живут только в этом RUN.
RUN BETTER_AUTH_SECRET=build-only-secret-build-only-secret-0000 \
    BETTER_AUTH_URL=http://localhost:3000 \
    pnpm build \
 && pnpm build:migrate

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data/uploads

# каталог загрузок создаётся в образе и принадлежит node:
# именованный volume наследует владельца при первом монтировании
RUN mkdir -p /data/uploads && chown -R node:node /data

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/dist/migrate.cjs ./migrate.cjs
COPY --chown=node:node --chmod=0755 docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh

USER node
VOLUME ["/data/uploads"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
```
`src/assets/fonts/*.woff` (4 файла от задачи 02: `onest-{cyrillic,latin}-{400,700}-normal.woff`) попадают в standalone через `outputFileTracingIncludes` задачи 01 (`"src/assets/fonts/**/*"`) и оказываются в `/app/src/assets/fonts/`; задача 25 читает их как `join(process.cwd(), "src/assets/fonts/<имя>")`, `process.cwd()` в контейнере = `/app`. Отдельный `COPY` для шрифтов **не нужен** и не добавляется. Для `sharp` — наоборот: при pnpm трассировка может не захватить `@img/sharp-*` (симлинки `.pnpm`), поэтому fallback из шага 6 (явная установка/`COPY` sharp в стадии runner) сохраняется.

`.dockerignore`:

```
node_modules
.next
.git
.gitignore
.gitattributes
.env
.env.*
!env.example
.data
dist
coverage
playwright-report
test-results
blob-report
e2e
res
specs
docs
.claude
.agents
.vscode
.idea
Dockerfile
.dockerignore
docker-compose.yml
*.md
!README.md
npm-debug.log*
*.tsbuildinfo
next-env.d.ts
```
(`drizzle/`, `public/`, `scripts/`, `src/`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `components.json`, конфиги — в контекст **попадают**.)

`.gitattributes`:

```
*.sh text eol=lf
Dockerfile text eol=lf
```

### Environment Variables

Build args (публичные, подставляются в клиентский бандл): `NEXT_PUBLIC_SITE_URL` (по умолчанию `http://localhost:3000`), `NEXT_PUBLIC_YM_ID` (`106365667`).

Runtime (задаются в Dokploy, **не** в образе): `POSTGRES_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `UPLOAD_DIR=/data/uploads` (уже в образе), `SMTP_HOST/PORT/USER/PASS/FROM`, `LEADS_EMAIL_TO`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`. `PORT=3000` и `HOSTNAME=0.0.0.0` заданы в образе (без `HOSTNAME=0.0.0.0` Docker подставит id контейнера и standalone-сервер не будет доступен снаружи).

### API Endpoints

- `GET /api/health` (создан задачей 01) — используется `HEALTHCHECK` и Health Check в Dokploy.

## Acceptance Criteria

- [ ] `docker build` проходит **без доступной БД** и без `.env` (команда из шага 5)
- [ ] Образ строится на `node:22-alpine`; pnpm ставится через `npm i -g pnpm@<версия>` (нет `corepack`); версия закреплена `ARG PNPM_VERSION`
- [ ] `pnpm build:migrate` создаёт `dist/migrate.cjs`; повторный запуск против БД идемпотентен; скрипт ждёт БД и завершает работу с кодом 1 при ошибке
- [ ] Контейнер при старте применяет миграции (`[migrate] done` в логах) и запускает `node server.js`; пересборка приложения при старте не выполняется
- [ ] `GET /api/health` отвечает 200, `docker inspect` показывает `healthy`
- [ ] Процесс работает от пользователя `node` (uid 1000), не от root
- [ ] `/data/uploads` существует, принадлежит `node`, доступен на запись; для не записываемого каталога entrypoint завершается с понятным сообщением
- [ ] `require('sharp')` работает внутри контейнера (alpine/musl), конвертация изображения выполняется
- [ ] `/app/src/assets/fonts/` в контейнере содержит 4 файла `onest-*.woff` (если задача 02 выполнена к моменту проверки; иначе — отметить в отчёте, закроет задача 28)
- [ ] `.dockerignore` исключает `node_modules`, `.next`, `.git`, `.env*`, `res`, `specs`, `.claude`, `.agents`; `.gitattributes` задаёт LF для `*.sh`
- [ ] Секреты не попадают в образ (проверка: `docker history --no-trunc piramida-test` не содержит реальных значений; фиктивные `BETTER_AUTH_SECRET` не присутствуют в финальной стадии)
- [ ] `pnpm lint` и `pnpm typecheck` проходят (включая `scripts/migrate.ts`)

## Notes

- **Dokploy (для владельца, см. `action-required.md`, раздел «After Implementation»):** Application из Git с типом сборки `Dockerfile`; `NEXT_PUBLIC_SITE_URL` и `NEXT_PUBLIC_YM_ID` — в **Build Args**, остальное — в Environment; Postgres 18 как отдельный сервис, `POSTGRES_URL` — через внутреннюю сеть Dokploy; Volume Mount (тип Volume) `piramida-uploads` → `/data/uploads`; **replicas = 1** (кэш `'use cache'` живёт в памяти процесса); Health Check на `/api/health`; домен с Let's Encrypt через Traefik; Traefik должен перезаписывать `X-Real-IP` и `X-Forwarded-For` (trusted IPs только свои), иначе обходится rate limit. Dokploy Schedules (cron) выполняют команду внутри контейнера, например: `wget -q -O- --post-data='' --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/retention` (ежедневно) и `.../api/cron/blog` (ежечасно). Бэкапы Postgres и volume — в российский S3.
- Если сборка на VDS упадёт по OOM — собирать в GitHub Actions → GHCR → Dokploy «Docker image» (вне объёма этой задачи).
- `next/font/google` скачивает Onest во время сборки — у стадии builder нужен доступ в интернет.
- Если Docker на машине недоступен — написать все файлы, проверить `pnpm build:migrate`, а проверки с `docker` явно пометить в отчёте как невыполненные (их закроет задача 28).
- Если выяснится, что standalone не включает нужные пакеты из-за pnpm-симлинков — предпочитать правку `outputFileTracingIncludes` в `next.config.ts` (через сообщение владельцу задачи 01), а в Dockerfile — только точечный fallback.
