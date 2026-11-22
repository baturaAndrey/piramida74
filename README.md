# БК «Пирамида» — сайт и админка

Сайт бильярдного клуба «Пирамида» (Челябинск, piramida-billiard-74.ru) с админкой: прайс и залы,
меню и банкетные сеты, калькулятор, турниры, акции, галереи, блог, юридические документы и заявки.

## Стек

- **Next.js 16** (App Router, Cache Components, `output: "standalone"`), **React 19**, TypeScript (strict)
- **PostgreSQL 18** + **Drizzle ORM** (миграции в `drizzle/`, схема в `src/lib/schema/`)
- **Better Auth** — вход в админку по email и паролю (регистрации нет), 2FA
- **Tailwind CSS v4** + shadcn/ui, иконки Lucide; дизайн-система — [`DESIGN.md`](DESIGN.md)
- **sharp** — варианты изображений (avif/webp); файлы хранятся на диске в `UPLOAD_DIR` и отдаются через `/media`
- Уведомления о заявках: SMTP (Яндекс 360) и Telegram — оба необязательны
- Тесты: **Vitest** (unit), **Playwright** (e2e)

Требования: Node.js 22 (`.nvmrc`), pnpm 11, Docker (для локального Postgres).

## Локальная разработка

```bash
pnpm install
cp env.example .env           # заполнить BETTER_AUTH_SECRET: openssl rand -base64 32
docker compose up -d          # Postgres 18 на localhost:5432 (реквизиты — в docker-compose.yml)
pnpm db:migrate               # применить миграции
pnpm seed                     # первичные данные: прайс, меню, турниры, акции, настройки, юр. документы
SEED_ADMIN_PASSWORD='не-короче-10-символов' pnpm seed:admin --email admin@example.ru --name "Имя"
pnpm import:images --source "C:\OSPanel\home\74.loc"   # фото со старого сайта (необязательно)
pnpm dev                      # http://localhost:3000, админка — /admin
```

- `pnpm seed` и `pnpm seed:admin` идемпотентны: повторный запуск ничего не затирает. Пароль
  существующего админа меняется только с флагом `--reset-password`.
- `pnpm import:images` берёт фото из копии старого сайта (каталоги `public/themes/piramida/assets/img`
  и `uploads/`), пропускает их через ту же обработку, что и загрузку в админке, и заполняет галереи,
  обложки акций и афиши турниров. `--dry-run` показывает план без записи. Запускать после `seed`.
- Изменение схемы БД: правка `src/lib/schema/*` → `pnpm db:generate` → `pnpm db:migrate`.
  **`drizzle-kit push` не использовать.**

## Проверки и тесты

```bash
pnpm lint && pnpm typecheck    # ESLint и tsc
pnpm test                      # unit-тесты (Vitest)
pnpm build:ci                  # продакшен-сборка (БД при сборке не нужна)
```

E2E (Playwright) работают на отдельной БД `piramida_e2e` и standalone-сервере, как в Docker:

1. Создать `.env.e2e` по `env.example` (git-ignored): `POSTGRES_URL` с именем БД, содержащим `e2e`,
   `BETTER_AUTH_SECRET`, `CRON_SECRET`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `UPLOAD_DIR`.
2. `pnpm e2e:db` — пересоздаёт БД: migrate → seed → seed:admin, чистит каталог загрузок
   (`--with-images [--source <путь>]` — ещё и импорт фото).
3. `pnpm test:e2e` — собирает приложение и прогоняет тесты; `pnpm e2e:visual` — визуальная сверка.

## Docker

Образ собирается из `Dockerfile` (multi-stage, Alpine, пользователь `node`, uid 1000):

```bash
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://piramida-billiard-74.ru \
  --build-arg NEXT_PUBLIC_YM_ID=106365667 \
  -t piramida .
```

- `NEXT_PUBLIC_*` вшиваются в клиентский бандл при сборке — передаются как **build args**.
- При старте `docker-entrypoint.sh` проверяет, что `UPLOAD_DIR` доступен на запись, применяет
  миграции (`node migrate.cjs`, ждёт БД до 60 с) и запускает `node server.js` на порту 3000.
- При старте сервер проверяет обязательные переменные (`POSTGRES_URL`, `BETTER_AUTH_SECRET` ≥ 32
  символов) и падает с понятной ошибкой, если они не заданы; про ненастроенные SMTP/Telegram/cron пишет предупреждения.
- Загрузки — в volume `/data/uploads`. Для bind mount на хосте: `chown -R 1000:1000 <каталог>`.
- Healthcheck: `GET /api/health` (200 — приложение и БД доступны).
- Служебные скрипты собраны в образ: `node scripts-dist/seed.mjs`, `node scripts-dist/seed-admin.mjs`,
  `node scripts-dist/import-legacy-images.mjs` (см. «Первый деплой»).

## Деплой в Dokploy

### 1. База данных

Создать сервис **PostgreSQL 18** в том же проекте Dokploy. Наружу порт не публиковать: приложение
подключается по внутренней сети Dokploy. Строку подключения (Internal Connection URL) записать
в `POSTGRES_URL` приложения.

### 2. Приложение

- **Application** из Git-репозитория, Build Type — **Dockerfile**, replicas = **1**
  (rate limit заявок и входа хранится в памяти процесса).
- **Build args:** `NEXT_PUBLIC_SITE_URL=https://piramida-billiard-74.ru`, `NEXT_PUBLIC_YM_ID=106365667`.
- **Volume:** именованный `piramida-uploads` → `/data/uploads`.
- **Health Check:** путь `/api/health`, порт 3000.
- **Домены:** `piramida-billiard-74.ru` и `www` (редирект на apex), HTTPS через Let's Encrypt,
  container port 3000. Порт 3000 **не публиковать** на хосте (без Ports mapping) — трафик идёт только через Traefik.

### 3. Переменные окружения

Полный список с комментариями — в [`env.example`](env.example).

| Переменная                                                                        | Обязательна    | Значение                                                    |
| --------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------- |
| `POSTGRES_URL`                                                                    | да             | строка подключения к сервису Postgres                       |
| `BETTER_AUTH_SECRET`                                                              | да             | `openssl rand -base64 32`                                   |
| `BETTER_AUTH_URL`                                                                 | да             | `https://piramida-billiard-74.ru`                           |
| `NEXT_PUBLIC_SITE_URL`                                                            | да (build arg) | `https://piramida-billiard-74.ru`                           |
| `NEXT_PUBLIC_YM_ID`                                                               | да (build arg) | ID счётчика Яндекс Метрики                                  |
| `UPLOAD_DIR`                                                                      | нет            | по умолчанию `/data/uploads`                                |
| `CRON_SECRET`                                                                     | да             | `openssl rand -hex 32`; без него cron-маршруты отвечают 401 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `LEADS_EMAIL_TO` | нет            | письма о заявках; без них письма пропускаются               |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`                                          | нет            | уведомления в Telegram                                      |

`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` в переменные приложения **не добавлять** — они нужны
только разово при создании админа (см. ниже).

### 4. Traefik и IP клиента

Rate limit заявок и входа считается по IP из заголовка `X-Real-IP`. Traefik должен **перезаписывать**
`X-Real-IP` и `X-Forwarded-For` реальным адресом клиента, а не пропускать значения из запроса:
в entrypoints Traefik не включать `forwardedHeaders.insecure` и задать `forwardedHeaders.trustedIPs`
только для доверенных прокси (CDN/балансировщика, если они есть). Иначе rate limit обходится подделкой заголовка.

### 5. Первый деплой: начальные данные

После первого успешного деплоя (миграции уже применены entrypoint'ом) выполнить на сервере
(имя контейнера — `docker ps`, или терминал контейнера в Dokploy):

```bash
APP=$(docker ps --filter "name=<имя-приложения>" --format '{{.Names}}' | head -n1)

# 1) первичные данные, в т.ч. опубликованное согласие на обработку ПДн —
#    без него форма заявок отвечает «Заявки временно не принимаются»
docker exec "$APP" node scripts-dist/seed.mjs

# 2) первый администратор (пароль не короче 10 символов; ведущий пробел — чтобы команда не попала в историю shell)
 docker exec -e SEED_ADMIN_EMAIL='admin@piramida-billiard-74.ru' -e SEED_ADMIN_PASSWORD='…' \
  "$APP" node scripts-dist/seed-admin.mjs --name "Имя Фамилия"
```

Повторный запуск обеих команд безопасен. Смена пароля админа: та же команда с `--reset-password`.

**Пользователи админки.** `seed-admin` создаёт главного админа (роль `admin`). Сотрудников (роль
`staff`) главный админ добавляет в разделе «Пользователи» (`/admin/users`) с временным паролем;
при первом входе сотрудник обязан его сменить. Сотруднику доступна вся админка, кроме раздела
«Пользователи» и эндпоинтов `/api/auth/admin/*` Better Auth.

**Импорт фото со старого сайта** (необязательно). Исходники в образ не входят. Скопировать на сервер
только каталоги с картинками — **без** `index.php`, `send/`, `74.zip` и других файлов с секретами:

```bash
# на рабочей машине: архив только с картинками старого сайта
tar -czf legacy-images.tgz -C /путь/к/74.loc public/themes/piramida/assets/img uploads
scp legacy-images.tgz server:/tmp/

# на сервере: распаковать во временный каталог контейнера (от пользователя node)
docker exec "$APP" mkdir -p /tmp/legacy
docker exec -i "$APP" tar -xzf - -C /tmp/legacy < /tmp/legacy-images.tgz
docker exec "$APP" node scripts-dist/import-legacy-images.mjs --source /tmp/legacy --dry-run
docker exec "$APP" node scripts-dist/import-legacy-images.mjs --source /tmp/legacy
docker exec "$APP" rm -rf /tmp/legacy
rm /tmp/legacy-images.tgz
```

Вместо распаковки через stdin можно скопировать готовый каталог: `docker cp ./legacy "$APP":/tmp/legacy`
(файлы получат владельца root, удалять их тогда — `docker exec -u 0 "$APP" rm -rf /tmp/legacy`).

Фото записываются в volume `/data/uploads` и в таблицы `media_assets`, галерей, акций и турниров.
Импорт идемпотентен: уже импортированные файлы переиспользуются, заданные админом обложки не меняются.

**После всех команд перезапустить приложение** (`docker restart "$APP"` или Redeploy в Dokploy).
Скрипты пишут в БД напрямую, минуя админку, и не сбрасывают кэш публичных страниц
(`'use cache'` с `cacheLife("max")` хранится в памяти процесса) — до перезапуска сайт может
показывать пустые прайс, меню и галереи.

### 6. Расписания (Dokploy Schedules)

Оба запроса — `POST` с заголовком `Authorization: Bearer $CRON_SECRET`:

| Задача                       | Расписание                      | Команда                                                                                                        |
| ---------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Обезличивание старых заявок  | ежедневно, например `0 3 * * *` | `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://piramida-billiard-74.ru/api/cron/retention` |
| Публикация отложенных статей | ежечасно, `0 * * * *`           | `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://piramida-billiard-74.ru/api/cron/blog`      |

Внутри контейнера приложения вместо `curl` можно вызвать
`wget -qO- --post-data='' --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/retention`.

### 7. Бэкапы

- Destination — S3-совместимое хранилище в РФ (Yandex Object Storage, Selectel).
- **Postgres:** ежедневный бэкап сервиса БД средствами Dokploy, хранить 14 копий.
- **Volume `piramida-uploads`:** ежедневный бэкап volume (загруженные фото и их варианты).
- Один раз отрепетировать восстановление: БД из дампа + volume, затем проверить `/api/health`, вход в админку и картинки.

### 8. После запуска

Проверить сайт на staging-домене (цены, меню, турниры из seed правит админ), переключить DNS,
отправить сайт на переобход в Яндекс Вебмастере. Полный список ручных шагов —
[`specs/piramida-rewrite/action-required.md`](specs/piramida-rewrite/action-required.md).

## Структура

```
src/app/(site)/        публичный сайт
src/app/(admin)/admin/ админка
src/app/api/           health, cron, админские route handlers
src/lib/               схема БД, запросы, server actions, медиа, уведомления
scripts/               migrate, seed (+ seed-data/), seed-admin, import-legacy-images, e2e
drizzle/               SQL-миграции
e2e/                   Playwright-тесты
```
